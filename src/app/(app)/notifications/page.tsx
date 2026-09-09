import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listNotifications } from "@/features/notifications/server/queries";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const { items, total } = await listNotifications(user.id, { pageSize: 50 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Notifications" description={`${total} au total · ${unread} non lue${unread > 1 ? "s" : ""}`} actions={<Button asChild variant="outline"><Link href="/settings/alerts"><Settings /> Préférences d'alertes</Link></Button>} />
      {items.length === 0 ? <EmptyState icon={Bell} title="Aucune notification" description="Tu seras prévenu des offres très compatibles, des relances à faire et des entretiens." /> : <NotificationList items={items} />}
    </PageContainer>
  );
}
