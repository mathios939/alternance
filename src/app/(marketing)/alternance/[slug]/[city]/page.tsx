import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PRIORITY_CITIES, findCity } from "@/config/cities";
import { JOB_FAMILIES, JOB_FAMILY_KEYS, type JobFamilyKey } from "@/config/taxonomy";
import { siteConfig } from "@/config/site";
import { getSession } from "@/lib/auth/session";
import { getJobsForCityPage } from "@/features/jobs/server/queries";
import { JobCard } from "@/features/jobs/components/job-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export const revalidate = 3600;

const SEO_FAMILIES: JobFamilyKey[] = ["dev", "data", "cyber", "marketing", "communication", "sales", "hr", "accounting", "industrial", "logistics"];

export async function generateStaticParams() {
  return PRIORITY_CITIES.flatMap((c) => SEO_FAMILIES.map((job) => ({ slug: job, city: c.slug })));
}

export async function generateMetadata(props: PageProps<"/alternance/[slug]/[city]">): Promise<Metadata> {
  const { slug: job, city: citySlug } = await props.params;
  const city = findCity(citySlug);
  const family = JOB_FAMILIES[job as JobFamilyKey];
  if (!city || !family) return {};
  const title = `Alternance ${family.label} à ${city.name}`;
  const description = `Offres d'alternance en ${family.label.toLowerCase()} à ${city.name} (${city.department}), du Bac au Bac+5, avec score de compatibilité et entreprises à contacter.`;
  return { title, description, alternates: { canonical: `${siteConfig.url}/alternance/${job}/${city.slug}` }, openGraph: { title, description } };
}

export default async function JobCityPage(props: PageProps<"/alternance/[slug]/[city]">) {
  const { slug: job, city: citySlug } = await props.params;
  const city = findCity(citySlug);
  if (!city || !JOB_FAMILY_KEYS.includes(job as JobFamilyKey)) notFound();
  const family = JOB_FAMILIES[job as JobFamilyKey];
  const [session, data] = await Promise.all([getSession(), getJobsForCityPage(city.name, { family: job, limit: 24 })]);
  const others = SEO_FAMILIES.filter((f) => f !== job).slice(0, 6);
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Accueil</Link> <span aria-hidden>/</span> <Link href={`/alternance/${city.slug}`} className="hover:text-foreground">Alternance {city.name}</Link> <span aria-hidden>/</span> <span className="text-foreground">{family.label}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Alternance {family.label} à {city.name}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        {data.total} offre{data.total > 1 ? "s" : ""} en {family.label.toLowerCase()} à {city.name}. Les entreprises du secteur recherchent surtout : {family.keywords.slice(0, 6).join(", ")}.
      </p>
      <section className="mt-8">
        {data.jobs.length === 0 ? (
          <EmptyState title={`Pas d'offre ${family.label.toLowerCase()} à ${city.name} en ce moment`} description="Le Radar peut te proposer des entreprises du secteur à contacter en spontané." action={<Button asChild><Link href={session ? "/radar" : "/register"}>Ouvrir le Radar</Link></Button>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.jobs.map((j) => (
              <JobCard key={j.id} job={j} isAuthenticated={Boolean(session)} />
            ))}
          </div>
        )}
        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link href={`/jobs?city=${encodeURIComponent(city.name)}&families=${job}&radius=30`}>
              Chercher dans un rayon de 30 km <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
      <section className="mt-12">
        <h2 className="text-sm font-medium text-muted-foreground">Autres métiers à {city.name}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {others.map((f) => (
            <Link key={f} href={`/alternance/${f}/${city.slug}`} className="rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary">
              {JOB_FAMILIES[f].label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
