"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/server/actions";
import type { NotificationItem } from "./notification-center";

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unread = items.some((n) => !n.readAt);
  return (
    <div className="surface overflow-hidden">
      {unread ? (
        <div className="flex justify-end border-b px-4 py-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { await markAllNotificationsRead(); router.refresh(); })}><CheckCheck /> Tout marquer comme lu</Button>
        </div>
      ) : null}
      <ul className="divide-y">
        {items.map((n) => (
          <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.readAt && "bg-primary-soft/30")}>
            <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{n.title}</p>
              {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
              <p className="text-xs text-muted-foreground">{formatRelative(n.createdAt)}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              {n.href ? <Button asChild size="sm" variant="outline"><Link href={n.href} onClick={() => { if (!n.readAt) void markNotificationRead(n.id); }}>Ouvrir</Link></Button> : null}
              {!n.readAt ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { await markNotificationRead(n.id); router.refresh(); })}>Lu</Button> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
