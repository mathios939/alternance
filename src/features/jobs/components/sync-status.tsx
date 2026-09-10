"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { describeSyncedAgo } from "@/lib/freshness";
import type { SearchFreshnessInfo } from "@/features/jobs/types";

/**
 * Dernière actualisation véridique de la recherche : « Synchronisé avec France Travail il y a 18 s ».
 * Le texte est recalculé toutes les 30 s ; il ne promet jamais de « temps réel » : c'est la date à
 * laquelle notre copie locale a été rapprochée de la source pour cette zone (ou, à défaut, pour la France).
 */
export function SyncStatus({ freshness }: { freshness: SearchFreshnessInfo }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const ago = describeSyncedAgo(freshness.lastSyncAt);
  if (!ago && !freshness.refreshing) return null;
  return (
    <p
      className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-xs"
      suppressHydrationWarning
    >
      <RefreshCw className={freshness.refreshing ? "size-3 animate-spin" : "size-3"} aria-hidden />
      {ago ? (
        <span>
          Synchronisé avec France Travail {ago}
          {freshness.label && freshness.scope !== "none" ? (
            <span className="text-muted-foreground/80">
              {" "}
              · {freshness.scope === "national" ? "France entière" : freshness.label}
            </span>
          ) : null}
        </span>
      ) : null}
      {freshness.refreshing ? (
        <span className="text-primary">{ago ? " · " : ""}actualisation en cours…</span>
      ) : null}
    </p>
  );
}
