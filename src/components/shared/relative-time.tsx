"use client";

import { formatPublishedAgo, formatRelative } from "@/lib/format";

/**
 * Date relative (« il y a 3 min ») rendue côté serveur puis hydratée côté client.
 * Le texte peut changer entre les deux rendus (passage d'une minute ou d'une heure) :
 * `suppressHydrationWarning` évite un faux positif d'hydratation sur ce seul nœud texte.
 */
export function RelativeTime({ date, mode = "relative", className }: { date: Date | string; mode?: "relative" | "published"; className?: string }) {
  const value = typeof date === "string" ? date : date.toISOString();
  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {mode === "published" ? formatPublishedAgo(date) : formatRelative(date)}
    </time>
  );
}
