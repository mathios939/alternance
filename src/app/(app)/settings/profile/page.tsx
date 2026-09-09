import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getCandidateContext } from "@/features/profile/server/queries";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import { ProfileExtras } from "@/features/settings/components/profile-extras";
import { UrgencyToggle } from "@/features/settings/components/urgency-toggle";
import { Progress } from "@/components/ui/progress";
import type { ProfileValues } from "@/lib/validation/profile";

export const metadata: Metadata = { title: "Profil candidat" };

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const ctx = await getCandidateContext(user.id);
  if (!ctx) return null;
  const p = ctx.profile;
  const initial: Partial<ProfileValues> = {
    firstName: p.firstName,
    lastName: p.lastName ?? "",
    targetJobTitle: p.targetJobTitle ?? "",
    jobFamily: p.jobFamily,
    educationTitle: p.educationTitle ?? "",
    educationLevel: p.educationLevel,
    school: p.school ?? "",
    schoolCity: p.schoolCity ?? "",
    city: p.city ?? "",
    mobility: p.mobility,
    hasDrivingLicense: p.hasDrivingLicense,
    hasVehicle: p.hasVehicle,
    maxRadiusKm: p.maxRadiusKm,
    remotePreference: p.remotePreference,
    startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
    durationMonths: p.durationMonths,
    rhythm: p.rhythm,
    contractTypes: p.contractTypes,
    skills: p.skills.map((s) => s.skill.name),
    sectors: p.sectors,
    bio: p.bio ?? "",
    linkedinUrl: p.linkedinUrl ?? "",
    phone: p.phone ?? "",
    weeklyGoal: p.weeklyGoal,
  };
  return (
    <div className="space-y-8">
      <div className="surface flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Profil complété à {ctx.completion.score} %</p>
          <Progress value={ctx.completion.score} className="mt-2 max-w-sm" />
          {ctx.completion.missing.length ? <p className="mt-2 text-xs text-muted-foreground">Il manque : {ctx.completion.missing.slice(0, 4).map((m) => m.label.toLowerCase()).join(", ")}.</p> : <p className="mt-2 text-xs text-success">Profil complet, bravo.</p>}
        </div>
        <UrgencyToggle enabled={p.urgencyMode} weeklyGoal={p.weeklyGoal} />
      </div>
      <ProfileExtras experiences={p.experiences} educations={p.educations} projects={p.projects} />
      <div>
        <h2 className="mb-4 text-lg font-semibold">Critères de recherche</h2>
        <OnboardingWizard initial={initial} mode="edit" />
      </div>
    </div>
  );
}
