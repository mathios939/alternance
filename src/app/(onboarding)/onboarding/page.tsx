import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";

export const metadata: Metadata = { title: "Configurer mon assistant", robots: { index: false } };

export default async function OnboardingPage() {
  const user = await requireUser({ allowIncompleteOnboarding: true });
  const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { onboardingCompletedAt: true, name: true } });
  if (fresh?.onboardingCompletedAt) redirect("/dashboard");
  const firstName = fresh?.name?.split(" ")[0] ?? "";
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Configurons ton assistant{firstName ? `, ${firstName}` : ""}</h1>
        <p className="mt-2 text-muted-foreground">Moins de 3 minutes. Plus ton profil est précis, plus tes scores et recommandations le sont.</p>
      </div>
      <OnboardingWizard initial={{ firstName }} />
    </div>
  );
}
