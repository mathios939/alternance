import { NextResponse } from "next/server";
import { getVisitorContext } from "@/features/profile/server/visitor";
import { getJobsByIds } from "@/features/jobs/server/queries";

/** Offres à comparer (identifiants conservés dans le navigateur) : sans compte. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  if (ids.length === 0) return NextResponse.json({ items: [] });
  const visitor = await getVisitorContext();
  const items = await getJobsByIds(ids, { userId: visitor.userId, candidate: visitor.candidate });
  return NextResponse.json({ items }, { headers: { "cache-control": "private, no-store" } });
}
