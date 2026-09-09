"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { assertRateLimit } from "@/lib/rate-limit";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/lib/action";
import { JOB_FAMILIES, type JobFamilyKey } from "@/config/taxonomy";
import { trackActivity } from "@/features/activity/server/track";
import { analyzeResume } from "@/features/resume/lib/analyze";
import { parseResumeText } from "@/features/resume/lib/parse";
import { extractResumeText, RESUME_MAX_BYTES, sniffResumeType } from "./extract";

/** Enregistre un fichier CV comme nouvelle version (créée le CV s'il n'existe pas). Usage interne (onboarding + page CV). */
export async function saveResumeFile(input: { userId: string; resumeId?: string; fileName: string; mimeType: string; bytes: Uint8Array; text: string; title?: string }) {
  const { userId } = input;
  let resumeId = input.resumeId;
  if (!resumeId) {
    const existing = await prisma.resume.findFirst({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
    if (existing) resumeId = existing.id;
  }
  if (!resumeId) {
    const created = await prisma.resume.create({ data: { userId, title: input.title ?? "Mon CV", isDefault: true } });
    resumeId = created.id;
  }
  const last = await prisma.resumeVersion.findFirst({ where: { resumeId }, orderBy: { version: "desc" }, select: { version: true } });
  const parsed = parseResumeText(input.text);
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { jobFamily: true } });
  const keywords = profile?.jobFamily ? JOB_FAMILIES[profile.jobFamily as JobFamilyKey]?.keywords : undefined;
  const analysis = analyzeResume(input.text, { targetJobFamilyKeywords: keywords });
  const version = await prisma.resumeVersion.create({
    data: {
      resumeId,
      version: (last?.version ?? 0) + 1,
      fileName: input.fileName.slice(0, 200),
      mimeType: input.mimeType,
      fileSize: input.bytes.byteLength,
      fileData: Buffer.from(input.bytes),
      extractedText: input.text.slice(0, 200_000),
      content: JSON.parse(JSON.stringify({ email: parsed.email, phone: parsed.phone, linkedinUrl: parsed.linkedinUrl, skills: parsed.skills.map((s) => s.name), languages: parsed.languages.map((l) => l.name), educationLines: parsed.educationLines, experienceLines: parsed.experienceLines, detectedLevel: parsed.detectedLevel })),
      analysis: JSON.parse(JSON.stringify(analysis)),
    },
  });
  await prisma.resume.update({ where: { id: resumeId }, data: { updatedAt: new Date() } });
  await trackActivity({ userId, type: "RESUME_UPLOADED", title: `CV importé : ${input.fileName} (score ${analysis.score}/100)` });
  return { resumeId, versionId: version.id, analysis };
}

/** Upload depuis la page CV. */
export async function uploadResumeVersion(formData: FormData): Promise<ActionResult<{ resumeId: string; score: number }>> {
  return runAction("uploadResumeVersion", async () => {
    const userId = await requireUserId();
    await assertRateLimit("resume-upload", userId, { limit: 10, windowMs: 10 * 60_000 });
    const file = formData.get("file");
    const resumeId = formData.get("resumeId");
    if (!(file instanceof File) || file.size === 0) return fail("Aucun fichier reçu.");
    if (file.size > RESUME_MAX_BYTES) return fail("Le fichier dépasse 5 Mo.");
    if (resumeId && typeof resumeId === "string") {
      const owned = await prisma.resume.findFirst({ where: { id: resumeId, userId }, select: { id: true } });
      if (!owned) return fail("CV introuvable.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffResumeType(bytes);
    if (!type) return fail("Format non pris en charge : PDF ou texte uniquement.");
    const text = await extractResumeText(bytes, type);
    if (text.trim().length < 50) return fail("Aucun texte lisible dans ce fichier (PDF scanné ?).");
    const saved = await saveResumeFile({ userId, resumeId: typeof resumeId === "string" ? resumeId : undefined, fileName: file.name, mimeType: type, bytes, text });
    revalidatePath("/resume");
    return ok({ resumeId: saved.resumeId, score: saved.analysis.score });
  });
}

const createSchema = z.object({ title: z.string().trim().min(2).max(60) });

export async function createResume(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction("createResume", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(createSchema, input);
    if (!parsed.ok) return parsed.result;
    const count = await prisma.resume.count({ where: { userId } });
    if (count >= 10) return fail("Maximum 10 versions de CV.");
    const resume = await prisma.resume.create({ data: { userId, title: parsed.data.title, isDefault: count === 0 } });
    revalidatePath("/resume");
    return ok({ id: resume.id });
  });
}

export async function renameResume(id: string, title: string): Promise<ActionResult> {
  return runAction("renameResume", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(createSchema, { title });
    if (!parsed.ok) return parsed.result;
    const r = await prisma.resume.findFirst({ where: { id, userId } });
    if (!r) return fail("CV introuvable.");
    await prisma.resume.update({ where: { id }, data: { title: parsed.data.title } });
    revalidatePath("/resume");
    return ok(undefined);
  });
}

