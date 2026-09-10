"use client";

import Link from "next/link";
import { Bell, Bookmark, FileText, KanbanSquare, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const ACCOUNT_BENEFITS = [
  { icon: KanbanSquare, label: "Suivre tes candidatures : Kanban, relances, historique" },
  { icon: Bookmark, label: "Retrouver tes favoris et ton profil sur tous tes appareils" },
  { icon: FileText, label: "Conserver plusieurs CV et les adapter à chaque offre" },
  { icon: Bell, label: "Recevoir des alertes utiles, sans bruit" },
  { icon: Sparkles, label: "Garder tes conversations avec le Copilote" },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Phrase d'accroche, toujours formulée comme un avantage (jamais « vous devez vous connecter »). */
  title: string;
  description?: string;
  /** Page à rouvrir après la création du compte. */
  next: string;
};

/**
 * Invitation à créer un compte, présentée comme un avantage : le visiteur peut toujours
 * continuer sans compte. Utilisée pour le suivi de candidature, le CV et les lettres.
 */
export function AccountPromptDialog({ open, onOpenChange, title, description, next }: Props) {
  const encoded = encodeURIComponent(next);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="leading-snug">{title}</DialogTitle>
          <DialogDescription>{description ?? "Gratuit, sans engagement. Tu gardes tout ce que tu as déjà fait sans compte."}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {ACCOUNT_BENEFITS.map((b) => (
            <li key={b.label} className="flex items-start gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <b.icon className="size-3.5" aria-hidden />
              </span>
              <span className="pt-1">{b.label}</span>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Continuer sans compte
          </Button>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/login?next=${encoded}`}>Se connecter</Link>
            </Button>
            <Button asChild>
              <Link href={`/register?next=${encoded}`}>
                <UserRound /> Créer un compte gratuitement
              </Link>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
