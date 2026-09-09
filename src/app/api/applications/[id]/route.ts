import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getApplicationDetail } from "@/features/applications/server/queries";

export async function GET(_request: Request, context: RouteContext<"/api/applications/[id]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await context.params;
  const detail = await getApplicationDetail(session.id, id);
  if (!detail) return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
  return NextResponse.json(detail, { headers: { "cache-control": "private, no-store" } });
}
