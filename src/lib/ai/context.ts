import "server-only";
import { prisma } from "@/lib/db";
import { calculateMatchScore, recommendBestContact } from "@/lib/matching";
import { getCandidateContext } from "@/features/profile/server/queries";
import { getTopMatches, toJobForMatching, jobCardInclude } from "@/features/jobs/server/queries";
import { getRadar } from "@/features/companies/server/queries";
import { getFollowUpRecommendations } from "@/features/applications/lib/follow-ups";
import { RESPONSE_STATUSES, SENT_STATUSES } from "@/features/applications/lib/status-machine";
import { EDUCATION_LEVELS, COMPANY_SIZES, SECTORS, type SectorKey } from "@/config/taxonomy";
import type { EducationLevel } from "@/generated/prisma/enums";
import type { CopilotContext } from "./context-types";

export type ContextRequest = {
  jobSlug?: string | null;
  companySlug?: string | null;
  applicationId?: string | null;
  resumeId?: string | null;
  includeResume?: boolean;
  includeTopJobs?: boolean;
  includeCompanies?: boolean;
  includeFollowUps?: boolean;
  includeInterviews?: boolean;
  includeStats?: boolean;
};

/** Détecte, dans une question libre, quelles données du compte sont utiles. */
export function detectContextNeeds(message: string): ContextRequest {
  const q = message.toLowerCase();
  return {
    includeTopJobs: /offre|poste|annonce|job|match|candidat|meilleur/.test(q),
    includeCompanies: /entreprise|contacter|spontan|radar|société|societe|boîte|boite/.test(q),
    includeFollowUps: /relanc|réponse|reponse|nouvelles|silence|attente/.test(q),
    includeInterviews: /entretien|interview|prépar|prepar|rendez/.test(q),
    includeStats: /pourquoi|marche|fonctionne|stat|taux|refus|résultat|resultat|bilan/.test(q),
    includeResume: /cv|curriculum|résumé|resume/.test(q),
  };
}

/**
 * Construit le contexte minimal pour une tâche IA : seules les sections demandées
 * sont chargées, et les textes sont tronqués. Ne transmet jamais l'email ni le mot de passe.
 */