export async function setDefaultResume(id: string): Promise<ActionResult> {
  return runAction("setDefaultResume", async () => {
    const userId = await requireUserId();
    const r = await prisma.resume.findFirst({ where: { id, userId } });
    if (!r) return fail("CV introuvable.");
    await prisma.$transaction([prisma.resume.updateMany({ where: { userId }, data: { isDefault: false } }), prisma.resume.update({ where: { id }, data: { isDefault: true } })]);
    revalidatePath("/resume");
    return ok(undefined);
  });
}

export async function deleteResume(id: string): Promise<ActionResult> {
  return runAction("deleteResume", async () => {
    const userId = await requireUserId();
    const r = await prisma.resume.findFirst({ where: { id, userId } });
    if (!r) return fail("CV introuvable.");
    await prisma.resume.delete({ where: { id } });
    revalidatePath("/resume");
    return ok(undefined);
  });
}

/** Ré-analyse la dernière version d'un CV (ex. après mise à jour du métier visé). */
export async function reanalyzeResume(id: string): Promise<ActionResult<{ score: number }>> {
  return runAction("reanalyzeResume", async () => {
    const userId = await requireUserId();
    const version = await prisma.resumeVersion.findFirst({ where: { resume: { id, userId } }, orderBy: { version: "desc" } });
    if (!version?.extractedText) return fail("Aucune version de CV à analyser.");
    const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { jobFamily: true } });
    const keywords = profile?.jobFamily ? JOB_FAMILIES[profile.jobFamily as JobFamilyKey]?.keywords : undefined;
    const analysis = analyzeResume(version.extractedText, { targetJobFamilyKeywords: keywords });
    await prisma.resumeVersion.update({ where: { id: version.id }, data: { analysis: JSON.parse(JSON.stringify(analysis)) } });
    await trackActivity({ userId, type: "RESUME_ANALYZED", title: `CV analysé : ${analysis.score}/100` });
    revalidatePath("/resume");
    return ok({ score: analysis.score });
  });
}

/** Sauvegarde le contenu structuré (sections) d'un CV rédigé dans l'app. */
const structuredSchema = z.object({
  resumeId: z.string().min(1),
  text: z.string().min(50, "Rédige au moins quelques lignes").max(20_000),
});

export async function saveResumeText(input: z.input<typeof structuredSchema>): Promise<ActionResult<{ score: number }>> {
  return runAction("saveResumeText", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(structuredSchema, input);
    if (!parsed.ok) return parsed.result;
    const r = await prisma.resume.findFirst({ where: { id: parsed.data.resumeId, userId } });
    if (!r) return fail("CV introuvable.");
    const bytes = new TextEncoder().encode(parsed.data.text);
    const saved = await saveResumeFile({ userId, resumeId: r.id, fileName: `${r.title}.txt`, mimeType: "text/plain", bytes, text: parsed.data.text });
    revalidatePath("/resume");
    return ok({ score: saved.analysis.score });
  });
}
