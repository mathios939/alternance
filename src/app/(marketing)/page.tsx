import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getRecentJobs, getJobStats } from "@/features/jobs/server/queries";
import { getFeaturedCompanies } from "@/features/companies/server/queries";
import { JobCard } from "@/features/jobs/components/job-card";
import { CompanyCard } from "@/features/companies/components/company-card";
import { Hero } from "@/features/marketing/components/hero";
import { KeyFigures, HowItWorks, Features, Testimonials, CityLinks, FinalCta } from "@/features/marketing/components/sections";
import { SectionHeading } from "@/components/shared/section-heading";
import { siteConfig } from "@/config/site";

export default async function HomePage() {
  const [session, stats, jobs, companies] = await Promise.all([getSession(), getJobStats(), getRecentJobs(6), getFeaturedCompanies(6)]);
  const isAuthenticated = Boolean(session);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: { "@type": "SearchAction", target: `${siteConfig.url}/jobs?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero stats={stats} />
      <KeyFigures stats={stats} />
      <HowItWorks />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading title="Offres récentes" description="Les dernières alternances publiées. Connecte-toi pour voir ton score de compatibilité." href="/jobs" hrefLabel="Toutes les offres" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} isAuthenticated={isAuthenticated} />
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <SectionHeading title="Entreprises qui accueillent des alternants" description="Avec ou sans offre publiée : le Radar te dit qui contacter." href="/companies" hrefLabel="Toutes les entreprises" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <CompanyCard key={c.id} company={c} isAuthenticated={isAuthenticated} />
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/radar" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Découvrir l'Opportunity Radar <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
      <Testimonials />
      <Features />
      <CityLinks />
      <FinalCta isAuthenticated={isAuthenticated} />
    </>
  );
}
