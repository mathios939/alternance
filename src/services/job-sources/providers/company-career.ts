import { createLogger } from "@/lib/logger";
import type { FetchPage, FetchParams, JobSourceProvider, ProviderCapabilities, ProviderStatus, RawJob } from "../types";

const log = createLogger("job-sources:company-career");

export type CareerFeed = {
  companyName: string;
  /** Flux JSON/RSS explicitement mis à disposition par l'entreprise (ou partenaire). */
  feedUrl: string;
  format: "json" | "rss";
  website?: string;
};

/**
 * Pages carrières partenaires : uniquement des flux fournis volontairement
 * (JSON Feed, RSS, API partenaire). Aucun scraping HTML.
 */
export class CompanyCareerProvider implements JobSourceProvider {
  readonly key = "company-career";
  readonly name = "Sites carrières partenaires";
  readonly type = "COMPANY_CAREER" as const;
  /** Page carrière officielle : source de candidature préférée (Phase 6). */
  readonly priority = 90;
  readonly capabilities: ProviderCapabilities = {
    supportsSearch: false,
    supportsIncrementalSync: false,
    supportsLocation: false,
    supportsRadius: false,
    supportsDetails: false,
    supportsSalary: false,
    supportsExpiration: false,
    supportsVerification: false,
  };

  constructor(private readonly feeds: CareerFeed[] = []) {}

  async status(): Promise<ProviderStatus> {
    return {
      key: this.key,
      name: this.name,
      type: this.type,
      configured: this.feeds.length > 0,
      missing: this.feeds.length === 0 ? ["CAREER_FEEDS_JSON"] : [],
      reason: this.feeds.length === 0 ? "Aucun flux partenaire configuré (CAREER_FEEDS_JSON, voir docs/PROVIDERS.md)" : undefined,
    };
  }

  async fetchJobs(params: FetchParams): Promise<FetchPage> {
    const results: RawJob[] = [];
    const warnings: string[] = [];
    for (const feed of this.feeds) {
      try {
        const res = await fetch(feed.feedUrl, { headers: { accept: feed.format === "json" ? "application/json" : "application/rss+xml" } });
        if (!res.ok) {
          log.warn("Flux carrière indisponible", { company: feed.companyName, status: res.status });
          warnings.push(`${feed.companyName} : flux indisponible (${res.status})`);
          continue;
        }
        if (feed.format === "json") {
          const data = (await res.json()) as { items?: Array<Record<string, unknown>> };
          for (const item of data.items ?? []) results.push(mapJsonFeedItem(item, feed));
        } else {
          const xml = await res.text();
          results.push(...parseRss(xml, feed));
        }
      } catch (error) {
        log.error("Erreur de lecture du flux carrière", error, { company: feed.companyName });
        warnings.push(`${feed.companyName} : ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const jobs = results.slice(0, params.limit ?? 500);
    return { jobs, total: results.length, requests: this.feeds.length, warnings };
  }
}

/** Flux déclarés dans CAREER_FEEDS_JSON : [{ "companyName", "feedUrl", "format": "json" | "rss", "website" }]. */
export function parseCareerFeeds(json: string | undefined): CareerFeed[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f): f is CareerFeed => typeof f === "object" && f !== null && typeof (f as CareerFeed).feedUrl === "string" && typeof (f as CareerFeed).companyName === "string")
      .map((f) => ({ ...f, format: f.format === "rss" ? "rss" : "json" }));
  } catch {
    log.warn("CAREER_FEEDS_JSON invalide : ignoré");
    return [];
  }
}

function mapJsonFeedItem(item: Record<string, unknown>, feed: CareerFeed): RawJob {
  const str = (k: string) => (typeof item[k] === "string" ? (item[k] as string) : "");
  return {
    externalId: str("id") || str("url"),
    title: str("title"),
    companyName: feed.companyName,
    companyWebsite: feed.website ?? null,
    description: str("content_text") || str("summary") || str("description"),
    city: str("city") || str("location") || null,
    publishedAt: item["date_published"] ? new Date(String(item["date_published"])) : new Date(),
    sourceUrl: str("url") || null,
    raw: item,
  };
}

function parseRss(xml: string, feed: CareerFeed): RawJob[] {
  const items = xml.split(/<item>/i).slice(1);
  return items.map((chunk, i) => {
    const pick = (tag: string) => {
      const m = chunk.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, "i"));
      return m?.[1]?.trim() ?? "";
    };
    const link = pick("link");
    return {
      externalId: pick("guid") || link || `${feed.companyName}-${i}`,
      title: pick("title"),
      companyName: feed.companyName,
      companyWebsite: feed.website ?? null,
      description: pick("description").replace(/<[^>]+>/g, " "),
      city: pick("location") || null,
      publishedAt: pick("pubDate") ? new Date(pick("pubDate")) : new Date(),
      sourceUrl: link || null,
    };
  });
}
