import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppShell, PageContainer } from "@/components/layout/app-shell";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { Badge } from "@/components/ui/badge";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  const openReports = await prisma.report.count({ where: { status: "OPEN" } });
  return (
    <AppShell user={user}>
      <PageContainer wide className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Administration</h1>
          <Badge variant="destructive">Accès restreint</Badge>
        </div>
        <AdminNav openReports={openReports} />
        {children}
      </PageContainer>
    </AppShell>
  );
}
