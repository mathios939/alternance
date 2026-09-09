import type { Metadata } from "next";
import Link from "next/link";
import { Radar, Info, MapPin, Briefcase, Ruler } from "lucide-react";
import { z } from "zod";
import { CompanySize } from "@/generated/prisma/enums";
import { JOB_FAMILIES, type JobFamilyKey } from "@/config/taxonomy";
import { PLAN_LIMITS } from "@/config/plans";
import { requireUser } from "@/lib/auth/session";
import { getCandidateContext } from "@/features/profile/server/queries";
import { getRadar } from "@/features/companies/server/queries";
import { CompanyCard } from "@/features/companies/components/company-card";
import { RadarFilters } from "@/features/radar/components/radar-filters";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Opportunity Radar" };

const paramsSchema = z.object({
  radius: z.coerce.number().optional(),
  sectors: z.string().optional(),
  sizes: z.string().optional(),
  withoutJobs: z.string().optional(),
});

export default async function RadarPage(props: PageProps<"/radar">) {
  const user = await requireUser();
  const ctx = await getCandidateContext(user.id);
  if (!ctx) return null;
  const raw = await props.searchParams;
  const p = paramsSchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const sizes = (p.sizes?.split(",") ?? []).filter((s): s is CompanySize => (Object.values(CompanySize) as string[]).includes(s));
  const limit = PLAN_LIMITS[user.plan].radarResults;
  const radar = await getRadar({ userId: user.id, candidate: ctx.candidate }, { limit, radiusKm: p.radius, sectors: p.sectors?.split(",").filter(Boolean), sizes, onlyWithoutJobs: p.withoutJobs === "true" });
  const family = ctx.profile.jobFamily ? JOB_FAMILIES[ctx.profile.jobFamily as JobFamilyKey]?.label : null;
  const hot = radar.items.filter((c) => c.opportunity?.level === "hot").length;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Opportunity Radar"
        title={`${radar.total} entreprise${radar.total > 1 ? "s" : ""} potentielle${radar.total > 1 ? "s" : ""}`}
        description="Les entreprises qui pourraient t'accueillir, même sans offre publiée. Classées par potentiel estimé pour ton profil."
        actions={<Button asChild variant="outline"><Link href="/settings/profile">Ajuster mon profil</Link></Button>}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="soft" className="gap-1.5 px-2.5 py-1 text-sm font-normal"><Briefcase aria-hidden /> {ctx.profile.targetJobTitle ?? "Métier non renseigné"}{family ? ` · ${family}` : ""}</Badge>
        <Badge variant="soft" className="gap-1.5 px-2.5 py-1 text-sm font-normal"><MapPin aria-hidden /> {ctx.profile.city ?? "Ville non renseignée"}</Badge>
        <Badge variant="soft" className="gap-1.5 px-2.5 py-1 text-sm font-normal"><Ruler aria-hidden /> {radar.radius} km</Badge>
        {hot > 0 ? <Badge variant="success" className="px-2.5 py-1 text-sm font-normal">{hot} cible{hot > 1 ? "s" : ""} prioritaire{hot > 1 ? "s" : ""}</Badge> : null}
      </div>
      <RadarFilters defaultRadius={ctx.profile.maxRadiusKm} />
      <Alert variant="info">
        <Info />
        <AlertDescription>
          Le score de potentiel est une <strong>estimation</strong> fondée sur des règles explicites : proximité, métier, secteur, accueil d'alternants, recrutements en cours et taille. Il ne garantit rien, mais il t'aide à choisir qui contacter en premier.
        </AlertDescription>
      </Alert>
      {radar.items.length === 0 ? (
        <EmptyState icon={Radar} title="Aucune entreprise dans ce périmètre" description="Élargis le rayon ou retire un filtre. Tu peux aussi renseigner ta ville dans ton profil." action={<Button asChild variant="outline"><Link href="/radar?radius=100">Chercher à 100 km</Link></Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {radar.items.map((c) => (
            <CompanyCard key={c.id} company={c} />
          ))}
        </div>
      )}
      {radar.total > radar.items.length ? (
        <p className="text-center text-sm text-muted-foreground">
          {radar.items.length} entreprises affichées sur {radar.total}. {user.plan === "FREE" ? "Le plan Premium étendra le Radar." : "Affine les filtres pour cibler."}
        </p>
      ) : null}
    </PageContainer>
  );
}
