import type { MetadataRoute } from "next";
import { SEO_CITIES } from "@/config/cities";
import { JOB_FAMILY_KEYS } from "@/config/taxonomy";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";

const SEO_FAMILIES = ["dev", "data", "cyber", "marketing", "communication", "sales", "hr", "accounting", "industrial", "logistics"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = ["", "/jobs", "/companies", "/tarifs", "/confidentialite", "/cgu", "/mentions-legales"].map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: p === "" || p === "/jobs" ? "daily" : "monthly", priority: p === "" ? 1 : 0.6 }));
  const cityPages: MetadataRoute.Sitemap = SEO_CITIES.map((c) => ({ url: `${base}/alternance/${c.slug}`, lastModified: now, changeFrequency: "daily", priority: c.priority === 1 ? 0.9 : 0.7 }));
  const jobCityPages: MetadataRoute.Sitemap = SEO_CITIES.filter((c) => c.priority === 1).flatMap((c) => SEO_FAMILIES.filter((f) => JOB_FAMILY_KEYS.includes(f)).map((f) => ({ url: `${base}/alternance/${f}/${c.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })));
  let companies: MetadataRoute.Sitemap = [];
  let jobs: MetadataRoute.Sitemap = [];
  try {
    const [companyRows, jobRows] = await Promise.all([
      prisma.company.findMany({ select: { slug: true, updatedAt: true }, take: 5000 }),
      prisma.job.findMany({ where: { isActive: true, canonicalJobId: null }, select: { slug: true, updatedAt: true }, take: 20000 }),
    ]);
    companies = companyRows.map((c) => ({ url: `${base}/companies/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly", priority: 0.6 }));
    jobs = jobRows.map((j) => ({ url: `${base}/jobs/${j.slug}`, lastModified: j.updatedAt, changeFrequency: "weekly", priority: 0.5 }));
  } catch {
    // Base indisponible au build : le sitemap statique reste valide
  }
  return [...staticPages, ...cityPages, ...jobCityPages, ...companies, ...jobs];
}
