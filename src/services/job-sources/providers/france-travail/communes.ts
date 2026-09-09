import { CITIES, findCity } from "@/config/cities";
import { normalizeText } from "@/lib/text/normalize";
import type { FranceTravailClient } from "./client";

/**
 * L'API France Travail attend un code INSEE de commune (pas un code postal).
 * Résolution : table statique (villes connues) → référentiel officiel de l'API (mis en cache).
 * En cas d'échec, l'appelant retombe sur le département (sans rayon) et le signale.
 */
export type ResolvedCommune = { inseeCode: string; label: string; via: "static" | "referentiel" };

type RefCommune = { code: string; libelle: string; codePostal?: string; codeDepartement?: string };

export class CommuneResolver {
  private referentiel: Map<string, RefCommune> | null = null;
  private loading: Promise<void> | null = null;

  constructor(private readonly client: FranceTravailClient | null) {}

  async resolve(cityOrCode: string): Promise<ResolvedCommune | null> {
    const input = cityOrCode.trim();
    if (/^\d{5}$/.test(input) || /^2[AB]\d{3}$/i.test(input)) return { inseeCode: input.toUpperCase(), label: input, via: "static" };
    const known = findCity(input);
    if (known?.inseeCode) return { inseeCode: known.inseeCode, label: known.name, via: "static" };
    if (!this.client) return null;
    await this.load();
    const hit = this.referentiel?.get(normalizeText(input));
    return hit ? { inseeCode: hit.code, label: hit.libelle, via: "referentiel" } : null;
  }

  /** Charge le référentiel des communes une seule fois par processus. */
  private async load(): Promise<void> {
    if (this.referentiel || !this.client) return;
    if (!this.loading) {
      this.loading = this.client.getReferentiel("communes").then((rows) => {
        const map = new Map<string, RefCommune>();
        for (const row of rows as RefCommune[]) {
          if (!row?.code || !row?.libelle) continue;
          const key = normalizeText(row.libelle);
          // Première occurrence gagne (les grandes villes sont listées avant leurs homonymes).
          if (!map.has(key)) map.set(key, row);
        }
        this.referentiel = map;
      });
    }
    await this.loading;
  }

  /** Compare les codes statiques au référentiel officiel (utilisé par le test externe). */
  async checkStaticCodes(): Promise<Array<{ city: string; expected: string; found: string | null }>> {
    if (!this.client) return [];
    await this.load();
    const mismatches: Array<{ city: string; expected: string; found: string | null }> = [];
    for (const city of CITIES) {
      if (!city.inseeCode) continue;
      const hit = this.referentiel?.get(normalizeText(city.name));
      if (!hit || hit.code !== city.inseeCode) mismatches.push({ city: city.name, expected: city.inseeCode, found: hit?.code ?? null });
    }
    return mismatches;
  }
}
