import "server-only";
import { prisma } from "@/lib/db";
import type { ResumeAnalysis } from "@/features/resume/lib/analyze";
import { compareResumeToJob, type ResumeJobComparison } from "@/features/resume/lib/compare";
import { getProfile } from "@/features/profile/server/queries";

export type ResumeSummary = {
  id: string;
  title: string;
  isDefault: boolean;
  updatedAt: string;
  versionCount: number;
  latest: { id: string; version: number; fileName: string | null; mimeType: string | null; fileSize: number | null; createdAt: string; score: number | null } | null;
};

export async function getResumes(userId: string): Promise<ResumeSummary[]> {
  const resumes = await prisma.resume.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    include: { versions: { orderBy: { version: "desc" }, take: 1, select: { id: true, version: true, fileName: true, mimeType: true, fileSize: true, createdAt: true, analysis: true } }, _count: { select: { versions: true } } },
  });
  return resumes.map((r) => {
    const v = r.versions[0];
    const analysis = v?.analysis as { score?: number } | null;
    return {
      id: r.id,
      title: r.title,
      isDefault: r.isDefault,
      updatedAt: r.updatedAt.toISOString(),
      versionCount: r._count.versions,
      latest: v ? { id: v.id, version: v.version, fileName: v.fileName, mimeType: v.mimeType, fileSize: v.fileSize, createdAt: v.createdAt.toISOString(), score: typeof analysis?.score === "number" ? analysis.score : null } : null,
    };
  });
}

export async function getResumeLatestVersion(userId: string, resumeId: string) {
  const version = await prisma.resumeVersion.findFirst({ where: { resume: { id: resumeId, userId } }, orderBy: { version: "desc" } });
  if (!version) return null;
  return {
    id: version.id,
    version: version.version,
    fileName: version.fileName,
    mimeType: version.mimeType,
    fileSize: version.fileSize,
    createdAt: version.createdAt.toISOString(),
    extractedText: version.extractedText,
    analysis: (version.analysis as ResumeAnalysis | null) ?? null,
    hasFile: Boolean(version.fileData),
  };
}

export async function getResumeVersions(userId: string, resumeId: string) {
  return prisma.resumeVersion.findMany({ where: { resume: { id: resumeId, userId } }, orderBy: { version: "desc" }, select: { id: true, version: true, fileName: true, createdAt: true, analysis: true } });
}

/** Compare le CV (texte + profil) à une offre : jamais d'invention, seulement des mises en avant. */
export async function getResumeJobComparison(userId: string, resumeId: string, jobSlug: string): Promise<{ job: { id: string; slug: string; title: string; companyName: string }; comparison: ResumeJobComparison } | null> {
  const [version, job, profile] = await Promise.all([
    prisma.resumeVersion.findFirst({ where: { resume: { id: resumeId, userId } }, orderBy: { version: "desc" }, select: { extractedText: true } }),
    prisma.job.findUnique({ where: { slug: jobSlug }, include: { company: { select: { name: true } }, skills: { include: { skill: { select: { slug: true } } } } } }),
    getProfile(userId),
  ]);
  if (!job) return null;
  const text = version?.extractedText ?? "";
  const comparison = compareResumeToJob(
    { text, skills: profile?.skills.map((s) => s.skill.slug) ?? [], experiences: profile?.experiences.map((e) => ({ title: `${e.title} — ${e.company}`, description: e.description })) ?? [] },
    { title: job.title, description: job.description, skills: job.skills.map((s) => s.skill.slug), missions: job.missions, requirements: job.requirements },
  );
  return { job: { id: job.id, slug: job.slug, title: job.title, companyName: job.company.name }, comparison };
}
