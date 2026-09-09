"use server";

import { revalidatePath } from "next/cache";
import { findCity } from "@/config/cities";
import { guessJobFamily, JOB_FAMILY_KEYS, type JobFamilyKey } from "@/config/taxonomy";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/lib/action";
import { normalizeSkillName } from "@/lib/skills";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";
import { trackActivity } from "@/features/activity/server/track";
import { computeProfileCompletion } from "@/features/profile/lib/completion";

/** Crée ou met à jour le profil candidat (onboarding et page profil). */
export async function saveProfile(input: ProfileInput, options?: { completeOnboarding?: boolean }): Promise<ActionResult<{ completion: number }>> {
  return runAction("saveProfile", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(profileSchema, input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;
    const city = findCity(v.city);
    const schoolCity = v.schoolCity ? findCity(v.schoolCity) : undefined;
    const jobFamily = (v.jobFamily && JOB_FAMILY_KEYS.includes(v.jobFamily as JobFamilyKey) ? v.jobFamily : guessJobFamily(v.targetJobTitle)) ?? null;

    // Compétences : normalisation + création des compétences inconnues
    const normalized = Array.from(new Map(v.skills.map((s) => normalizeSkillName(s)).map((s) => [s.slug, s])).values());
    const skillRecords = await Promise.all(
      normalized.map((s) =>
        prisma.skill.upsert({ where: { slug: s.slug }, update: {}, create: { slug: s.slug, name: s.name, category: "TECH", aliases: [] }, select: { id: true } }),
      ),
    );

    const data = {
      firstName: v.firstName,
      lastName: v.lastName || null,
      targetJobTitle: v.targetJobTitle,
      jobFamily,
      educationTitle: v.educationTitle || null,
      educationLevel: v.educationLevel,
      school: v.school || null,
      city: city?.name ?? v.city,
      postalCode: city?.postalCode ?? null,
      department: city?.department ?? null,
      region: city?.region ?? null,
      latitude: city?.lat ?? null,
      longitude: city?.lng ?? null,
      schoolCity: schoolCity?.name ?? (v.schoolCity || null),
      schoolLatitude: schoolCity?.lat ?? null,
      schoolLongitude: schoolCity?.lng ?? null,
      mobility: v.mobility,
      hasDrivingLicense: v.hasDrivingLicense,
      hasVehicle: v.hasVehicle,
      maxRadiusKm: v.maxRadiusKm,
      remotePreference: v.remotePreference,
      startDate: v.startDate ? new Date(v.startDate) : null,
      durationMonths: v.durationMonths,
      rhythm: v.rhythm,
      contractTypes: v.contractTypes,
      sectors: v.sectors,
      bio: v.bio || null,
      linkedinUrl: v.linkedinUrl || null,
      phone: v.phone || null,
      weeklyGoal: v.weeklyGoal ?? 20,
    };

    const profile = await prisma.candidateProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      include: { experiences: true, projects: true },
    });
    await prisma.userSkill.deleteMany({ where: { profileId: profile.id, skillId: { notIn: skillRecords.map((s) => s.id) } } });
    for (const s of skillRecords) {
      await prisma.userSkill.upsert({ where: { profileId_skillId: { profileId: profile.id, skillId: s.id } }, update: {}, create: { profileId: profile.id, skillId: s.id } });
    }
    const hasResume = (await prisma.resumeVersion.count({ where: { resume: { userId } } })) > 0;
    const completion = computeProfileCompletion({
      ...profile,
      skillsCount: skillRecords.length,
      sectorsCount: v.sectors.length,
      experiencesCount: profile.experiences.length + profile.projects.length,
      hasResume,
    });
    await prisma.candidateProfile.update({ where: { id: profile.id }, data: { completionScore: completion.score } });

    if (options?.completeOnboarding) {
      await prisma.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date(), name: v.firstName } });
      await prisma.alertPreference.upsert({ where: { userId }, update: {}, create: { userId } });
      await prisma.notification.create({
        data: { userId, type: "SYSTEM", title: `Bienvenue ${v.firstName} 👋`, body: "Ton profil est prêt. Ta première mission t'attend sur le tableau de bord.", href: "/dashboard" },
      });
    }
    await trackActivity({ userId, type: "PROFILE_UPDATED", title: `Profil ${options?.completeOnboarding ? "créé" : "mis à jour"} (${completion.score} %)` });
    revalidatePath("/dashboard");
    revalidatePath("/settings/profile");
    return ok({ completion: completion.score });
  });
}

export async function toggleUrgencyMode(enabled: boolean): Promise<ActionResult> {
  return runAction("toggleUrgencyMode", async () => {
    const userId = await requireUserId();
    const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return fail("Profil introuvable.");
    await prisma.candidateProfile.update({ where: { id: profile.id }, data: { urgencyMode: enabled, weeklyGoal: enabled ? 30 : 20 } });
    revalidatePath("/dashboard");
    revalidatePath("/urgence");
    return ok(undefined);
  });
}
