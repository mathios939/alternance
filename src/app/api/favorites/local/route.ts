import { NextResponse } from "next/server";
import { getVisitorContext } from "@/features/profile/server/visitor";
import { getJobsByIds } from "@/features/jobs/server/queries";
import { getCompaniesByIds } from "@/features/companies/server/queries";

const MAX = 100;
const parseIds = (value: string | null) => (value ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0 && s.length < 64).slice(0, MAX);

/**
 * Cartes des favoris sauvegardés SANS compte (identifiants conservés dans le navigateur).
 * Les scores utilisent le profil visiteur s'il existe. Aucune donnée personnelle n'est lue ni écrite.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobIds = parseIds(searchParams.get("jobs"));
  const companyIds = parseIds(searchParams.get("companies"));
  if (jobIds.length === 0 && companyIds.length === 0) return NextResponse.json({ jobs: [], companies: [] });
  const visitor = await getVisitorContext();
  const ctx = { userId: visitor.userId, candidate: visitor.candidate };
  const [jobs, companies] = await Promise.all([getJobsByIds(jobIds, ctx), getCompaniesByIds(companyIds, ctx)]);
  return NextResponse.json({ jobs, companies }, { headers: { "cache-control": "private, no-store" } });
}
