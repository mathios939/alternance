import "server-only";
import { PostgresSearchProvider } from "./postgres";
import type { FullTextSearchProvider } from "./types";

export type { FullTextSearchProvider, SearchHit } from "./types";

let provider: FullTextSearchProvider | null = null;

/** Sélectionne le moteur de recherche (SEARCH_PROVIDER, "postgres" par défaut). */
export function getSearchProvider(): FullTextSearchProvider {
  if (provider) return provider;
  provider = new PostgresSearchProvider();
  return provider;
}
