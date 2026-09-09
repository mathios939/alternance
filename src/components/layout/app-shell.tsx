import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { getRecentNotifications, getUnreadCounts } from "@/features/notifications/server/queries";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";

export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [counts, notifications, profile] = await Promise.all([
    getUnreadCounts(user.id),
    getRecentNotifications(user.id),
    prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { urgencyMode: true } }),
  ]);
  const isAdmin = user.role === "ADMIN";
  const urgencyMode = profile?.urgencyMode ?? false;
  return (
    <div className="flex min-h-screen">
      <AppSidebar badges={counts} isAdmin={isAdmin} urgencyMode={urgencyMode} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={{ name: user.name, email: user.email, image: user.image, role: user.role, plan: user.plan }} badges={counts} notifications={notifications} urgencyMode={urgencyMode} isAdmin={isAdmin} />
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageContainer({ children, className, wide = false }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={`mx-auto w-full ${wide ? "max-w-[1600px]" : "max-w-7xl"} px-4 py-6 sm:px-6 sm:py-8 ${className ?? ""}`}>{children}</div>;
}
