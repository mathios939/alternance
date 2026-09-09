import "server-only";
import { prisma } from "@/lib/db";

export async function getOutreaches(userId: string) {
  const rows = await prisma.outreach.findMany({
    where: { userId },
    include: {
      company: { select: { id: true, slug: true, name: true, logoUrl: true, city: true } },
      contact: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
      application: { select: { id: true, status: true } },
    },
    orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    company: r.company,
    contact: r.contact ? { id: r.contact.id, name: `${r.contact.firstName} ${r.contact.lastName}`, jobTitle: r.contact.jobTitle } : null,
    channel: r.channel,
    status: r.status,
    subject: r.subject,
    lastContactAt: r.lastContactAt?.toISOString() ?? null,
    nextFollowUpAt: r.nextFollowUpAt?.toISOString() ?? null,
    notes: r.notes,
    applicationId: r.application?.id ?? null,
    applicationStatus: r.application?.status ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export type OutreachRow = Awaited<ReturnType<typeof getOutreaches>>[number];
