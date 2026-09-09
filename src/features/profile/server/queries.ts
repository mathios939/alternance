import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import type { CandidateForMatching } from "@/lib/matching";
import { tokenize } from "@/lib/text/normalize";
import { computeProfileCompletion } from "@/features/profile/lib/completion";

export const profileInclude = {
  skills: { include: { skill: true } },
  educations: { orderBy: { startYear: "desc" as const } },
  experiences: { orderBy: { startDate: "desc" as const } },
  projects: true,
  languages: true,
} as const;

export const getProfile = cache(async (userId: string) => {
  return prisma.candidateProfile.findUnique({ where: { userId }, include: profileInclude });
});

export type FullProfile = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

function monthsBetween(start: Date | null, end: Date | null): number {
  if (!start) return 0;
  const e = end ?? new Date();
  return Math.max(0, Math.round((e.getTime() - start.getTime()) / (30.44 * 86_400_000)));
}

/** Projette le profil complet vers la vue minimale utilisée par le Match Score. */
export function toCandidateForMatching(profile: FullProfile): CandidateForMatching {
  const experienceMonths = profile.experiences.reduce((sum, e) => sum + monthsBetween(e.startDate, e.current ? null : e.endDate), 0);
  const experienceKeywords = Array.from(
    new Set(profile.experiences.flatMap((e) => tokenize(`${e.title} ${e.skills.join(" ")}`)).concat(profile.projects.flatMap((p) => tokenize(p.name)))),
  );
  return {
    educationLevel: profile.educationLevel,
    jobFamily: profile.jobFamily,
    targetJobTitle: profile.targetJobTitle,
    skills: profile.skills.map((s) => s.skill.slug),
    latitude: profile.latitude,
    longitude: profile.longitude,
    city: profile.city,
    department: profile.department,
    region: profile.region,
    maxRadiusKm: profile.maxRadiusKm,
    mobility: profile.mobility,
    hasDrivingLicense: profile.hasDrivingLicense,
    hasVehicle: profile.hasVehicle,
    remotePreference: profile.remotePreference,
    rhythm: profile.rhythm,
    durationMonths: profile.durationMonths,
    startDate: profile.startDate,
    contractTypes: profile.contractTypes,
    sectors: profile.sectors,
    experienceMonths,
    experienceKeywords,
  };
}

/** Profil + vue matching + complétion, en un seul appel (mis en cache par requête). */
export const getCandidateContext = cache(async (userId: string) => {
  const profile = await getProfile(userId);
  if (!profile) return null;
  const resumeCount = await prisma.resume.count({ where: { userId, versions: { some: {} } } });
  const completion = computeProfileCompletion({
    firstName: profile.firstName,
    targetJobTitle: profile.targetJobTitle,
    educationLevel: profile.educationLevel,
    educationTitle: profile.educationTitle,
    school: profile.school,
    city: profile.city,
    latitude: profile.latitude,
    startDate: profile.startDate,
    durationMonths: profile.durationMonths,
    rhythm: profile.rhythm,
    skillsCount: profile.skills.length,
    sectorsCount: profile.sectors.length,
    experiencesCount: profile.experiences.length + profile.projects.length,
    hasResume: resumeCount > 0,
    bio: profile.bio,
    linkedinUrl: profile.linkedinUrl,
  });
  return { profile, candidate: toCandidateForMatching(profile), completion, hasResume: resumeCount > 0 };
});

export type CandidateContext = NonNullable<Awaited<ReturnType<typeof getCandidateContext>>>;
