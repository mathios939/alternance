import { NextResponse } from "next/server";
import { getVisitorContext } from "@/features/profile/server/visitor";
import { getJobDetail, incrementJobView } from "@/features/jobs/server/queries";

/** Détail d'une offre (panneau latéral) : sans compte, scores via le profil visiteur s'il existe. */
export async function GET(_request: Request, context: RouteContext<"/api/jobs/[slug]">) {
  const { slug } = await context.params;
  const visitor = await getVisitorContext();
  const job = await getJobDetail(slug, { userId: visitor.userId, candidate: visitor.candidate, profile: visitor.ctx?.profile ?? null });
  if (!job) return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  void incrementJobView(job.id);
  return NextResponse.json(job, { headers: { "cache-control": "private, no-store" } });
}
