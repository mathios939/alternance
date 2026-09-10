import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { safeReturnTo } from "@/config/routes";
import { prisma } from "@/lib/db";
import { getGuestProfile } from "@/lib/guest/server";
import { guestProfileToProfileValues } from "@/lib/guest/candidate";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";

export const metadata: Metadata = { title: "Configurer mon assistant", robots: { index: false } };

export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const user = await requireUser({ allowIncompleteOnboarding: true });
  const params = await props.searchParams;
  // Destination demandée avant l'inscription (ex. une offre) : conservée jusqu'à la fin de l'onboarding.
  const next = safeReturnTo(params["next"], { exclude: ["/onboarding"] });
  const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { onboardingCompletedAt: true, name: true, profile: { select: { id: true } } } });
  // Un compte marqué « onboarding terminé » mais sans profil (ex. compte admin) doit pouvoir créer son profil,
  // sinon le tableau de bord le renvoie ici en boucle.
  if (fresh?.onboardingCompletedAt && fresh.profile) redirect(next);
  const firstName = fresh?.name?.split(" ")[0] ?? "";
  // Préférences saisies sans compte (profil visiteur) : reprises pour ne rien faire ressaisir.
  const guest = await getGuestProfile();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Configurons ton assistant{firstName ? `, ${firstName}` : ""}</h1>
        <p className="mt-2 text-muted-foreground">Moins de 3 minutes. Plus ton profil est précis, plus tes scores et recommandations le sont.{guest ? " Tes préférences saisies sans compte ont été reprises." : ""}</p>
      </div>
      <OnboardingWizard initial={{ ...(guest ? guestProfileToProfileValues(guest) : {}), firstName }} redirectTo={next} />
    </div>
  );
}
