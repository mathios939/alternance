"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useGuestProfile } from "@/lib/guest/use-guest-profile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GuestProfileForm } from "./guest-profile-form";

type Props = {
  /** Vrai si le serveur a déjà calculé des scores (profil visiteur reconnu). */
  hasProfile?: boolean;
  initialCity?: string;
  initialQuery?: string;
  initialRadius?: number;
  label?: string;
  variant?: "default" | "outline" | "soft" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
};

/**
 * Bouton + dialogue « Personnaliser mes résultats » (mode sans compte).
 * Devient « Résultats personnalisés » une fois le profil visiteur renseigné (et permet de le modifier).
 */
export function PersonalizeResults({ hasProfile = false, initialCity, initialQuery, initialRadius, label = "Personnaliser mes résultats", variant = "outline", size = "sm", className }: Props) {
  const [open, setOpen] = useState(false);
  const { profile } = useGuestProfile();
  const active = hasProfile || Boolean(profile);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={active ? "soft" : variant} size={size} className={className}>
          <Sparkles /> {active ? "Résultats personnalisés" : label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{active ? "Modifier mes préférences" : "Personnaliser mes résultats"}</DialogTitle>
          <DialogDescription>30 secondes, sans compte : un score de compatibilité expliqué sur chaque offre, un Radar et une carte à ta mesure.</DialogDescription>
        </DialogHeader>
        <GuestProfileForm key={profile?.updatedAt ?? "new"} onSaved={() => setOpen(false)} initialCity={initialCity} initialQuery={initialQuery} initialRadius={initialRadius} />
      </DialogContent>
    </Dialog>
  );
}
