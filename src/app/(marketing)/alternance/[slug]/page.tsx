import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import { CITIES, SEO_CITIES, findCity } from "@/config/cities";
import { JOB_FAMILIES, type JobFamilyKey } from "@/config/taxonomy";
import { siteConfig } from "@/config/site";
import { getSession } from "@/lib/auth/session";
import { getJobsForCityPage } from "@/features/jobs/server/queries";
import { JobCard } from "@/features/jobs/components/job-card";
import { SearchBar } from "@/features/jobs/components/search-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export const revalidate = 3600;

export async function generateStaticParams() {
  return SEO_CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata(props: PageProps<"/alternance/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const city = findCity(slug);
  if (!city) return {};
  const title = `Alternance à ${city.name} : offres et entreprises qui recrutent`;
  const description = `Toutes les offres d'alternance à ${city.name} (${city.department}) : apprentissage et professionnalisation, tous niveaux, avec score de compatibilité et entreprises à contacter.`;
  return { title, description, alternates: { canonical: `${siteConfig.url}/alternance/${city.slug}` }, openGraph: { title, description, url: `${siteConfig.url}/alternance/${city.slug}` } };
}

export default async function CityPage(props: PageProps<"/alternance/[slug]">) {
  const { slug } = await props.params;
  const city = findCity(slug);
  if (!city) notFound();
  const [session, data] = await Promise.all([getSession(), getJobsForCityPage(city.name, { limit: 24 })]);
  const nearby = CITIES.filter((c) => c.departmentCode === city.departmentCode || (c.region === city.region && c.priority === 1)).filter((c) => c.slug !== city.slug).slice(0, 8);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Alternance à ${city.name}`,
    url: `${siteConfig.url}/alternance/${city.slug}`,
    about: { "@type": "City", name: city.name, containedInPlace: { "@type": "AdministrativeArea", name: city.region } },
    numberOfItems: data.total,
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Accueil</Link> <span aria-hidden>/</span> <Link href="/jobs" className="hover:text-foreground">Alternance</Link> <span aria-hidden>/</span> <span className="text-foreground">{city.name}</span>
      </nav>
      <div className="mt-4 max-w-3xl">
        <p className="inline-flex items-center gap-1 text-xs font-medium tracking-wide text-primary uppercase">
          <MapPin className="size-3.5" aria-hidden /> {city.department} · {city.region}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Alternance à {city.name}</h1>
        <p className="mt-3 text-muted-foreground">
          {data.total} offre{data.total > 1 ? "s" : ""} d'alternance actuellement à {city.name}, tous niveaux et tous secteurs. Crée ton profil pour voir ton score de compatibilité sur chacune et découvrir les entreprises qui recrutent sans annonce.
        </p>
      </div>
      <div className="mt-8 max-w-3xl">
        <SearchBar size="md" initialCity={city.name} />
      </div>

      {data.byFamily.length > 0 ? (
        <div className="mt-8 flex flex-wrap gap-2">
          {data.byFamily.map((f) => {
            const family = JOB_FAMILIES[f.family as JobFamilyKey];
            if (!family) return null;
            return (
              <Link key={f.family} href={`/alternance/${f.family}/${city.slug}`} className="rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary">
                {family.label} <span className="text-muted-foreground">({f.count})</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Dernières offres à {city.name}</h2>
        {data.jobs.length === 0 ? (
          <EmptyState className="mt-4" title={`Aucune offre active à ${city.name} pour le moment`} description="Élargis ta recherche aux villes voisines ou active une alerte pour être prévenu." action={<Button asChild><Link href={`/jobs?city=${encodeURIComponent(city.name)}&radius=50`}>Chercher dans un rayon de 50 km</Link></Button>} />
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.jobs.map((job) => (
              <JobCard key={job.id} job={job} isAuthenticated={Boolean(session)} />
            ))}
          </div>
        )}
        {data.total > data.jobs.length ? (
          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link href={`/jobs?city=${encodeURIComponent(city.name)}`}>
                Voir les {data.total} offres <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        ) : null}
      </section>

      <section className="mt-14 rounded-2xl border bg-card/60 p-6">
        <h2 className="text-lg font-semibold">Trouver une alternance à {city.name} : nos conseils</h2>
        <div className="mt-3 grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
          <p><strong className="text-foreground">Commence tôt.</strong> Les entreprises de {city.department} recrutent leurs alternants dès mars pour septembre. Candidate avant le pic de juin.</p>
          <p><strong className="text-foreground">Vise les PME.</strong> Une PME de {city.name} répond plus vite qu'un grand groupe et décide souvent en un seul entretien. Le Radar les identifie pour toi.</p>
          <p><strong className="text-foreground">Relance toujours.</strong> 7 jours sans réponse : une relance courte double tes chances de retour. Le suivi te le rappelle.</p>
        </div>
      </section>

      {nearby.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-sm font-medium text-muted-foreground">Alternance dans les villes voisines</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {nearby.map((c) => (
              <Link key={c.slug} href={`/alternance/${c.slug}`} className="rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
