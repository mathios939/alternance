import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getVisitorContext } from "@/features/profile/server/visitor";
import { calculateMatchScore, calculateOpportunityScore } from "@/lib/matching";
import { jobCardInclude, toJobForMatching, visibleJobsWhere } from "@/features/jobs/server/queries";
import { companyCardInclude, toCompanyForMatching, visibleCompaniesWhere } from "@/features/companies/server/queries";

const schema = z.object({ type: z.enum(["jobs", "companies"]).default("jobs"), family: z.string().optional(), sector: z.string().optional() });

/** GeoJSON des offres ou des entreprises (avec score si un profil existe : compte ou visiteur). Sans compte. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  const { type, family, sector } = parsed.data;
  const { candidate } = await getVisitorContext();

  if (type === "jobs") {
    const jobs = await prisma.job.findMany({ where: { ...visibleJobsWhere(), latitude: { not: null }, longitude: { not: null }, ...(family ? { jobFamily: family } : {}), ...(sector ? { sector } : {}) }, include: jobCardInclude, take: 2000 });
    const features = jobs.map((j) => {
      const match = candidate ? calculateMatchScore(candidate, toJobForMatching(j)) : null;
      return { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [j.longitude!, j.latitude!] }, properties: { id: j.id, slug: j.slug, title: j.title, company: j.company.name, city: j.city, score: match?.total ?? null, level: match?.level ?? null, isDemo: j.isDemo } };
    });
    return NextResponse.json({ type: "FeatureCollection", features }, { headers: { "cache-control": "private, max-age=60" } });
  }
  const companies = await prisma.company.findMany({ where: { ...visibleCompaniesWhere(), latitude: { not: null }, longitude: { not: null }, ...(sector ? { sector } : {}), ...(family ? { jobFamilies: { has: family } } : {}) }, include: companyCardInclude, take: 2000 });
  const features = companies.map((c) => {
    const opp = candidate ? calculateOpportunityScore(candidate, toCompanyForMatching(c)) : null;
    return { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [c.longitude!, c.latitude!] }, properties: { id: c.id, slug: c.slug, title: c.name, company: c.city, city: c.city, score: opp?.score ?? null, level: opp?.level ?? null, jobs: c._count.jobs, isDemo: c.isDemo } };
  });
  return NextResponse.json({ type: "FeatureCollection", features }, { headers: { "cache-control": "private, max-age=60" } });
}
