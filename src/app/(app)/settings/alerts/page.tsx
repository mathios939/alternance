import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getAlertPreference } from "@/features/notifications/server/queries";
import { AlertPreferencesForm } from "@/features/notifications/components/alert-preferences-form";

export const metadata: Metadata = { title: "Alertes" };

export default async function AlertsSettingsPage() {
  const user = await requireUser();
  const pref = await getAlertPreference(user.id);
  return <AlertPreferencesForm initial={{ emailEnabled: pref.emailEnabled, inAppEnabled: pref.inAppEnabled, pushEnabled: pref.pushEnabled, newJobs: pref.newJobs, highMatchJobs: pref.highMatchJobs, followUps: pref.followUps, newCompanies: pref.newCompanies, interviewReminders: pref.interviewReminders, digestFrequency: pref.digestFrequency, minMatchScore: pref.minMatchScore }} />;
}
