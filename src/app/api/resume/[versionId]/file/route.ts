import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, context: RouteContext<"/api/resume/[versionId]/file">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { versionId } = await context.params;
  const version = await prisma.resumeVersion.findFirst({ where: { id: versionId, resume: { userId: session.id } }, select: { fileData: true, fileName: true, mimeType: true } });
  if (!version?.fileData) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  const safeName = (version.fileName ?? "cv").replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(version.fileData), {
    headers: {
      "content-type": version.mimeType ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${safeName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
