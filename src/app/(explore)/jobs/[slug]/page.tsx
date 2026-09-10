import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getVisitorContext } from "@/features/profile/server/visitor";
import { getJobBySlug, getJobDetail, incrementJobView } from "@/features/jobs/server/queries";
import { buildJobPostingJsonLd } from "@/features/seo/job-posting-jsonld";
import { JobDetails } from "@/features/jobs/components/job-details";
import { PageContainer } from "@/components/layout/app-shell";

export async function generateMetadata(props: PageProps<"/jobs/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const job = await getJobBySlug(slug);
  if (!job) return { title: "Offre introuvable" };
  const title = `${job.title} — ${job.company.name} (${job.city})`;
  const description = job.description.slice(0, 160).replace(/\s+/g, " ");
  return {
    title,
    description,
    alternates: { canonical: `${siteConfig.url}/jobs/${job.slug}` },
    openGraph: { title, description, type: "article", url: `${siteConfig.url}/jobs/${job.slug}` },
    robots: job.isDemo ? { index: false, follow: true } : undefined,
  };
}

/** Fiche offre : accessible sans compte, candidature via le lien officiel sans inscription. */
export default async function JobPage(props: PageProps<"/jobs/[slug]">) {
  const { slug } = await props.params;
  const [visitor, raw] = await Promise.all([getVisitorContext(), getJobBySlug(slug)]);
  if (!raw) notFound();
  const job = await getJobDetail(slug, { userId: visitor.userId, candidate: visitor.candidate, profile: visitor.ctx?.profile ?? null });
  if (!job) notFound();
  void incrementJobView(job.id);
  const jsonLd = raw.isDemo ? null : buildJobPostingJsonLd(raw);
  return (
    <PageContainer>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <Link href="/jobs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Toutes les offres
      </Link>
      <JobDetails job={job} isAuthenticated={visitor.isAuthenticated} hasProfile={visitor.hasProfile} layout="page" />
    </PageContainer>
  );
}
