"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsData } from "@/features/analytics/server/queries";

/** Palette validée (2 séries, contraste et CVD ok) : violet primaire + vert. */
const COLORS = { sent: { light: "#5A4BD8", dark: "#8B7CFF" }, responses: { light: "#2F9E5F", dark: "#2FA35C" } };

function useDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function fmtWeek(key: string): string {
  const d = new Date(key);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

type TooltipPayload = { name: string; value: number; color: string };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">Semaine du {typeof label === "string" ? fmtWeek(label) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="mt-0.5 flex items-center gap-2 text-muted-foreground">
          <span className="inline-block size-2 rounded-sm" style={{ background: p.color }} aria-hidden /> {p.name} : <span className="font-medium text-foreground tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function WeeklyChart({ data }: { data: AnalyticsData["perWeek"] }) {
  const dark = useDark();
  const rows = data.map((d) => ({ ...d, label: fmtWeek(d.week) }));
  return (
    <figure>
      <div className="h-64" role="img" aria-label="Candidatures envoyées et réponses reçues par semaine">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-border" strokeOpacity={0.6} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" width={36} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "currentColor", fillOpacity: 0.04 }} />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sent" name="Candidatures envoyées" fill={dark ? COLORS.sent.dark : COLORS.sent.light} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="responses" name="Réponses reçues" fill={dark ? COLORS.responses.dark : COLORS.responses.light} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Nombre de candidatures envoyées et de réponses reçues, par semaine, sur les 8 dernières semaines.</figcaption>
      <table className="sr-only">
        <caption>Données du graphique</caption>
        <thead><tr><th>Semaine</th><th>Envoyées</th><th>Réponses</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.week}><td>{r.label}</td><td>{r.sent}</td><td>{r.responses}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export function StatusBars({ data }: { data: AnalyticsData["byStatus"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-2" aria-label="Répartition des candidatures par statut">
      {data.map((d) => (
        <li key={d.status} className="grid grid-cols-[110px_1fr_28px] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground">{d.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="text-right font-medium tabular-nums">{d.count}</span>
        </li>
      ))}
    </ul>
  );
}
