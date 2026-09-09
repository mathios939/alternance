/** Provenance des entreprises (module pur) : liste de { source, url, fetchedAt, label }. */
export type CompanySourceRef = { source: string; url: string | null; fetchedAt: string; label?: string };

/** Fusionne une provenance dans la liste existante (une entrée par source, la plus récente conservée). */
export function mergeDataSources(existing: unknown, ref: CompanySourceRef): CompanySourceRef[] {
  const list = Array.isArray(existing) ? (existing as CompanySourceRef[]).filter((s) => s && typeof s.source === "string") : [];
  return [...list.filter((s) => s.source !== ref.source), ref];
}