export async function buildCopilotContext(userId: string, req: ContextRequest = {}): Promise<CopilotContext | null> {
  const ctx = await getCandidateContext(userId);
  if (!ctx) return null;
  const { profile, candidate } = ctx;
  const context: CopilotContext = {
    profile: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      targetJobTitle: profile.targetJobTitle,
      educationTitle: profile.educationTitle,
      educationLevel: profile.educationLevel ? EDUCATION_LEVELS[profile.educationLevel as EducationLevel].label : null,
      school: profile.school,
      city: profile.city,
      phone: profile.phone,
      startDate: profile.startDate ? profile.startDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : null,
      durationMonths: profile.durationMonths,
      rhythm: profile.rhythm,
      skills: profile.skills.map((s) => s.skill.name),
      bio: profile.bio,
      experiences: [...profile.experiences.map((e) => ({ title: e.title, company: e.company, description: e.description })), ...profile.projects.map((p) => ({ title: p.name, company: "Projet personnel", description: p.description }))].slice(0, 5),
      completion: ctx.completion.score,
    },
  };

  let applicationJobSlug: string | null = null;
  let applicationCompanySlug: string | null = null;
  if (req.applicationId) {
    const app = await prisma.application.findFirst({ where: { id: req.applicationId, userId }, include: { job: { select: { slug: true } }, company: { select: { slug: true } } } });
    if (app) {
      const days = app.appliedAt ? Math.floor((Date.now() - app.appliedAt.getTime()) / 86_400_000) : null;
      context.application = { status: app.status, appliedAt: app.appliedAt?.toLocaleDateString("fr-FR") ?? null, daysSinceApplied: days, followUpCount: app.followUpCount };
      applicationJobSlug = app.job?.slug ?? null;
      applicationCompanySlug = app.company.slug;
    }
  }

  const jobSlug = req.jobSlug ?? applicationJobSlug;
  if (jobSlug) {
    const job = await prisma.job.findUnique({ where: { slug: jobSlug }, include: jobCardInclude });
    if (job) {
      const match = calculateMatchScore(candidate, toJobForMatching(job));
      context.job = {
        id: job.id,
        slug: job.slug,
        title: job.title,
        companyName: job.company.name,
        city: job.city,
        skills: job.skills.map((s) => s.skill.name),
        missions: job.missions,
        requirements: job.requirements,
        description: job.description,
        matchScore: match.total,
        matchReasons: match.reasons.slice(0, 4).map((r) => r.label),
      };
      applicationCompanySlug ??= job.company.slug;
    }
  }

  const companySlug = req.companySlug ?? applicationCompanySlug;
  if (companySlug) {
    const company = await prisma.company.findUnique({ where: { slug: companySlug }, include: { contacts: { where: { optOutAt: null } } } });
    if (company) {
      const reco = recommendBestContact(company, { jobFamily: profile.jobFamily }, company.contacts);
      context.company = {
        name: company.name,
        description: company.description,
        sector: SECTORS[company.sector as SectorKey]?.label ?? company.sector,
        size: `${COMPANY_SIZES[company.size].label} (${COMPANY_SIZES[company.size].range})`,
        technologies: company.technologies,
        city: company.city,
        recommendedContact: reco ? { firstName: reco.contact.firstName, lastName: reco.contact.lastName, jobTitle: reco.contact.jobTitle } : null,
      };
    }
  }

  if (req.includeResume || req.resumeId) {
    const version = await prisma.resumeVersion.findFirst({
      where: { resume: { userId, ...(req.resumeId ? { id: req.resumeId } : {}) } },
      orderBy: [{ resume: { isDefault: "desc" } }, { createdAt: "desc" }],
      include: { resume: { select: { title: true } } },
    });
    if (version) {
      const analysis = version.analysis as { score?: number; improvements?: string[] } | null;
      context.resume = { title: version.resume.title, score: typeof analysis?.score === "number" ? analysis.score : null, excerpt: (version.extractedText ?? "").slice(0, 2500), improvements: analysis?.improvements };
    }
  }

  if (req.includeTopJobs) {
    const top = await getTopMatches({ userId, candidate }, { limit: 5 });
    context.topJobs = top.map((j) => ({ title: j.title, companyName: j.company.name, city: j.city, matchScore: j.match?.total ?? 0, slug: j.slug, reasons: j.match?.reasons.filter((r) => r.kind === "positive").slice(0, 2).map((r) => r.label) ?? [] }));
  }
  if (req.includeCompanies) {
    const radar = await getRadar({ userId, candidate }, { limit: 5 });
    context.companies = radar.items.map((c) => ({ name: c.name, city: c.city, opportunityScore: c.opportunity?.score ?? 0, slug: c.slug, reason: c.opportunity?.reasons[0]?.label ?? null }));
  }
  if (req.includeFollowUps) {
    const apps = await prisma.application.findMany({ where: { userId, archivedAt: null, status: { in: ["SENT", "TO_FOLLOW_UP"] } }, include: { company: { select: { name: true } }, job: { select: { title: true } } } });
    context.followUps = getFollowUpRecommendations(apps.map((a) => ({ id: a.id, status: a.status, appliedAt: a.appliedAt, lastFollowUpAt: a.lastFollowUpAt, followUpCount: a.followUpCount, followUpSnoozedUntil: a.followUpSnoozedUntil, companyName: a.company.name, jobTitle: a.job?.title ?? null }))).map((f) => ({ companyName: f.companyName, jobTitle: f.jobTitle, daysSinceApplied: f.daysSinceApplied }));
  }
  if (req.includeInterviews) {
    const interviews = await prisma.interview.findMany({ where: { userId, status: "SCHEDULED", scheduledAt: { gte: new Date() } }, include: { company: { select: { name: true } }, job: { select: { title: true } } }, orderBy: { scheduledAt: "asc" }, take: 3 });
    context.interviews = interviews.map((i) => ({ companyName: i.company.name, scheduledAt: i.scheduledAt.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }), jobTitle: i.job?.title ?? null }));
  }
  if (req.includeStats) {
    const [sent, responses, interviews] = await Promise.all([
      prisma.application.count({ where: { userId, status: { in: SENT_STATUSES } } }),
      prisma.application.count({ where: { userId, status: { in: RESPONSE_STATUSES } } }),
      prisma.interview.count({ where: { userId } }),
    ]);
    context.stats = { applicationsSent: sent, responses, responseRate: sent ? Math.round((responses / sent) * 100) : 0, interviews };
  }
  return context;
}
