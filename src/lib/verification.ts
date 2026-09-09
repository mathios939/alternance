import type { JobVerificationStatus } from "@/generated/prisma/enums";

/**
 * Libellés de fraîcheur / vérification d'une offre (Phase 7 & 13).
 * Jamais « active » sans date : une offre non re-vérifiée le dit explicitement.
 */
export type VerificationInfo = { status: JobVerificationStatus; label: string; tone: "success" | "warning" | "destructive" | "muted"; hours: number | null };

export function describeVerification(status: JobVerificationStatus, lastVerifiedAt: Date | string | null, now = new Date()): VerificationInfo {
  const date = lastVerifiedAt ? new Date(lastVerifiedAt) : null;
  const hours = date ? Math.max(0, (now.getTime() - date.getTime()) / 3_600_000) : null;
  const ago = hours === null ? null : hours < 1 ? "il y a moins d'une heure" : hours < 48 ? `il y a ${Math.round(hours)} h` : `il y a ${Math.round(hours / 24)} jours`;
  if (status === "EXPIRED") return { status, label: "Offre expirée", tone: "destructive", hours };
  if (status === "REMOVED") return { status, label: "Offre retirée par sa source", tone: "destructive", hours };
  if (status === "ACTIVE" && ago) return { status, label: `Vérifiée ${ago}`, tone: hours !== null && hours > 7 * 24 ? "warning" : "success", hours };
  if (status === "UNKNOWN" && ago) return { status, label: `Non re-vérifiée depuis ${ago.replace("il y a ", "")}`, tone: "warning", hours };
  return { status, label: "Non vérifiée auprès de la source", tone: "muted", hours };
}
