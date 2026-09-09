"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DocumentKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getSession, requireUserId } from "@/lib/auth/session";
import { assertRateLimit } from "@/lib/rate-limit";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/lib/action";
import { PLAN_LIMITS } from "@/config/plans";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import { buildCopilotContext } from "@/lib/ai/context";
import { DOCUMENT_LABELS, documentInstruction, renderContext, SYSTEM_PROMPT, type DocumentKindKey } from "@/lib/ai/prompts";
import { trackActivity } from "@/features/activity/server/track";

const KIND_TO_ENUM: Record<DocumentKindKey, DocumentKind> = {
  cover_letter: "COVER_LETTER",
  email: "EMAIL",
  linkedin_message: "LINKEDIN_MESSAGE",
  follow_up: "FOLLOW_UP",
  interview_prep: "INTERVIEW_PREP",
  resume_adaptation: "RESUME_ADAPTATION",
  spontaneous_email: "EMAIL",
  spontaneous_pitch: "SPONTANEOUS_PITCH",
};

const schema = z.object({
  kind: z.enum(["cover_letter", "email", "linkedin_message", "follow_up", "interview_prep", "resume_adaptation", "spontaneous_email", "spontaneous_pitch"]),
  jobSlug: z.string().optional().nullable(),
  companySlug: z.string().optional().nullable(),
  applicationId: z.string().optional().nullable(),
  interviewId: z.string().optional().nullable(),
  resumeId: z.string().optional().nullable(),
  instructions: z.string().max(600).optional(),
});

export type GenerateDocumentInput = z.input<typeof schema>;
export type GeneratedDocumentResult = { id: string; title: string; content: string; provider: string; model: string; isDemo: boolean };

/** Génère un document (lettre, email, message, relance, préparation…) à partir du contexte du compte. */
export async function generateDocument(input: GenerateDocumentInput): Promise<ActionResult<GeneratedDocumentResult>> {
  return runAction("generateDocument", async () => {
    const session = await getSession();
    if (!session) return fail("Tu dois être connecté.");
    const userId = session.id;
    const parsed = parseInput(schema, input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;

    // Quota quotidien selon le plan (architecture SaaS)
    const limit = PLAN_LIMITS[session.plan].aiDocumentsPerDay;
    const since = new Date(Date.now() - 86_400_000);
    const used = await prisma.generatedDocument.count({ where: { userId, createdAt: { gte: since } } });
    if (used >= limit) return fail(`Quota atteint : ${limit} documents IA par jour avec ton plan actuel.`);
    await assertRateLimit("ai-generate", userId, { limit: 20, windowMs: 10 * 60_000 });

    let applicationId = v.applicationId ?? null;
    let companySlug = v.companySlug ?? null;
    let jobSlug = v.jobSlug ?? null;
    if (v.interviewId) {
      const interview = await prisma.interview.findFirst({ where: { id: v.interviewId, userId }, include: { company: { select: { slug: true } }, job: { select: { slug: true } } } });
      if (interview) {
        applicationId ??= interview.applicationId;
        companySlug ??= interview.company.slug;
        jobSlug ??= interview.job?.slug ?? null;
      }
    }

    const context = await buildCopilotContext(userId, { jobSlug, companySlug, applicationId, resumeId: v.resumeId, includeResume: v.kind === "resume_adaptation" || v.kind === "cover_letter" });
    if (!context) return fail("Complète d'abord ton profil.");
    if ((v.kind === "cover_letter" || v.kind === "email" || v.kind === "resume_adaptation") && !context.job) return fail("Cette génération nécessite une offre.");
    if ((v.kind === "spontaneous_email" || v.kind === "spontaneous_pitch" || v.kind === "linkedin_message") && !context.company) return fail("Cette génération nécessite une entreprise.");

    const provider = getAIProvider();
    let result;
    try {
      result = await provider.generate({
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `${renderContext(context)}\n\n## Tâche\n${documentInstruction(v.kind, v.instructions)}` }],
        maxTokens: 2048,
        meta: { kind: v.kind, context, userInput: v.instructions },
      });
    } catch (error) {
      if (error instanceof AIProviderError) return fail(error.message);
      throw error;
    }
    if (result.refused) return fail("Le fournisseur IA a refusé cette génération. Reformule la demande.");
    if (!result.text) return fail("Réponse vide du fournisseur IA.");

    const target = context.job ? context.job.companyName : context.company?.name ?? "";
    const title = `${DOCUMENT_LABELS[v.kind]}${target ? ` — ${target}` : ""}`;
    const job = context.job ? await prisma.job.findUnique({ where: { id: context.job.id }, select: { id: true, companyId: true } }) : null;
    const company = !job && companySlug ? await prisma.company.findUnique({ where: { slug: companySlug }, select: { id: true } }) : null;
    const doc = await prisma.generatedDocument.create({
      data: {
        userId,
        applicationId,
        jobId: job?.id ?? null,
        companyId: job?.companyId ?? company?.id ?? null,
        kind: KIND_TO_ENUM[v.kind],
        title,
        content: result.text,
        provider: result.provider,
        model: result.model,
        dataOrigin: "AI_GENERATED",
      },
    });
    if (applicationId) {
      await prisma.applicationEvent.create({ data: { applicationId, type: "DOCUMENT_GENERATED", payload: { documentId: doc.id, kind: v.kind } } });
      if (v.kind === "cover_letter") await prisma.application.update({ where: { id: applicationId }, data: { coverLetterId: doc.id } });
    }
    await trackActivity({ userId, type: "DOCUMENT_GENERATED", title: `${title} généré${result.provider === "mock" ? " (démo)" : ""}`, jobId: job?.id, companyId: job?.companyId ?? company?.id, applicationId });
    revalidatePath("/applications");
    return ok({ id: doc.id, title, content: result.text, provider: result.provider, model: result.model, isDemo: result.provider === "mock" });
  });
}

export async function deleteConversation(id: string): Promise<ActionResult> {
  return runAction("deleteConversation", async () => {
    const userId = await requireUserId();
    const conv = await prisma.aIConversation.findFirst({ where: { id, userId } });
    if (!conv) return fail("Conversation introuvable.");
    await prisma.aIConversation.delete({ where: { id } });
    revalidatePath("/copilot");
    return ok(undefined);
  });
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  return runAction("deleteDocument", async () => {
    const userId = await requireUserId();
    const doc = await prisma.generatedDocument.findFirst({ where: { id, userId } });
    if (!doc) return fail("Document introuvable.");
    await prisma.generatedDocument.delete({ where: { id } });
    revalidatePath("/copilot");
    return ok(undefined);
  });
}
