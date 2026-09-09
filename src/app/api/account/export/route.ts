import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { profileInclude } from "@/features/profile/server/queries";

/** Export RGPD : toutes les données personnelles de l'utilisateur au format JSON. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = session.id;
  const [user, profile, resumes, applications, favorites, savedSearches, notifications, alertPreference, interviews, conversations, documents, activities, outreaches, dailyActions, reports] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, plan: true, role: true, createdAt: true, termsAcceptedAt: true, privacyAcceptedAt: true, marketingOptIn: true, onboardingCompletedAt: true } }),
    prisma.candidateProfile.findUnique({ where: { userId }, include: profileInclude }),
    prisma.resume.findMany({ where: { userId }, include: { versions: { select: { id: true, version: true, fileName: true, mimeType: true, fileSize: true, extractedText: true, analysis: true, createdAt: true } } } }),
    prisma.application.findMany({ where: { userId }, include: { events: true, job: { select: { title: true, slug: true } }, company: { select: { name: true, slug: true } } } }),
    prisma.favorite.findMany({ where: { userId }, include: { job: { select: { title: true, slug: true } }, company: { select: { name: true, slug: true } } } }),
    prisma.savedSearch.findMany({ where: { userId } }),
    prisma.notification.findMany({ where: { userId } }),
    prisma.alertPreference.findUnique({ where: { userId } }),
    prisma.interview.findMany({ where: { userId } }),
    prisma.aIConversation.findMany({ where: { userId }, include: { messages: true } }),
    prisma.generatedDocument.findMany({ where: { userId } }),
    prisma.activity.findMany({ where: { userId } }),
    prisma.outreach.findMany({ where: { userId } }),
    prisma.dailyAction.findMany({ where: { userId } }),
    prisma.report.findMany({ where: { userId } }),
  ]);
  const payload = { exportedAt: new Date().toISOString(), format: "alternance-os/v1", user, profile, resumes, applications, favorites, savedSearches, notifications, alertPreference, interviews, conversations, documents, activities, outreaches, dailyActions, reports };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="alternance-os-export-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "private, no-store" },
  });
}
