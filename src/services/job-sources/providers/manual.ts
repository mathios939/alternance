import type { FetchPage, FetchParams, JobSourceProvider, ProviderCapabilities, ProviderStatus, RawJob } from "../types";

/**
 * Source manuelle : offres saisies via l'admin ou fournies dans un fichier JSON.
 * Sert aussi de provider de démonstration (données seed) et de doublure dans les tests.
 */
export class ManualProvider implements JobSourceProvider {
  readonly key: string;
  readonly name: string;
  readonly type = "MANUAL" as const;
  readonly priority: number;
  readonly capabilities: ProviderCapabilities = {
    supportsSearch: true,
    supportsIncrementalSync: false,
    supportsLocation: true,
    supportsRadius: false,
    supportsDetails: false,
    supportsSalary: true,
    supportsExpiration: true,
    supportsVerification: false,
  };

  constructor(
    private readonly loader: () => Promise<RawJob[]> = async () => [],
    options: { key?: string; name?: string; priority?: number } = {},
  ) {
    this.key = options.key ?? "manual";
    this.name = options.name ?? "Saisie manuelle";
    this.priority = options.priority ?? 50;
  }

  async status(): Promise<ProviderStatus> {
    return { key: this.key, name: this.name, type: this.type, configured: true };
  }

  async fetchJobs(params: FetchParams): Promise<FetchPage> {
    const jobs = await this.loader();
    const q = params.keywords?.toLowerCase();
    const filtered = jobs
      .filter((j) => !q || j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q))
      .filter((j) => !params.city || (j.city ?? "").toLowerCase() === params.city.toLowerCase())
      .slice(0, params.limit ?? 500);
    return { jobs: filtered, total: filtered.length, requests: 0, warnings: [] };
  }
}
