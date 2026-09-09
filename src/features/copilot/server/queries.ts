import "server-only";
import { prisma } from "@/lib/db";

export async function getConversations(userId: string, limit = 20) {
  const rows = await prisma.aIConversation.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: limit, select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } } });
  return rows.map((r) => ({ id: r.id, title: r.title ?? "Nouvelle conversation", updatedAt: r.updatedAt.toISOString(), messages: r._count.messages }));
}

export async function getConversation(userId: string, id: string) {
  const conv = await prisma.aIConversation.findFirst({ where: { id, userId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!conv) return null;
  return { id: conv.id, title: conv.title ?? "Nouvelle conversation", messages: conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, provider: m.provider, createdAt: m.createdAt.toISOString() })) };
}

export async function getDocuments(userId: string, limit = 20) {
  const docs = await prisma.generatedDocument.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, kind: true, title: true, createdAt: true, provider: true } });
  return docs.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }));
}

export async function getDocument(userId: string, id: string) {
  const doc = await prisma.generatedDocument.findFirst({ where: { id, userId } });
  return doc ? { id: doc.id, kind: doc.kind, title: doc.title, content: doc.content, provider: doc.provider, model: doc.model, createdAt: doc.createdAt.toISOString(), applicationId: doc.applicationId } : null;
}

export async function getContextSummary(userId: string, params: { jobSlug?: string | null; companySlug?: string | null; applicationId?: string | null; interviewId?: string | null }) {
  const [job, company, application, interview] = await Promise.all([
    params.jobSlug ? prisma.job.findUnique({ where: { slug: params.jobSlug }, select: { title: true, company: { select: { name: true, slug: true } } } }) : null,
    params.companySlug ? prisma.company.findUnique({ where: { slug: params.companySlug }, select: { name: true } }) : null,
    params.applicationId ? prisma.application.findFirst({ where: { id: params.applicationId, userId }, select: { job: { select: { title: true, slug: true } }, company: { select: { name: true, slug: true } } } }) : null,
    params.interviewId ? prisma.interview.findFirst({ where: { id: params.interviewId, userId }, select: { company: { select: { name: true } }, job: { select: { title: true } } } }) : null,
  ]);
  const label = job ? `${job.title} · ${job.company.name}` : application ? `${application.job?.title ?? "Candidature spontanée"} · ${application.company.name}` : interview ? `Entretien · ${interview.company.name}${interview.job ? ` · ${interview.job.title}` : ""}` : company ? company.name : null;
  return { label };
}
