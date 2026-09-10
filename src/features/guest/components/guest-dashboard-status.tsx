"use client";

import Link from "next/link";
import { Bookmark, Sparkles } from "lucide-react";
import { useGuestFavorites } from "@/lib/guest/use-guest-favorites";
import { useGuestProfile } from "@/lib/guest/use-guest-profile";
import { Button } from "@/components/ui/button";
import { PersonalizeResults } from "./personalize-results";

/**
 * Ce que le visiteur a déjà dans ce navigateur (préférences, favoris) : rendu après hydratation,
 * rien côté serveur. Montre que « continuer sans compte » n'est pas repartir de zéro.
 */
export function GuestDashboardStatus() {
  const { profile } = useGuestProfile();
  const favorites = useGuestFavorites();
  if (!profile && favorites.count === 0) return null;
  const summary = [profile?.targetJobTitle, profile?.city ? `${profile.city} · ${profile.radiusKm} km` : null].filter(Boolean).join(" · ");
  return (
    <section className="mx-auto max-w-4xl space-y-3" aria-label="Dans ce navigateur">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Déjà dans ce navigateur</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {profile ? (
          <div className="surface flex items-center gap-3 p-4 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Résultats personnalisés actifs</p>
              <p className="truncate text-muted-foreground">{summary || "Préférences enregistrées"}</p>
            </div>
            <PersonalizeResults hasProfile label="Modifier" />
          </div>
        ) : null}
        {favorites.count > 0 ? (
          <div className="surface flex items-center gap-3 p-4 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Bookmark className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {favorites.count} favori{favorites.count > 1 ? "s" : ""} sauvegardé{favorites.count > 1 ? "s" : ""}
              </p>
              <p className="text-muted-foreground">Un compte les gardera sur tous tes appareils.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/favorites">Voir</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
