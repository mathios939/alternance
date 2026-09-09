import { PageContainer } from "@/components/layout/app-shell";
import { SettingsNav } from "@/features/settings/components/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <PageContainer className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Paramètres</h1>
        <p className="text-muted-foreground">Ton profil, tes alertes, tes données.</p>
      </div>
      <SettingsNav />
      {children}
    </PageContainer>
  );
}
