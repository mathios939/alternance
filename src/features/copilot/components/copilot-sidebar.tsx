"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { FileText, MessageSquare, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/components/shared/relative-time";
import { Button } from "@/components/ui/button";
import { deleteConversation, deleteDocument } from "@/features/copilot/server/actions";

type Conv = { id: string; title: string; updatedAt: string; messages: number };
type Doc = { id: string; title: string; createdAt: string; provider: string | null };

export function CopilotSidebar({ conversations, documents, activeId, activeDocId }: { conversations: Conv[]; documents: Doc[]; activeId: string | null; activeDocId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function remove(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Erreur");
      router.push("/copilot");
      router.refresh();
    });
  }
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Conversations</p>
          <Button asChild size="sm" variant="ghost"><Link href="/copilot"><Plus /> Nouvelle</Link></Button>
        </div>
        <ul className="mt-2 space-y-1">
          {conversations.length === 0 ? <li className="text-xs text-muted-foreground">Aucune conversation.</li> : null}
          {conversations.map((c) => (
            <li key={c.id} className={cn("group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm hover:bg-accent", c.id === activeId && "bg-primary-soft text-primary")}>
              <Link href={`/copilot?c=${c.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                <MessageSquare className="size-4 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate">{c.title}</span>
                  <span className="block text-[11px] text-muted-foreground"><RelativeTime date={c.updatedAt} /></span>
                </span>
              </Link>
              <button type="button" onClick={() => remove(() => deleteConversation(c.id))} disabled={pending} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label="Supprimer la conversation"><Trash2 className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-sm font-semibold">Documents générés</p>
        <ul className="mt-2 space-y-1">
          {documents.length === 0 ? <li className="text-xs text-muted-foreground">Lettres, emails et relances apparaîtront ici.</li> : null}
          {documents.map((d) => (
            <li key={d.id} className={cn("group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm hover:bg-accent", d.id === activeDocId && "bg-primary-soft text-primary")}>
              <Link href={`/copilot?document=${d.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                <FileText className="size-4 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate">{d.title}</span>
                  <span className="block text-[11px] text-muted-foreground"><RelativeTime date={d.createdAt} />{d.provider === "mock" ? " · démo" : ""}</span>
                </span>
              </Link>
              <button type="button" onClick={() => remove(() => deleteDocument(d.id))} disabled={pending} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label="Supprimer le document"><Trash2 className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
