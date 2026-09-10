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
 * Après la création du compte : propose d'importer les favoris sauvegardés sans compte
 * (stockage navigateur) dans les favoris du compte. Disparaît une fois importés ou ignorés.
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
    startTransition(async () => {
      const r = await importGuestFavorites({ jobIds: guest.jobs, companyIds: guest.companies });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      guest.clear();
      toast.success(r.data.imported > 0 ? `${r.data.imported} favori${r.data.imported > 1 ? "s" : ""} importé${r.data.imported > 1 ? "s" : ""} dans ton compte` : "Ces favoris étaient déjà dans ton compte");
      router.refresh();
    });
  }

  const jobs = guest.jobs.length;
  const companies = guest.companies.length;
  const summary = [jobs ? `${jobs} offre${jobs > 1 ? "s" : ""}` : null, companies ? `${companies} entreprise${companies > 1 ? "s" : ""}` : null].filter(Boolean).join(" et ");
  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-primary-soft/50 px-4 py-2.5 text-sm sm:px-6" role="status">
      <Bookmark className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1">
        Tu avais sauvegardé <strong>{summary}</strong> sans compte dans ce navigateur.
      </p>
      <Button size="sm" onClick={importAll} loading={pending}>
        Importer mes favoris
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Ignorer" disabled={pending}>
        <X />
      </Button>
    </div>
  );
}
