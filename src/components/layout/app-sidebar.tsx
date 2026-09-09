"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, FOOTER_NAV, MAIN_NAV, SECONDARY_NAV, type NavItem } from "@/config/nav";
import { Logo } from "@/components/shared/logo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

export type NavBadges = { notifications: number; followUps: number; interviews: number };

function NavLink({ item, active, badge, onNavigate }: { item: NavItem; active: boolean; badge?: number; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {badge ? <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums">{badge}</span> : null}
    </Link>
  );
}

export function SidebarNav({ badges, isAdmin, urgencyMode, onNavigate }: { badges: NavBadges; isAdmin: boolean; urgencyMode: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(SECONDARY_NAV.some((i) => pathname.startsWith(i.href)));
  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)) || (href === "/jobs" && pathname.startsWith("/jobs"));
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Navigation de l'application">
      {urgencyMode ? (
        <Link href="/urgence" onClick={onNavigate} className="mb-2 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs font-medium">
          <Zap className="size-4 text-warning-foreground dark:text-warning" aria-hidden /> Mode urgence actif
        </Link>
      ) : null}
      {MAIN_NAV.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} badge={item.badgeKey ? badges[item.badgeKey] : undefined} onNavigate={onNavigate} />
      ))}
      <Collapsible open={moreOpen} onOpenChange={setMoreOpen} className="mt-2">
        <CollapsibleTrigger className="flex h-8 w-full items-center justify-between rounded-lg px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground">
          Plus d'outils
          <ChevronDown className={cn("size-3.5 transition-transform", moreOpen && "rotate-180")} aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-1 pt-1">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} badge={item.badgeKey ? badges[item.badgeKey] : undefined} onNavigate={onNavigate} />
          ))}
        </CollapsibleContent>
      </Collapsible>
      <div className="mt-auto flex flex-col gap-1 border-t pt-3">
        {FOOTER_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} badge={item.badgeKey ? badges[item.badgeKey] : undefined} onNavigate={onNavigate} />
        ))}
        {isAdmin ? <NavLink item={ADMIN_NAV} active={pathname.startsWith("/admin")} onNavigate={onNavigate} /> : null}
      </div>
    </nav>
  );
}

export function AppSidebar(props: { badges: NavBadges; isAdmin: boolean; urgencyMode: boolean }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r bg-sidebar lg:flex" aria-label="Barre latérale">
      <div className="flex h-16 items-center px-5">
        <Logo href="/dashboard" />
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto pb-4 scrollbar-thin">
        <SidebarNav {...props} />
      </div>
    </aside>
  );
}
