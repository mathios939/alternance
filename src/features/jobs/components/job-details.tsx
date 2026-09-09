"use client";

import Link from "next/link";
import { Building2, Car, Clock, ExternalLink, GraduationCap, Gift, MapPin, School, Timer, Euro, Wifi, CalendarDays, Layers, Users, Info, Eye } from "lucide-react";
import type { JobDetailData } from "@/features/jobs/types";
import { formatPublishedAgo, formatSalary, formatDuration, formatDistanceKm, formatDate } from "@/lib/format";
import { CONTRACT_TYPES, REMOTE_POLICIES, WORK_RHYTHMS, educationRangeLabel, SECTORS, type SectorKey, COMPANY_SIZES } from "@/config/taxonomy";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DataBadge } from "@/components/shared/data-badge";
import { CompanyLogo } from "./job-card";
import { MatchScoreBreakdown } from "./match-score";
import { JobActions } from "./job-actions";

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border bg-card/60 p-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function JobDetails({ job, isAuthenticated, layout = "pane" }: { job: JobDetailData; isAuthenticated: boolean; layout?: "pane" | "page" }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const sector = SECTORS[job.sector as SectorKey];
  const paragraphs = job.description.split(/\n{2,}/).filter(Boolean);
  const isPage = layout === "page";

  return (
    <article className={isPage ? "grid gap-8 lg:grid-cols-[1fr_340px]" : "space-y-6"} aria-labelledby="job-title">
      <div className="space-y-6">
        <header className="space-y-4">
          <div className="flex items-start gap-4">
            <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {job.isDemo ? <DataBadge kind="DEMO" /> : job.dataOrigin === "REAL" ? <DataBadge kind="REAL" /> : null}
                <Badge variant="muted">{CONTRACT_TYPES[job.contractType].label}</Badge>
              </div>
              <h1 id="job-title" className={isPage ? "mt-2 text-2xl font-semibold tracking-tight sm:text-3xl" : "mt-2 text-xl font-semibold tracking-tight"}>
                {job.title}
              </h1>
              <p className="mt-1 text-muted-foreground">
                <Link href={`/companies/${job.company.slug}`} className="font-medium text-foreground hover:underline">
                  {job.company.name}
                </Link>{" "}
                · {job.city}
                {job.department ? ` (${job.department})` : ""} · Publié {formatPublishedAgo(job.publishedAt)}
              </p>
            </div>
          </div>
          {!isPage ? <JobActions job={job} isAuthenticated={isAuthenticated} /> : null}
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact icon={MapPin} label="Lieu" value={<>{job.city}{job.distanceKm !== null ? <span className="text-muted-foreground"> · {formatDistanceKm(job.distanceKm)}</span> : null}</>} />
          <Fact icon={GraduationCap} label="Niveau" value={educationRangeLabel(job.educationLevelMin, job.educationLevelMax)} />
          <Fact icon={Wifi} label="Télétravail" value={REMOTE_POLICIES[job.remote].label} />
          <Fact icon={Timer} label="Durée" value={job.durationMonths ? `${job.durationMonths} mois` : "Non précisée"} />
          <Fact icon={Layers} label="Rythme" value={job.rhythm ? WORK_RHYTHMS[job.rhythm].short : "Non précisé"} />
          <Fact icon={Euro} label="Salaire" value={salary ?? "Grille légale"} />
          {job.startDate ? <Fact icon={CalendarDays} label="Début" value={formatDate(job.startDate, "MMMM yyyy")} /> : null}
          <Fact icon={Building2} label="Secteur" value={sector ? `${sector.emoji} ${sector.label}` : job.sector} />
          <Fact icon={Eye} label="Vues" value={job.viewCount.toLocaleString("fr-FR")} />
        </div>

        {job.travel.home || job.travel.school ? (
          <div className="rounded-xl border bg-card/60 p-3">
            <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
              <Car className="size-4 text-muted-foreground" aria-hidden /> Trajets estimés
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {job.travel.home ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Domicile → entreprise :</span> <strong>{formatDuration(job.travel.home.minutes)}</strong> <span className="text-xs text-muted-foreground">({formatDistanceKm(job.travel.home.distanceKm)}, {job.travel.home.quality === "estimated" ? "estimation" : "itinéraire"})</span>
                </p>
              ) : null}
              {job.travel.school ? (
                <p className="text-sm">
                  <School className="mr-1 inline size-3.5 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">École → entreprise :</span> <strong>{formatDuration(job.travel.school.minutes)}</strong> <span className="text-xs text-muted-foreground">({formatDistanceKm(job.travel.school.distanceKm)})</span>
                </p>
              ) : null}
            </div>
            {job.travel.home?.quality === "estimated" ? <p className="mt-1.5 text-[11px] text-muted-foreground">Estimation à vol d'oiseau. Configure un fournisseur d'itinéraires pour des temps réels.</p> : null}
          </div>
        ) : null}

        {job.match && !isPage ? (
          <section className="surface p-4" aria-label="Compatibilité">
            <MatchScoreBreakdown match={job.match} compact />
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Description</h2>
          <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </section>

        {job.missions.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold">Missions</h2>
            <ul className="mt-2 space-y-1.5">
              {job.missions.map((m) => (
                <li key={m} className="flex items-start gap-2 text-[15px]">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden /> {m}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="text-lg font-semibold">Compétences</h2>
          {job.skills.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.skills.map((s) => {
                const matched = job.match?.matchedSkills.includes(s.slug);
                const missing = job.match?.missingSkills.includes(s.slug);
                return (
                  <Badge key={s.slug} variant={matched ? "success" : missing ? "warning" : "muted"} className="px-2.5 py-1 text-sm font-normal">
                    {s.name}
                    {s.required ? <span className="ml-1 text-[10px] opacity-70">requis</span> : null}
                  </Badge>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucune compétence explicitement listée.</p>
          )}
          {job.requirements.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {job.requirements.map((r) => (
                <li key={r} className="flex items-start gap-2 text-[15px]">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden /> {r}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {job.benefits.length > 0 ? (
          <section>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <Gift className="size-4 text-muted-foreground" aria-hidden /> Avantages
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.benefits.map((b) => (
                <Badge key={b} variant="outline" className="px-2.5 py-1 text-sm font-normal">
                  {b}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        <Separator />
        <section className="text-sm text-muted-foreground">
          <p className="inline-flex items-center gap-1.5">
            <Info className="size-3.5" aria-hidden /> Source : {job.sourceName}
            {job.sourceUrl ? (
              <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                voir l'annonce d'origine <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </p>
          {job.otherSources.length > 0 ? <p className="mt-1">Également publiée sur : {job.otherSources.map((s) => s.name).join(", ")}.</p> : null}
          {job.expiresAt ? <p className="mt-1">Expire le {formatDate(job.expiresAt)}.</p> : null}
        </section>
      </div>

      {isPage ? (
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-4">
            <JobActions job={job} isAuthenticated={isAuthenticated} vertical />
          </div>
          {job.match ? (
            <div className="surface p-4">
              <MatchScoreBreakdown match={job.match} />
            </div>
          ) : (
            <div className="surface p-4 text-sm">
              <p className="font-medium">Ton score de compatibilité</p>
              <p className="mt-1 text-muted-foreground">Crée un profil pour savoir en 5 secondes si cette offre te correspond, et ce qu'il te manque.</p>
              <Link href={`/register?next=/jobs/${job.slug}`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                Créer mon profil gratuit →
              </Link>
            </div>
          )}
          <div className="surface p-4">
            <div className="flex items-center gap-3">
              <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{job.company.name}</p>
                <p className="text-xs text-muted-foreground">
                  {COMPANY_SIZES[job.company.size].label}
                  {job.companyDetail.headcount ? ` · ${job.companyDetail.headcount.toLocaleString("fr-FR")} salariés` : ""}
                </p>
              </div>
            </div>
            {job.companyDetail.description ? <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{job.companyDetail.description}</p> : null}
            <ul className="mt-3 space-y-1 text-sm">
              {job.companyDetail.hiresApprentices ? (
                <li className="inline-flex items-center gap-1.5">
                  <GraduationCap className="size-4 text-success" aria-hidden /> Accueille des alternants{job.companyDetail.apprenticeCountEstimate ? ` (~${job.companyDetail.apprenticeCountEstimate}/an)` : ""}
                </li>
              ) : null}
              <li className="inline-flex items-center gap-1.5">
                <Users className="size-4 text-muted-foreground" aria-hidden /> {job.companyDetail.contactsCount} contact{job.companyDetail.contactsCount > 1 ? "s" : ""} référencé{job.companyDetail.contactsCount > 1 ? "s" : ""}
              </li>
            </ul>
            <Link href={`/companies/${job.company.slug}`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Voir l'entreprise et ses {job.companyDetail.activeJobsCount} offre{job.companyDetail.activeJobsCount > 1 ? "s" : ""} →
            </Link>
          </div>
        </aside>
      ) : null}
    </article>
  );
}
