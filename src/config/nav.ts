import {
  BarChart3,
  Bell,
  Bookmark,
  Bot,
  Briefcase,
  Building2,
  CalendarClock,
  FileText,
  GitCompare,
  Handshake,
  KanbanSquare,
  LayoutDashboard,
  Map,
  Radar,
  Settings,
  Shield,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "notifications" | "followUps" | "interviews";
  shortcut?: string;
};

export const MAIN_NAV: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, shortcut: "g d" },
  { label: "Offres", href: "/jobs", icon: Briefcase, shortcut: "g o" },
  { label: "Entreprises", href: "/companies", icon: Building2, shortcut: "g e" },
  { label: "Radar", href: "/radar", icon: Radar, shortcut: "g r" },
  { label: "Candidatures", href: "/applications", icon: KanbanSquare, badgeKey: "followUps", shortcut: "g c" },
  { label: "Favoris", href: "/favorites", icon: Bookmark },
  { label: "Mon CV", href: "/resume", icon: FileText },
  { label: "Copilote", href: "/copilot", icon: Bot, shortcut: "g i" },
];

export const SECONDARY_NAV: NavItem[] = [
  { label: "Carte", href: "/map", icon: Map },
  { label: "Entretiens", href: "/interviews", icon: CalendarClock, badgeKey: "interviews" },
  { label: "Outreach", href: "/outreach", icon: Handshake },
  { label: "Comparer", href: "/compare", icon: GitCompare },
  { label: "Statistiques", href: "/analytics", icon: BarChart3 },
  { label: "Mode urgence", href: "/urgence", icon: Zap },
];

export const FOOTER_NAV: NavItem[] = [
  { label: "Notifications", href: "/notifications", icon: Bell, badgeKey: "notifications" },
  { label: "Paramètres", href: "/settings", icon: Settings },
];

export const ADMIN_NAV: NavItem = { label: "Administration", href: "/admin", icon: Shield };

/** Navigation sans compte : tout le cœur du site, aucune entrée n'exige de se connecter. */
export const PUBLIC_NAV = [
  { label: "Offres", href: "/jobs" },
  { label: "Entreprises", href: "/companies" },
  { label: "Radar", href: "/radar" },
  { label: "Carte", href: "/map" },
];
