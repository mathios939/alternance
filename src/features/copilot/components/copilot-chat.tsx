"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, Sparkles, StopCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LiteMarkdown } from "./markdown";

export type ChatMessage = { id: string; role: "USER" | "ASSISTANT" | "SYSTEM"; content: string; provider?: string | null };

const SUGGESTIONS = ["Trouve-moi les meilleures offres près de chez moi", "Quelles entreprises dois-je contacter aujourd'hui ?", "Quelles candidatures dois-je relancer ?", "Pourquoi mes candidatures ne fonctionnent pas ?", "Comment améliorer mon CV ?"];

type Props = { conversationId: string | null; initialMessages: ChatMessage[]; isMock: boolean; contextLabel: string | null; contextParams: { jobSlug?: string | null; companySlug?: string | null; applicationId?: string | null }; initialPrompt?: string | null };

export function CopilotChat({ conversationId, initialMessages, isMock, contextLabel, contextParams, initialPrompt }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState(conversationId);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
    setConvId(conversationId);
  }, [initialMessages, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    setInput("");
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "USER", content };
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "ASSISTANT", content: "" }]);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message: content, ...contextParams }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "Erreur");
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: `_${err || "Le copilote est indisponible."}_` } : x)));
        return;
      }
      const newConv = res.headers.get("x-conversation-id");
      if (newConv && newConv !== convId) setConvId(newConv);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: snapshot } : x)));
      }
      if (newConv && newConv !== conversationId) {
        window.history.replaceState(null, "", `/copilot?c=${newConv}`);
        router.refresh();
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: "_Connexion interrompue. Réessaie._" } : x)));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><Bot className="size-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Copilote</p>
          <p className="truncate text-xs text-muted-foreground">{contextLabel ? `Contexte : ${contextLabel}` : "Il connaît ton profil, tes candidatures et tes offres."}</p>
        </div>
        {isMock ? <Badge variant="warning">Mode démo (sans clé IA)</Badge> : <Badge variant="soft"><Sparkles aria-hidden /> IA activée</Badge>}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-lg py-8 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Sparkles className="size-6" aria-hidden /></span>
            <p className="mt-4 font-semibold">Que veux-tu faire aujourd'hui ?</p>
            <p className="mt-1 text-sm text-muted-foreground">Le copilote utilise uniquement les données de ton compte. Rien n'est envoyé à une entreprise sans toi.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-3", m.role === "USER" ? "justify-end" : "justify-start")}>
            {m.role !== "USER" ? <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Bot className="size-4" aria-hidden /></span> : null}
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", m.role === "USER" ? "bg-primary text-primary-foreground" : "surface")}>
              {m.role === "USER" ? <p className="whitespace-pre-line text-[15px]">{m.content}</p> : m.content ? <LiteMarkdown text={m.content} /> : <span className="inline-flex gap-1 py-1" aria-label="Le copilote réfléchit"><span className="size-1.5 animate-pulse-soft rounded-full bg-muted-foreground" /><span className="size-1.5 animate-pulse-soft rounded-full bg-muted-foreground [animation-delay:200ms]" /><span className="size-1.5 animate-pulse-soft rounded-full bg-muted-foreground [animation-delay:400ms]" /></span>}
            </div>
            {m.role === "USER" ? <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><UserRound className="size-4" aria-hidden /></span> : null}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
        className="border-t p-3"
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            placeholder="Pose une question ou demande une action… (Entrée pour envoyer)"
            className="min-h-11 max-h-40 resize-none"
            aria-label="Message au copilote"
            disabled={streaming}
          />
          {streaming ? (
            <Button type="button" variant="outline" size="icon" onClick={() => abortRef.current?.abort()} aria-label="Arrêter"><StopCircle /></Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Envoyer"><Send /></Button>
          )}
        </div>
      </form>
    </div>
  );
}
