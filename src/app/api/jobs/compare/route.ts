import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCandidateContext } from "@/features/profile/server/queries";
import { getJobsByIds } from "@/features/jobs/server/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  if (ids.length === 0) return NextResponse.json({ items: [] });
  const session = await getSession();
  const ctx = session ? await getCandidateContext(session.id) : null;
  const items = await getJobsByIds(ids, { userId: session?.id, candidate: ctx?.candidate ?? null });
  return NextResponse.json({ items }, { headers: { "cache-control": "private, no-store" } });
}
