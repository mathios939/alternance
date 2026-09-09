/**
 * Abstraction de recherche plein texte.
 * MVP : PostgreSQL (tsvector + trigrammes). Interchangeable avec Meilisearch,
 * Typesense, OpenSearch ou Elasticsearch sans toucher aux features.
 */
export type SearchHit = { id: string; rank: number };

export interface FullTextSearchProvider {
  readonly name: string;
  searchJobs(query: string, options?: { limit?: number }): Promise<SearchHit[]>;
  searchCompanies(query: string, options?: { limit?: number }): Promise<SearchHit[]>;
}
