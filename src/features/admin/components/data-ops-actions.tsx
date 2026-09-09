"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, RefreshCw, ShieldCheck, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { expireJobsAdmin, importCompaniesAdmin, syncSource, verifySource } from "@/features/admin/server/actions";

type Source = { key: string; name: string; configured: boolean; supportsVerification: boolean };

/** Boutons d'exploitation des données (admin) : chaque action est journalisée dans IngestionRun. */
export function DataOpsActions({ sources, companyProviderConfigured }: { sources: Source[]; companyProviderConfigured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (label: string, fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? `${label} : échec`);
      else toast.success(`${label} terminé`, { description: typeof r.data === "object" && r.data ? JSON.stringify(r.data).slice(0, 180) : undefined });
      router.refresh();
    });
  const configured = sources.filter((s) => s.configured && s.key !== "manual");
  return (
    <div className="flex flex-wrap gap-2">
      {configured.map((s) => (
        <span key={s.key} className="inline-flex gap-1">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(`Ingestion ${s.name}`, () => syncSource(s.key))}><RefreshCw /> Relancer {s.name}</Button>
          {s.supportsVerification ? <Button size="sm" variant="outline" disabled={pending} onClick={() => run(`Vérification ${s.name}`, () => verifySource(s.key))}><ShieldCheck /> Vérifier</Button> : null}
        </span>
      ))}
      {configured.length === 0 ? <span className="self-center text-xs text-muted-foreground">Aucune source d'offres configurée (voir .env.example).</span> : null}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("Expiration", () => expireJobsAdmin())}><Timer /> Expirer</Button>
      {companyProviderConfigured ? <Button size="sm" variant="outline" disabled={pending} onClick={() => run("Import entreprises (44)", () => importCompaniesAdmin("44"))}><Building2 /> Importer des entreprises (44)</Button> : null}
    </div>
  );
}
