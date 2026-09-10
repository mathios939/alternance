import type { Metadata } from "next";
import Link from "next/link";
import { Radar, Info, MapPin, Briefcase, Ruler, Sparkles } from "lucide-react";
import { z } from "zod";
import { CompanySize } from "@/generated/prisma/enums";
import { JOB_FAMILIES, type JobFamilyKey } from "@/config/taxonomy";
import { PLAN_LIMITS } from "@/config/plans";
import { getVisitorContext } from "@/features/profile/server/visitor";
import { getRadar } from "@/features/companies/server/queries";
import { CompanyCard } from "@/features/companies/components/company-card";
import { RadarFilters } from "@/features/radar/components/radar-filters";
import { GuestProfileForm } from "@/features/guest/components/guest-profile-form";
import { PersonalizeResults } from "@/features/guest/components/personalize-results";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Opportunity Radar", description: "Les entreprises qui pourraient t'accueillir en alternance, même sans offre publiée. Utilisable sans compte." };

const paramsSchema = z.object({
  radius: z.coerce.number().optional(),
  sectors: z.string().optional(),
  sizes: z.string().optional(),
  withoutJobs: z.string().optional(),
});

/**
 * Radar : accessible sans compte. Il a besoin d'une ville et d'un métier : profil du compte,
 * sinon profil visiteur (30 secondes, stocké dans le navigateur), sinon le formulaire s'affiche ici.
 */
export default async function RadarPage(props: PageProps<"/radar">) {
  const visitor = await getVisitorContext();
  const candidate = visitor.candidate;

  if (!candidate) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader eyebrow="Opportunity Radar" title="Les entreprises qui pourraient t'accueillir, même sans offre publiée" description="Le Radar classe les entreprises autour de toi par potentiel estimé pour ton profil. Indique ta ville et ton métier : 30 secondes, sans compte." />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="surface p-5 sm:p-6" aria-labelledby="radar-setup">
            <h2 id="radar-setup" className="inline-flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="size-5 text-primary" aria-hidden /> Lancer le Radar
            </h2>
            <div className="mt-4">
              <GuestProfileForm submitLabel="Lancer le Radar" />
            </div>
          </section>
          <aside className="space-y-4">
            <Alert variant="info">
              <Info />
              <AlertDescription>Le score de potentiel est une <strong>estimation</strong> fondée sur des règles explicites : proximité, métier, secteur, accueil d'alternants, recrutements en cours et taille. Il ne garantit rien, mais il t'aide à choisir qui contacter en premier.</AlertDescription>
            </Alert>
            <div className="surface p-4 text-sm">
              <p className="font-medium">Sans ville pour l'instant ?</p>
              <p className="mt-1 text-muted-foreground">Parcours l'annuaire des entreprises et filtre par ville, secteur ou taille.</p>
              <Button asChild variant="outline" size="sm" className="mt-3"><Link href="/companies">Voir les entreprises</Link></Button>
            </div>
          </aside>
        </div>
      </PageContainer>
    );
  }

  const raw = await props.searchParams;
  const p = paramsSchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const sizes = (p.sizes?.split(",") ?? []).filter((s): s is CompanySize => (Object.values(CompanySize) as string[]).includes(s));
  const plan = visitor.session?.plan ?? "FREE";
  const limit = PLAN_LIMITS[plan].radarResults;
  const radar = await getRadar({ userId: visitor.userId, candidate }, { limit, radiusKm: p.radius, sectors: p.sectors?.split(",").filter(Boolean), sizes, onlyWithoutJobs: p.withoutJobs === "true" });
  const family = candidate.jobFamily ? JOB_FAMILIES[candidate.jobFamily as JobFamilyKey]?.label : null;
  const hot = radar.items.filter((c) => c.opportunity?.level === "hot").length;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Opportunity Radar"
        title={`${radar.total} entreprise${radar.total > 1 ? "s" : ""} potentielle${radar.total > 1 ? "s" : ""}`}
        description="Les entreprises qui pourraient t'accueillir, même sans offre publiée. Classées par potentiel estimé pour ton profil."
        actions={visitor.ctx ? <Button asChild variant="outline"><Link href="/settings/profile">Ajuster mon profil</Link></Button> : <PersonalizeResults hasProfile size="default" label="Ajuster mes préférences" />}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="soft" className="gap-1.5 px-2.5 py-1 text-sm font-normal"><Briefcase aria-hidden /> {candidate.targetJobTitle ?? "Métier non renseigné"}{family ? ` · ${family}` : ""}</Badge>
        <Badge variant="soft" className="gap-1.5 px-2.5 py-1 text-sm font-normal"><MapPin aria-hidden /> {candidate.city ?? "Ville non renseignée"}</Badge>
        <Badge variant="soft" className="gap-1.5 px-2.5 py-1 text-sm font-normal"><Ruler aria-hidden /> {radar.radius} km</Badge>
        {hot > 0 ? <Badge variant="success" className="px-2.5 py-1 text-sm font-normal">{hot} cible{hot > 1 ? "s" : ""} prioritaire{hot > 1 ? "s" : ""}</Badge> : null}
        {!visitor.isAuthenticated ? <span className="text-xs text-muted-foreground">Préférences stockées dans ce navigateur.</span> : null}
      </div>
      <RadarFilters defaultRadius={candidate.maxRadiusKm} />
      <Alert variant="info">
        <Info />
        <AlertDescription>
          Le score de potentiel est une <strong>estimation</strong> fondée sur des règles explicites : proximité, métier, secteur, accueil d'alternants, recrutements en cours et taille. Il ne garantit rien, mais il t'aide à choisir qui contacter en premier.
        </AlertDescription>
      </Alert>
      {radar.items.length === 0 ? (
        <EmptyState icon={Radar} title="Aucune entreprise dans ce périmètre" description="Élargis le rayon ou retire un filtre. Tu peux aussi modifier ta ville." action={<Button asChild variant="outline"><Link href="/radar?radius=100">Chercher à 100 km</Link></Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {radar.items.map((c) => (
            <CompanyCard key={c.id} company={c} isAuthenticated={visitor.isAuthenticated} />
          ))}
        </div>
      )}
      {radar.total > radar.items.length ? (
        <p className="text-center text-sm text-muted-foreground">
          {radar.items.length} entreprises affichées sur {radar.total}. {plan === "FREE" ? "Le plan Premium étendra le Radar." : "Affine les filtres pour cibler."}
        </p>
      ) : null}
    </PageContainer>
  );
}
