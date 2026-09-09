import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Building2, ExternalLink, Globe, GraduationCap, MapPin, Users, Calendar, Cpu } from "lucide-react";
import { siteConfig } from "@/config/site";
import { COMPANY_SIZES, JOB_FAMILIES, SECTORS, type JobFamilyKey, type SectorKey } from "@/config/taxonomy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recommendBestContact } from "@/lib/matching";
import { getCandidateContext } from "@/features/profile/server/queries";
import { getCompanyBySlug, getSimilarCompanies, toCompanyCard } from "@/features/companies/server/queries";
import { toJobCard } from "@/features/jobs/server/queries";
import { JobCard } from "@/features/jobs/components/job-card";
import { CompanyCard } from "@/features/companies/components/company-card";
import { CompanyLogo } from "@/features/jobs/components/job-card";
import { ContactCard } from "@/features/companies/components/contact-card";
import { OpportunityReasons, OpportunityScoreBadge } from "@/features/companies/components/opportunity-score";
import { SpontaneousApplication } from "@/features/companies/components/spontaneous-application";
import { ReportDialog } from "@/features/reports/components/report-dialog";
import { PageContainer } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataBadge } from "@/components/shared/data-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { formatDistanceKm } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/companies/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const company = await getCompanyBySlug(slug);
  if (!company) return { title: "Entreprise introuvable" };
  const title = `${company.name} : alternance à ${company.city}`;
  const description = company.description?.slice(0, 160) ?? `Offres d'alternance et contacts chez ${company.name} (${company.city}).`;
  return { title, description, alternates: { canonical: `${siteConfig.url}/companies/${company.slug}` }, openGraph: { title, description }, robots: company.isDemo ? { index: false } : undefined };
}

function buildAngle(company: { name: string; size: string; technologies: string[]; jobFamilies: string[]; hiresApprentices: boolean }, candidate: { targetJobTitle: string | null; skills: string[] } | null): string {
  const shared = candidate ? company.technologies.filter((t) => candidate.skills.includes(t)) : [];
  if (shared.length) return `Mets en avant ${shared.slice(0, 3).map((s) => s.replace(/-/g, " ")).join(", ")} : ce sont des technologies que ${company.name} utilise et que tu maîtrises.`;
  if (company.hiresApprentices) return `${company.name} accueille régulièrement des alternants : présente-toi comme un profil ${candidate?.targetJobTitle?.toLowerCase() ?? "motivé"} prêt à s'intégrer vite, et propose un rythme précis.`;
  return `${company.name} n'a pas d'offre publiée : propose une mission concrète que tu pourrais prendre en charge, plutôt qu'une demande générique.`;
}

