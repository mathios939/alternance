"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Search, Settings, UserRound, Shield, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/utils";
import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/shared/logo";
import { NotificationCenter, type NotificationItem } from "@/features/notifications/components/notification-center";
import { CommandPalette } from "@/components/layout/command-palette";
import { SidebarNav, type NavBadges } from "@/components/layout/app-sidebar";

type Props = {
  user: { name: string; email: string; image: string | null; role: string; plan: string };
  badges: NavBadges;
  notifications: NotificationItem[];
  urgencyMode: boolean;
  isAdmin: boolean;
};

export function AppHeader({ user, badges, notifications, urgencyMode, isAdmin }: Props) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function onSignOut() {
    await signOut();
    toast.success("À bientôt !");
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Ouvrir la navigation">
          <Menu />
        </Button>
        <SheetContent side="left" className="w-[280px] gap-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center px-5">
            <Logo href="/dashboard" />
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto pb-4">
            <SidebarNav badges={badges} isAdmin={isAdmin} urgencyMode={urgencyMode} onNavigate={() => setMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <div className="lg:hidden">
        <Logo href="/dashboard" withText={false} />
      </div>

      <button type="button" onClick={() => setPaletteOpen(true)} className="hidden h-10 flex-1 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent sm:flex sm:max-w-md" aria-label="Rechercher ou exécuter une commande">
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Rechercher une offre, une entreprise, une action…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPaletteOpen(true)} aria-label="Rechercher">
        <Search />
      </Button>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} isAdmin={isAdmin} />

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationCenter items={notifications} unread={badges.notifications} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="ml-1 flex items-center gap-2 rounded-full p-0.5 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none" aria-label="Menu du compte">
              <Avatar>
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs">{user.email}</p>
              <span className="mt-1 inline-block rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">{user.plan === "PREMIUM" ? "Premium" : "Gratuit"}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">
                <UserRound /> Mon profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> Paramètres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/privacy">
                <Shield /> Confidentialité & données
              </Link>
            </DropdownMenuItem>
            {isAdmin ? (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <Shield /> Administration
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href="/#fonctionnalites">
                <HelpCircle /> Aide
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <LogOut /> Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
