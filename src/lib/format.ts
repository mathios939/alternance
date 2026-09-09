import { formatDistanceToNowStrict, format, isToday, isTomorrow, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";

export function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: fr })
    .replace("il y a ", "il y a ")
    .replace(/^dans /, "dans ");
}

export function formatPublishedAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

export function formatDate(date: Date | string, pattern = "d MMM yyyy"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, pattern, { locale: fr });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isToday(d)) return `Aujourd'hui à ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Demain à ${format(d, "HH:mm")}`;
  return format(d, "EEEE d MMMM 'à' HH:mm", { locale: fr });
}

export function daysSince(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return differenceInCalendarDays(new Date(), d);
}

export function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)} / mois`;
  return `${fmt(min ?? max ?? 0)} / mois`;
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return "< 1 km";
  if (km < 10) return `${km.toFixed(1).replace(".0", "")} km`;
  return `${Math.round(km)} km`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR");
}

export function formatPercent(n: number): string {
  return `${Math.round(n)} %`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m.toString().padStart(2, "0")}` : `${h} h`;
}
