"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { EducationLevel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/auth/session";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/lib/action";
import { trackActivity } from "@/features/activity/server/track";

const accountSchema = z.object({ name: z.string().trim().min(2).max(80), marketingOptIn: z.boolean().optional() });

export async function updateAccount(input: z.input<typeof accountSchema>): Promise<ActionResult> {
  return runAction("updateAccount", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(accountSchema, input);
    if (!parsed.ok) return parsed.result;
    await prisma.user.update({ where: { id: userId }, data: { name: parsed.data.name, marketingOptIn: parsed.data.marketingOptIn } });
    revalidatePath("/settings");
    return ok(undefined);
  });
}

/** Suppression définitive du compte et de toutes les données personnelles (RGPD). */
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  return runAction("deleteAccount", async () => {
    const userId = await requireUserId();
    if (confirmation.trim().toUpperCase() !== "SUPPRIMER") return fail("Tape SUPPRIMER pour confirmer.");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return fail("Compte introuvable.");
    await prisma.user.delete({ where: { id: userId } });
    try {
      await auth.api.signOut({ headers: await headers() });
    } catch {
      // la session est déjà invalidée par la suppression en cascade
    }
    return ok(undefined);
  });
}

const experienceSchema = z.object({
  title: z.string().trim().min(2).max(120),
  company: z.string().trim().min(1).max(120),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  current: z.boolean().optional(),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  skills: z.array(z.string().trim().min(1).max(60)).max(15).optional(),
});

async function profileIdFor(userId: string): Promise<string | null> {
  const p = await prisma.candidateProfile.findUnique({ where: { userId }, select: { id: true } });
  return p?.id ?? null;
}

async function refreshCompletion(userId: string) {
  const { computeProfileCompletion } = await import("@/features/profile/lib/completion");
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, include: { skills: true, experiences: true, projects: true } });
  if (!profile) return;
  const hasResume = (await prisma.resumeVersion.count({ where: { resume: { userId } } })) > 0;
  const completion = computeProfileCompletion({ ...profile, skillsCount: profile.skills.length, sectorsCount: profile.sectors.length, experiencesCount: profile.experiences.length + profile.projects.length, hasResume });
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { completionScore: completion.score } });
}

export async function addExperience(input: z.input<typeof experienceSchema>): Promise<ActionResult> {
  return runAction("addExperience", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(experienceSchema, input);
    if (!parsed.ok) return parsed.result;
    const profileId = await profileIdFor(userId);
    if (!profileId) return fail("Profil introuvable.");
    const v = parsed.data;
    await prisma.experience.create({ data: { profileId, title: v.title, company: v.company, startDate: v.startDate ? new Date(v.startDate) : null, endDate: v.endDate ? new Date(v.endDate) : null, current: v.current ?? false, description: v.description || null, skills: v.skills ?? [] } });
    await refreshCompletion(userId);
    await trackActivity({ userId, type: "PROFILE_UPDATED", title: `Expérience ajoutée : ${v.title}` });
    revalidatePath("/settings/profile");
    return ok(undefined);
  });
}

export async function deleteExperience(id: string): Promise<ActionResult> {
  return runAction("deleteExperience", async () => {
    const userId = await requireUserId();
    const row = await prisma.experience.findFirst({ where: { id, profile: { userId } } });
    if (!row) return fail("Introuvable.");
    await prisma.experience.delete({ where: { id } });
    await refreshCompletion(userId);
    revalidatePath("/settings/profile");
    return ok(undefined);
  });
}

const educationSchema = z.object({
  title: z.string().trim().min(2).max(120),
  school: z.string().trim().min(1).max(120),
  level: z.enum(EducationLevel).nullable().optional(),
  startYear: z.number().int().min(1990).max(2040).nullable().optional(),
  endYear: z.number().int().min(1990).max(2045).nullable().optional(),
  current: z.boolean().optional(),
});

export async function addEducation(input: z.input<typeof educationSchema>): Promise<ActionResult> {
  return runAction("addEducation", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(educationSchema, input);
    if (!parsed.ok) return parsed.result;
    const profileId = await profileIdFor(userId);
    if (!profileId) return fail("Profil introuvable.");
    const v = parsed.data;
    await prisma.education.create({ data: { profileId, title: v.title, school: v.school, level: v.level ?? null, startYear: v.startYear ?? null, endYear: v.endYear ?? null, current: v.current ?? false } });
    revalidatePath("/settings/profile");
    return ok(undefined);
  });
}

export async function deleteEducation(id: string): Promise<ActionResult> {
  return runAction("deleteEducation", async () => {
    const userId = await requireUserId();
    const row = await prisma.education.findFirst({ where: { id, profile: { userId } } });
    if (!row) return fail("Introuvable.");
    await prisma.education.delete({ where: { id } });
    revalidatePath("/settings/profile");
    return ok(undefined);
  });
}

const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  url: z.string().trim().max(300).optional().or(z.literal("")),
  skills: z.array(z.string().trim().min(1).max(60)).max(15).optional(),
});

export async function addProject(input: z.input<typeof projectSchema>): Promise<ActionResult> {
  return runAction("addProject", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(projectSchema, input);
    if (!parsed.ok) return parsed.result;
    const profileId = await profileIdFor(userId);
    if (!profileId) return fail("Profil introuvable.");
    const v = parsed.data;
    await prisma.project.create({ data: { profileId, name: v.name, description: v.description || null, url: v.url || null, skills: v.skills ?? [] } });
    await refreshCompletion(userId);
    revalidatePath("/settings/profile");
    return ok(undefined);
  });
}

export async function deleteProject(id: string): Promise<ActionResult> {
  return runAction("deleteProject", async () => {
    const userId = await requireUserId();
    const row = await prisma.project.findFirst({ where: { id, profile: { userId } } });
    if (!row) return fail("Introuvable.");
    await prisma.project.delete({ where: { id } });
    await refreshCompletion(userId);
    revalidatePath("/settings/profile");
    return ok(undefined);
  });
}
