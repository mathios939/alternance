import { CITIES, findCity } from "@/config/cities";
import { departmentCodeFromPostal } from "@/config/departments";
import { normalizeText } from "@/lib/text/normalize";
import type { FranceTravailClient } from "./client";

/**
 * L'API France Travail attend un code INSEE de commune (pas un code postal).
 * Résolution : table statique (villes connues) → référentiel officiel de l'API (mis en cache).
 * Plusieurs communes portent le même nom (Saint-Nazaire existe en 44 et en 66) : le référentiel
 * est donc indexé par libellé ET par département ; sans département connu, un homonyme est signalé.
 */
export type ResolvedCommune = { inseeCode: string; label: string; via: "static" | "referentiel"; ambiguous?: boolean };

type RefCommune = { code: string; libelle: string; codePostal?: string; codeDepartement?: string };

function departmentOf(row: RefCommune): string | null {
  return row.codeDepartement ?? departmentCodeFromPostal(row.codePostal) ?? departmentCodeFromPostal(row.code);
}

export class CommuneResolver {
  private referentiel: Map<string, RefCommune[]> | null = null;
  private loading: Promise<void> | null = null;

  constructor(private readonly client: FranceTravailClient | null) {}

  async resolve(cityOrCode: string, departmentCode?: string | null): Promise<ResolvedCommune | null> {
    const input = cityOrCode.trim();
    if (/^\d{5}$/.test(input) || /^2[AB]\d{3}$/i.test(input)) return { inseeCode: input.toUpperCase(), label: input, via: "static" };
    const known = findCity(input);
    if (known?.inseeCode) return { inseeCode: known.inseeCode, label: known.name, via: "static" };
    if (!this.client) return null;
    await this.load();
    const rows = this.referentiel?.get(normalizeText(input)) ?? [];
    if (rows.length === 0) return null;
    const wanted = departmentCode ?? known?.departmentCode ?? null;
    const hit = (wanted ? rows.find((r) => departmentOf(r) === wanted) : undefined) ?? rows[0]!;
    return { inseeCode: hit.code, label: hit.libelle, via: "referentiel", ambiguous: rows.length > 1 && !wanted };
  }

  /** Charge le référentiel des communes une seule fois par processus. */
  private async load(): Promise<void> {
    if (this.referentiel || !this.client) return;
    if (!this.loading) {
      this.loading = this.client.getReferentiel("communes").then((rows) => {
        const map = new Map<string, RefCommune[]>();
        for (const row of rows as RefCommune[]) {
          if (!row?.code || !row?.libelle) continue;
          const key = normalizeText(row.libelle);
          map.set(key, [...(map.get(key) ?? []), row]);
        }
        this.referentiel = map;
      });
    }
    await this.loading;
  }

  /**
   * Compare les codes statiques au référentiel officiel, dans le même département
   * (utilisé par le test externe). Un écart signale une vraie erreur de `src/config/cities.ts`.
   */
  async checkStaticCodes(): Promise<Array<{ city: string; expected: string; found: string | null }>> {
    if (!this.client) return [];
    await this.load();
    const mismatches: Array<{ city: string; expected: string; found: string | null }> = [];
    for (const city of CITIES) {
      if (!city.inseeCode) continue;
      const rows = this.referentiel?.get(normalizeText(city.name)) ?? [];
      const sameDepartment = rows.find((r) => departmentOf(r) === city.departmentCode);
      const found = sameDepartment ?? rows.find((r) => r.code === city.inseeCode) ?? null;
      if (!found || found.code !== city.inseeCode) mismatches.push({ city: city.name, expected: city.inseeCode, found: found?.code ?? rows[0]?.code ?? null });
    }
    return mismatches;
  }
}
