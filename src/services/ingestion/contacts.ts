import { prisma } from "@/lib/db";
import { parsePersonLabel } from "./person-label";

export { parsePersonLabel } from "./person-label";
import type { NormalizedJob } from "@/services/job-sources/types";

/**
 * CONTACTS ISSUS DES OFFRES (Phase 11-12).
 * Seule source : le bloc « contact » publié par l'annonceur dans l'offre officielle.
 * Un contact nominatif n'est créé que si le libellé désigne clairement une personne ;
 * sinon le canal (e-mail / URL) reste attaché à l'offre comme « canal de candidature publié ».
 * Rien n'est deviné, aucun e-mail n'est construit.
 */
/**
 * Crée ou met à jour le contact nominatif publié dans une offre. Ne crée rien si le libellé
 * n'est pas une personne. Un contact ayant exercé son droit d'opposition n'est jamais recréé.
 */
export async function upsertJobPostingContact(job: NormalizedJob, ctx: { jobId: string; companyId: string; sourceLabel: string; now: Date; companyName: string | null; isPlaceholderCompany: boolean }): Promise<boolean> {
  if (ctx.isPlaceholderCompany) return false;
  const person = parsePersonLabel(job.applicationLabel, ctx.companyName);
  if (!person) return false;
  const context = `Contact publié dans l'offre « ${job.title} » (${ctx.sourceLabel})`;
  const existing = await prisma.contact.findFirst({
    where: {
      companyId: ctx.companyId,
      OR: [
        ...(job.applicationEmail ? [{ email: job.applicationEmail }] : []),
        { displayName: person.displayName },
        { firstName: person.firstName, lastName: person.lastName },
      ],
    },
    select: { id: true, optOutAt: true },
  });
  if (existing?.optOutAt) return false;
  const data = {
    firstName: person.firstName,
    lastName: person.lastName,
    displayName: person.displayName,
    jobTitle: person.jobTitle ?? "Contact recrutement (indiqué dans l'offre)",
    email: job.applicationEmail,
    contactUrl: job.applicationUrl,
    jobId: ctx.jobId,
    source: "JOB_POSTING" as const,
    sourceUrl: job.sourceUrl,
    publiclyAvailable: true,
    professionalContext: context,
    verifiedAt: ctx.now,
    confidenceScore: 75,
    dataOrigin: "REAL" as const,
    isDemo: false,
  };
  if (existing) {
    await prisma.contact.update({ where: { id: existing.id }, data });
    return false;
  }
  await prisma.contact.create({ data: { companyId: ctx.companyId, ...data } });
  return true;
}
