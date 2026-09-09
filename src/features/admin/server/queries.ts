import "server-only";
import { prisma } from "@/lib/db";

export async function getAdminStats() {
  const since7d = new Date(Date.now() - 7 * 86_400_000);
  const [users, newUsers, jobs, activeJobs, companies, contacts, applications, reportsOpen, docs, sources] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.job.count(),
    prisma.job.count({ where: { isActive: true, canonicalJobId: null } }),
    prisma.company.count(),
    prisma.contact.count({ where: { optOutAt: null } }),
    prisma.application.count(),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.generatedDocument.count(),
    prisma.jobSource.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { users, newUsers, jobs, activeJobs, companies, contacts, applications, reportsOpen, docs, sources };
}

export async function listJobsAdmin(page = 1, q = "") {
  const pageSize = 30;
  const where = q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { company: { name: { contains: q, mode: "insensitive" as const } } }] } : {};
  const [items, total] = await Promise.all([
    prisma.job.findMany({ where, include: { company: { select: { name: true, slug: true } }, _count: { select: { applications: true, reports: true } } }, orderBy: { publishedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.job.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function listCompaniesAdmin(page = 1, q = "") {
  const pageSize = 30;
  const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};
  const [items, total] = await Promise.all([
    prisma.company.findMany({ where, include: { _count: { select: { jobs: true, contacts: true, applications: true } } }, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.company.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function listUsersAdmin(page = 1, q = "") {
  const pageSize = 30;
  const where = q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {};
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, name: true, email: true, role: true, plan: true, createdAt: true, lastActiveAt: true, onboardingCompletedAt: true, _count: { select: { applications: true } }, profile: { select: { city: true, targetJobTitle: true, completionScore: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function listReportsAdmin() {
  return prisma.report.findMany({ include: { user: { select: { email: true } }, job: { select: { title: true, slug: true } }, company: { select: { name: true, slug: true } }, contact: { select: { firstName: true, lastName: true, company: { select: { name: true } } } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 });
}

export async function listContactsAdmin(page = 1, q = "") {
  const pageSize = 40;
  const where = q ? { OR: [{ lastName: { contains: q, mode: "insensitive" as const } }, { company: { name: { contains: q, mode: "insensitive" as const } } }] } : {};
  const [items, total] = await Promise.all([
    prisma.contact.findMany({ where, include: { company: { select: { name: true, slug: true } } }, orderBy: [{ company: { name: "asc" } }, { lastName: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.contact.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
