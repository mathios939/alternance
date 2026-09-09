import { createLogger } from "@/lib/logger";
import type { FetchParams, JobSourceProvider, ProviderStatus, RawJob } from "../types";

const log = createLogger("job-sources:france-travail");

type FranceTravailOffer = {
  id: string;
  intitule: string;
  description?: string;
  dateCreation?: string;
  dateActualisation?: string;
  lieuTravail?: { libelle?: string; latitude?: number; longitude?: number; codePostal?: string; commune?: string };
  entreprise?: { nom?: string; url?: string };
  typeContrat?: string;
  natureContrat?: string;
  dureeTravailLibelle?: string;
  salaire?: { libelle?: string };
  formations?: Array<{ niveauLibelle?: string }>;
  competences?: Array<{ libelle?: string }>;
  origineOffre?: { urlOrigine?: string };
  alternance?: boolean;
};

/**
 * API officielle France Travail « Offres d'emploi v2 » (https://francetravail.io).
 * Nécessite un compte partenaire (client id / secret). Désactivé proprement sinon.
 */
export class FranceTravailProvider implements JobSourceProvider {
  readonly key = "france-travail";
  readonly name = "France Travail";
  readonly type = "FRANCE_TRAVAIL" as const;

  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: { clientId?: string; clientSecret?: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(this.config.clientId && this.config.clientSecret);
    return {
      key: this.key,
      name: this.name,
      type: this.type,
      configured,
      reason: configured ? undefined : "FRANCE_TRAVAIL_CLIENT_ID / SECRET non renseignés",
    };
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId ?? "",
      client_secret: this.config.clientSecret ?? "",
      scope: "api_offresdemploiv2 o2dsoffre",
    });
    const res = await this.fetchImpl("https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Authentification France Travail échouée (${res.status})`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return this.token.value;
  }

  async fetchJobs(params: FetchParams): Promise<RawJob[]> {
    const status = await this.status();
    if (!status.configured) {
      log.info("Provider France Travail non configuré : ignoré");
      return [];
    }
    const token = await this.getToken();
    const search = new URLSearchParams({
      natureContrat: "E2,FS", // apprentissage & professionnalisation
      range: `0-${Math.min((params.limit ?? 150) - 1, 149)}`,
      sort: "1",
    });
    if (params.keywords) search.set("motsCles", params.keywords);
    if (params.since) search.set("minCreationDate", params.since.toISOString().replace(/\.\d{3}Z$/, "Z"));
    const res = await this.fetchImpl(`https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${search}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`France Travail API ${res.status}`);
    const data = (await res.json()) as { resultats?: FranceTravailOffer[] };
    return (data.resultats ?? []).map(mapOffer);
  }
}

export function mapOffer(o: FranceTravailOffer): RawJob {
  const lieu = o.lieuTravail?.libelle ?? "";
  const city = lieu.replace(/^\d{2,3}\s*-\s*/, "").trim() || o.lieuTravail?.commune || "France";
  const salary = o.salaire?.libelle?.match(/(\d[\d\s]*)/g)?.map((s) => Number(s.replace(/\s/g, ""))) ?? [];
  return {
    externalId: o.id,
    title: o.intitule,
    companyName: o.entreprise?.nom ?? "Entreprise confidentielle",
    companyWebsite: o.entreprise?.url ?? null,
    description: o.description ?? "",
    skills: (o.competences ?? []).map((c) => c.libelle ?? "").filter(Boolean),
    city,
    postalCode: o.lieuTravail?.codePostal ?? null,
    latitude: o.lieuTravail?.latitude ?? null,
    longitude: o.lieuTravail?.longitude ?? null,
    contractType: o.natureContrat?.toLowerCase().includes("professionnalisation") ? "PROFESSIONNALISATION" : "APPRENTISSAGE",
    salaryMin: salary[0] ?? null,
    salaryMax: salary[1] ?? salary[0] ?? null,
    publishedAt: o.dateCreation ? new Date(o.dateCreation) : new Date(),
    sourceUrl: o.origineOffre?.urlOrigine ?? `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
    raw: o,
  };
}
