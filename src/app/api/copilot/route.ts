import { z } from "zod";
import { after } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getRateLimiter } from "@/lib/rate-limit";
import { PLAN_LIMITS } from "@/config/plans";
import { AIProviderError, getAIProvider } from "@/lib/ai";
import { buildCopilotContext, detectContextNeeds } from "@/lib/ai/context";
import { renderContext, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createLogger } from "@/lib/logger";
import { trackActivity } from "@/features/activity/server/track";

const log = createLogger("api:copilot");

const bodySchema = z.object({
  conversationId: z.string().optional().nullable(),
  message: z.string().trim().min(1).max(4000),
  jobSlug: z.string().optional().nullable(),
  companySlug: z.string().optional().nullable(),
  applicationId: z.string().optional().nullable(),
});

/**
 * Chat du copilote : streaming texte (text/plain) avec un en-tête X-Conversation-Id.
 * Le message assistant est persisté à la fin du flux.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Non authentifié", { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Requête invalide", { status: 400 });
  const { message, jobSlug, companySlug, applicationId } = parsed.data;
  const userId = session.id;

  const limit = PLAN_LIMITS[session.plan].copilotMessagesPerDay;
  const daily = await getRateLimiter(`copilot-daily-${session.plan}`, { limit, windowMs: 86_400_000 }).check(userId);
  if (!daily.allowed) return new Response(`Quota atteint : ${limit} messages par jour avec ton plan.`, { status: 429 });
  const burst = await getRateLimiter("copilot-burst", { limit: 10, windowMs: 60_000 }).check(userId);
  if (!burst.allowed) return new Response("Trop de messages, patiente une minute.", { status: 429 });

  // Conversation
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const owned = await prisma.aIConversation.findFirst({ where: { id: conversationId, userId }, select: { id: true } });
    if (!owned) conversationId = null;
  }
  if (!conversationId) {
    const conv = await prisma.aIConversation.create({ data: { userId, title: message.slice(0, 60), context: { jobSlug, companySlug, applicationId } } });
    conversationId = conv.id;
  }
  await prisma.aIMessage.create({ data: { conversationId, role: "USER", content: message } });

  const history = await prisma.aIMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" }, take: 20, select: { role: true, content: true } });
  const needs = detectContextNeeds(message);
  const context = await buildCopilotContext(userId, { ...needs, jobSlug, companySlug, applicationId });
  if (!context) return new Response("Complète d'abord ton profil.", { status: 400 });

  const provider = getAIProvider();
  const system = `${SYSTEM_PROMPT}\n\n# Données du compte (source de vérité)\n${renderContext(context)}`;
  const messages = history.filter((m) => m.role !== "SYSTEM").map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content }));
  const encoder = new TextEncoder();
  const convId = conversationId;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let providerName = provider.name;
      let model = provider.model;
      try {
        for await (const event of provider.stream({ system, messages, maxTokens: 2048, meta: { kind: "chat", context, userInput: message }, signal: request.signal })) {
          if (event.type === "delta") {
            full += event.text;
            controller.enqueue(encoder.encode(event.text));
          } else {
            providerName = event.result.provider;
            model = event.result.model;
            if (event.result.refused) {
              const note = "\n\n_Le fournisseur IA a refusé cette demande. Reformule-la._";
              full += note;
              controller.enqueue(encoder.encode(note));
            }
          }
        }
      } catch (error) {
        const text = error instanceof AIProviderError ? `\n\n_${error.message}_` : "\n\n_Une erreur est survenue. Réessaie._";
        log.error("Streaming copilote interrompu", error);
        full += text;
        controller.enqueue(encoder.encode(text));
      } finally {
        controller.close();
        after(async () => {
          if (!full.trim()) return;
          await prisma.aIMessage.create({ data: { conversationId: convId, role: "ASSISTANT", content: full.trim(), provider: providerName, model } });
          await prisma.aIConversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });
          await trackActivity({ userId, type: "COPILOT_USED", title: `Copilote : « ${message.slice(0, 50)} »` });
        });
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "x-conversation-id": conversationId, "x-ai-provider": provider.name, "cache-control": "no-store" },
  });
}