export default async function CompanyPage(props: PageProps<"/companies/[slug]">) {
  const { slug } = await props.params;
  const [session, company] = await Promise.all([getSession(), getCompanyBySlug(slug)]);
  if (!company) notFound();
  const ctx = session ? await getCandidateContext(session.id) : null;
  const userCtx = { userId: session?.id, candidate: ctx?.candidate ?? null };
  const [similar, favorite, application, resume] = await Promise.all([
    getSimilarCompanies(company, userCtx),
    session ? prisma.favorite.findFirst({ where: { userId: session.id, companyId: company.id } }) : null,
    session ? prisma.application.findFirst({ where: { userId: session.id, companyId: company.id, archivedAt: null } }) : null,
    session ? prisma.resume.findFirst({ where: { userId: session.id }, orderBy: { isDefault: "desc" } }) : null,
  ]);
  const card = toCompanyCard(company, userCtx, { favorites: new Set(favorite ? [company.id] : []), applications: new Set(application ? [company.id] : []) });
  const jobIds = company.jobs.map((j) => j.id);
  const [favs, apps] = session ? await Promise.all([prisma.favorite.findMany({ where: { userId: session.id, jobId: { in: jobIds } } }), prisma.application.findMany({ where: { userId: session.id, jobId: { in: jobIds }, archivedAt: null } })]) : [[], []];
  const enrichment = { favorites: new Map(favs.map((f) => [f.jobId!, f.collection])), applications: new Map(apps.map((a) => [a.jobId!, { id: a.id, status: a.status }])) };
  const jobs = company.jobs.map((j) => toJobCard(j, userCtx, enrichment));
  const recommendation = recommendBestContact(company, { jobFamily: ctx?.profile.jobFamily ?? null }, company.contacts);
  const sector = SECTORS[company.sector as SectorKey];
  const angle = buildAngle(company, ctx ? { targetJobTitle: ctx.profile.targetJobTitle, skills: ctx.candidate.skills } : null);

  return (
    <PageContainer className="space-y-8">
      <Link href="/companies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Toutes les entreprises
      </Link>

      <header className="surface p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {company.isDemo ? <DataBadge kind="DEMO" /> : <DataBadge kind="REAL" />}
              {sector ? <Badge variant="muted">{sector.emoji} {sector.label}</Badge> : null}
              <Badge variant="muted">{COMPANY_SIZES[company.size].label} · {COMPANY_SIZES[company.size].range}</Badge>
              {company.hiresApprentices ? <Badge variant="success"><GraduationCap aria-hidden /> Accueille des alternants</Badge> : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{company.name}</h1>
            <p className="mt-1 inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden /> {company.city}{company.department ? ` (${company.department})` : ""}{card.distanceKm !== null ? ` · ${formatDistanceKm(card.distanceKm)}` : ""}</span>
              {company.headcount ? <span className="inline-flex items-center gap-1"><Users className="size-4" aria-hidden /> {company.headcount.toLocaleString("fr-FR")} salariés</span> : null}
              {company.foundedYear ? <span className="inline-flex items-center gap-1"><Calendar className="size-4" aria-hidden /> Créée en {company.foundedYear}</span> : null}
            </p>
            {company.description ? <p className="mt-4 max-w-3xl text-[15px] leading-relaxed">{company.description}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {company.website ? (
                <Button asChild variant="outline" size="sm">
                  <a href={company.website} target="_blank" rel="noopener noreferrer"><Globe /> Site web <ExternalLink /></a>
                </Button>
              ) : null}
              {company.careersUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={company.careersUrl} target="_blank" rel="noopener noreferrer"><Briefcase /> Page carrières <ExternalLink /></a>
                </Button>
              ) : null}
              <ReportDialog target={{ companyId: company.id }} kind="company" />
            </div>
          </div>
          <div className="w-full space-y-3 md:w-72">
            {card.opportunity ? (
              <div className="rounded-xl border bg-card/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Potentiel pour toi</p>
                  <OpportunityScoreBadge opportunity={card.opportunity} />
                </div>
                <div className="mt-3"><OpportunityReasons opportunity={card.opportunity} /></div>
                <p className="mt-3 text-[11px] text-muted-foreground">Estimation basée sur des règles explicites (proximité, secteur, alternants, recrutements). Pas une garantie.</p>
              </div>
            ) : null}
            <SpontaneousApplication
              company={{ id: company.id, name: company.name, slug: company.slug, size: company.size }}
              recommendedContact={recommendation ? { name: `${recommendation.contact.firstName} ${recommendation.contact.lastName}`, jobTitle: recommendation.contact.jobTitle, reason: recommendation.reason } : null}
              angle={angle}
              resumeTitle={resume?.title ?? null}
              hasApplication={Boolean(application)}
              isAuthenticated={Boolean(session)}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section>
            <SectionHeading title={`Offres ouvertes (${jobs.length})`} description={jobs.length === 0 ? "Aucune offre publiée : c'est le moment d'une candidature spontanée." : undefined} />
            {jobs.length === 0 ? (
              <EmptyState compact className="mt-4" icon={Briefcase} title="Pas d'offre d'alternance en ce moment" description="Les entreprises qui accueillent des alternants recrutent souvent hors annonce." />
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} isAuthenticated={Boolean(session)} />
                ))}
              </div>
            )}
          </section>

          <section id="contacts">
            <SectionHeading title="Contacts publics" description="Uniquement des informations professionnelles issues de sources publiques. Chaque personne peut demander son retrait." />
            {company.contacts.length === 0 ? (
              <EmptyState compact className="mt-4" icon={Users} title="Aucun contact vérifié disponible" description="Nous n'inventons jamais de coordonnées. Passe par la page carrières ou le formulaire du site." />
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {recommendation ? <ContactCard contact={recommendation.contact as never} recommended reason={recommendation.reason} className="md:col-span-2" /> : null}
                {company.contacts.filter((c) => c.id !== recommendation?.contact.id).map((c) => (
                  <ContactCard key={c.id} contact={c} />
                ))}
              </div>
            )}
          </section>

          {similar.length > 0 ? (
            <section>
              <SectionHeading title="Entreprises similaires" />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {similar.map((c) => (
                  <CompanyCard key={c.id} company={c} variant="compact" isAuthenticated={Boolean(session)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="surface p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold"><Briefcase className="size-4 text-muted-foreground" aria-hidden /> Métiers recrutés</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {company.jobFamilies.map((f) => (
                <Badge key={f} variant="muted" className="font-normal">{JOB_FAMILIES[f as JobFamilyKey]?.label ?? f}</Badge>
              ))}
            </div>
          </div>
          {company.technologies.length > 0 ? (
            <div className="surface p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold"><Cpu className="size-4 text-muted-foreground" aria-hidden /> Technologies & outils</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {company.technologies.map((t) => {
                  const known = ctx?.candidate.skills.includes(t);
                  return <Badge key={t} variant={known ? "success" : "muted"} className="font-normal capitalize">{t.replace(/-/g, " ")}</Badge>;
                })}
              </div>
              {ctx ? <p className="mt-2 text-[11px] text-muted-foreground">En vert : dans ton profil.</p> : null}
            </div>
          ) : null}
          <div className="surface p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4 text-muted-foreground" aria-hidden /> Implantations</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {company.locations.map((l) => (
                <li key={l.id} className="flex items-center justify-between">
                  <span>{l.label}</span>
                  <span className="text-muted-foreground">{l.city}</span>
                </li>
              ))}
            </ul>
          </div>
          {company.apprenticeCountEstimate ? (
            <div className="surface p-4 text-sm">
              <p className="font-semibold">Alternants accueillis</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">~{company.apprenticeCountEstimate}<span className="text-sm font-normal text-muted-foreground"> / an</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Estimation d'après les informations publiques.</p>
            </div>
          ) : null}
        </aside>
      </div>
    </PageContainer>
  );
}
