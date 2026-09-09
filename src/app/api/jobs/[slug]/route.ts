import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCandidateContext } from "@/features/profile/server/queries";
import { getJobDetail, incrementJobView } from "@/features/jobs/server/queries";

export async function GET(_request: Request, context: RouteContext<"/api/jobs/[slug]">) {
  const { slug } = await context.params;
  const session = await getSession();
  const ctx = session ? await getCandidateContext(session.id) : null;
  const job = await getJobDetail(slug, { userId: session?.id, candidate: ctx?.candidate ?? null, profile: ctx?.profile ?? null });
  if (!job) return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  void incrementJobView(job.id);
  return NextResponse.json(job, { headers: { "cache-control": "private, no-store" } });
}
