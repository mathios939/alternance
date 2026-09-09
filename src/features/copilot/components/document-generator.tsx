"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Sparkles, Wand2 } from "lucide-react";
import { DOCUMENT_LABELS, type DocumentKindKey } from "@/lib/ai/prompts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DataBadge } from "@/components/shared/data-badge";
import { generateDocument, type GeneratedDocumentResult } from "@/features/copilot/server/actions";
import { LiteMarkdown } from "./markdown";

type Props = {
  kind: DocumentKindKey;
  params: { jobSlug?: string | null; companySlug?: string | null; applicationId?: string | null; interviewId?: string | null; resumeId?: string | null };
  contextLabel: string | null;
  existing?: GeneratedDocumentResult | null;
  autoStart?: boolean;
};

export function DocumentGenerator({ kind, params, contextLabel, existing, autoStart = true }: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState<GeneratedDocumentResult | null>(existing ?? null);
  const [instructions, setInstructions] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [started, setStarted] = useState(Boolean(existing));

  function run() {
    startTransition(async () => {
      const r = await generateDocument({ kind, ...params, instructions: instructions || undefined });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDoc(r.data);
      router.refresh();
    });
  }

  useEffect(() => {
    if (autoStart && !started) {
      setStarted(true);
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy() {
    if (!doc) return;
    await navigator.clipboard.writeText(doc.content);
    setCopied(true);
    toast.success("Copié dans le presse-papiers");
    setTimeout(() => setCopied(false), 1500);
  }

  const isProse = ["cover_letter", "email", "linkedin_message", "follow_up", "spontaneous_email"].includes(kind);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><Wand2 className="size-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{DOCUMENT_LABELS[kind]}</p>
          <p className="truncate text-xs text-muted-foreground">{contextLabel ?? "À partir de ton profil"}</p>
        </div>
        {doc ? doc.isDemo ? <Badge variant="warning">Mode démo</Badge> : <DataBadge kind="AI_GENERATED" /> : null}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {pending && !doc ? (
          <div className="space-y-3" aria-busy>
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4 animate-pulse text-primary" aria-hidden /> Rédaction à partir de ton profil, de l'entreprise et de l'offre…</p>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-3" style={{ width: `${95 - i * 9}%` }} />)}
          </div>
        ) : doc ? (
          <div className="surface p-5">
            {isProse ? <pre className="font-sans text-[15px] leading-relaxed whitespace-pre-wrap">{doc.content.replace(/\n\n---\n_[^_]+_$/, "")}</pre> : <LiteMarkdown text={doc.content.replace(/\n\n---\n_[^_]+_$/, "")} />}
            {doc.isDemo ? <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Mode démo : texte construit par des règles à partir de tes données, sans modèle IA. Configure une clé (ANTHROPIC_API_KEY) pour une rédaction par IA.</p> : <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Généré par IA ({doc.model}). Relis, personnalise, puis envoie toi-même : rien n'est envoyé automatiquement.</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Clique sur « Générer » pour rédiger ce document à partir de ton profil.</p>
        )}
      </div>
      <div className="space-y-2 border-t p-3">
        <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Consignes (optionnel) : ton, points à insister, longueur…" className="min-h-11 max-h-28" maxLength={600} aria-label="Consignes supplémentaires" />
        <div className="flex flex-wrap justify-end gap-2">
          {doc ? <Button variant="outline" onClick={copy}>{copied ? <Check /> : <Copy />} Copier</Button> : null}
          <Button onClick={run} loading={pending}>{!pending ? <Sparkles /> : null} {doc ? "Régénérer" : "Générer"}</Button>
        </div>
      </div>
    </div>
  );
}
