"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, X } from "lucide-react";
import { useGuestFavorites } from "@/lib/guest/use-guest-favorites";
import { importGuestFavorites } from "@/features/favorites/server/actions";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "aos.guest-import-dismissed";

/**
 * Après la création du compte : propose d'ajouter au compte les favoris sauvegardés sans compte
 * (stockage navigateur). Le nombre détecté est affiché ; les favoris locaux ne sont effacés
 * qu'après confirmation de l'import par le serveur. Disparaît une fois importés ou ignorés.
 */
export function GuestImportBanner() {
  const router = useRouter();
  const guest = useGuestFavorites();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (guest.count === 0 || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  function importAll() {
    if (pending) return;
    startTransition(async () => {
      const r = await importGuestFavorites({ jobIds: guest.jobs, companyIds: guest.companies });
      if (!r.ok) {
        toast.error(r.error, { description: "Tes favoris restent dans ce navigateur : tu pourras réessayer." });
        return;
      }
      guest.clear();
      const { added, alreadyPresent } = r.data;
      const parts = [added > 0 ? `${added} ajouté${added > 1 ? "s" : ""} à ton compte` : null, alreadyPresent > 0 ? `${alreadyPresent} déjà présent${alreadyPresent > 1 ? "s" : ""}` : null].filter(Boolean);
      toast.success(added > 0 ? "Favoris ajoutés à ton compte" : "Ces favoris étaient déjà dans ton compte", { description: parts.join(" · ") || undefined, action: { label: "Voir", onClick: () => router.push("/favorites") } });
      router.refresh();
    });
  }

  const count = guest.count;
  const jobs = guest.jobs.length;
  const companies = guest.companies.length;
  const detail = [jobs ? `${jobs} offre${jobs > 1 ? "s" : ""}` : null, companies ? `${companies} entreprise${companies > 1 ? "s" : ""}` : null].filter(Boolean).join(" et ");
  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-primary-soft/50 px-4 py-2.5 text-sm sm:px-6" role="status">
      <Bookmark className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1">
        <strong>{count} favori{count > 1 ? "s" : ""} trouvé{count > 1 ? "s" : ""}</strong> dans ce navigateur ({detail}) — les ajouter à ton compte ?
      </p>
      <Button size="sm" onClick={importAll} loading={pending}>
        Ajouter à mon compte
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Ignorer" disabled={pending}>
        <X />
      </Button>
    </div>
  );
}
