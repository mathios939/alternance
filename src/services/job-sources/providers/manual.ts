import type { FetchParams, JobSourceProvider, ProviderStatus, RawJob } from "../types";

/**
 * Source manuelle : offres saisies via l'admin ou fournies dans un fichier JSON.
 * Sert aussi de provider de démonstration (données seed).
 */
export class ManualProvider implements JobSourceProvider {
  readonly key = "manual";
  readonly name = "Saisie manuelle";
  readonly type = "MANUAL" as const;

  constructor(private readonly loader: () => Promise<RawJob[]> = async () => []) {}

  async status(): Promise<ProviderStatus> {
    return { key: this.key, name: this.name, type: this.type, configured: true };
  }

  async fetchJobs(params: FetchParams): Promise<RawJob[]> {
    const jobs = await this.loader();
    const q = params.keywords?.toLowerCase();
    return jobs
      .filter((j) => !q || j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q))
      .filter((j) => !params.city || j.city.toLowerCase() === params.city.toLowerCase())
      .slice(0, params.limit ?? 500);
  }
}
