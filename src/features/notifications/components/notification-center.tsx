"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Briefcase, Building2, CalendarClock, CheckCheck, Info, RefreshCw, Sparkles } from "lucide-react";
import type { NotificationType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/components/shared/relative-time";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/server/actions";

export type NotificationItem = { id: string; type: NotificationType; title: string; body: string | null; href: string | null; readAt: Date | null; createdAt: Date };

const ICONS: Record<NotificationType, typeof Bell> = {
  NEW_JOB: Briefcase,
  HIGH_MATCH_JOB: Sparkles,
  FOLLOW_UP_REQUIRED: RefreshCw,
  NEW_COMPANY: Building2,
  INTERVIEW_REMINDER: CalendarClock,
  SYSTEM: Info,
};

export function NotificationCenter({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onOpen(n: NotificationItem) {
    setOpen(false);
    startTransition(async () => {
      if (!n.readAt) await markNotificationRead(n.id);
      if (n.href) router.push(n.href);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
          {unread > 0 ? <BellRing /> : <Bell />}
          {unread > 0 ? <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{unread > 9 ? "9+" : unread}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Notifications</p>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { await markAllNotificationsRead(); router.refresh(); })}>
              <CheckCheck /> Tout lire
            </Button>
          ) : null}
        </div>
        <ul className="max-h-[420px] overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">Rien de nouveau. On te prévient dès qu'une offre très compatible arrive.</li>
          ) : (
            items.map((n) => {
              const Icon = ICONS[n.type];
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => onOpen(n)} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent", !n.readAt && "bg-primary-soft/40")}>
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", !n.readAt ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{n.title}</span>
                      {n.body ? <span className="block truncate text-xs text-muted-foreground">{n.body}</span> : null}
                      <span className="block text-[11px] text-muted-foreground"><RelativeTime date={n.createdAt} /></span>
                    </span>
                    {!n.readAt ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Non lue" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t px-4 py-2 text-center">
          <Link href="/notifications" onClick={() => setOpen(false)} className="text-sm font-medium text-primary hover:underline">
            Toutes les notifications et préférences
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
