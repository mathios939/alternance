"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, FileText, Send, Sparkles, UserRound, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createApplication } from "@/features/applications/server/actions";

type Props = {
  company: { id: string; name: string; slug: string; size: string };
  recommendedContact: { name: string; jobTitle: string; reason: string } | null;
  angle: string;
  resumeTitle: string | null;
  hasApplication: boolean;
  isAuthenticated: boolean;
};

/**
 * Prépare une candidature spontanée : contact conseillé, angle d'attaque, documents à générer, ajout au suivi.
 * Sans compte : le contact et l'angle sont visibles ; la génération et le suivi sont proposés comme avantages du compte.
 */
export function SpontaneousApplication({ company, recommendedContact, angle, resumeTitle, hasApplication, isAuthenticated }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(hasApplication);

  function addToTracker() {
    startTransition(async () => {
      const r = await createApplication({ companyId: company.id, status: "TO_APPLY", notes: `Candidature spontanée — angle : ${angle}` });
      if (!r.ok) toast.error(r.error);
      else {
        setAdded(true);
        toast.success("Ajoutée à tes candidatures (À candidater)");
      }
      router.refresh();
    });
  }

  const next = encodeURIComponent(`/companies/${company.slug}`);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full">
          <Send /> {added ? "Candidature spontanée en cours" : "Préparer ma candidature spontanée"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Candidature spontanée chez {company.name}</DialogTitle>
          <DialogDescription>Un plan en 4 étapes. Rien n'est envoyé automatiquement : tu gardes la main.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          <li className="flex gap-3 rounded-xl border p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><UserRound className="size-4" aria-hidden /></span>
            <div className="text-sm">
              <p className="font-medium">Contact recommandé</p>
              {recommendedContact ? (
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{recommendedContact.name}</strong>, {recommendedContact.jobTitle}. {recommendedContact.reason}
                </p>
              ) : (
                <p className="text-muted-foreground">Aucun contact vérifié disponible. Passe par la page carrières ou le formulaire de contact du site.</p>
              )}
            </div>
          </li>
          <li className="flex gap-3 rounded-xl border p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Sparkles className="size-4" aria-hidden /></span>
            <div className="text-sm">
              <p className="font-medium">Angle de candidature</p>
              <p className="text-muted-foreground">{angle}</p>
            </div>
          </li>
          {isAuthenticated ? (
            <>
              <li className="flex gap-3 rounded-xl border p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Wand2 className="size-4" aria-hidden /></span>
                <div className="flex-1 text-sm">
                  <p className="font-medium">Email et message LinkedIn</p>
                  <p className="text-muted-foreground">Générés à partir de ton profil et de l'entreprise, à relire avant envoi.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/copilot?intent=spontaneous_email&company=${company.slug}`}>Générer l'email</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/copilot?intent=linkedin_message&company=${company.slug}`}>Message LinkedIn</Link>
                    </Button>
                  </div>
                </div>
              </li>
              <li className="flex gap-3 rounded-xl border p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><FileText className="size-4" aria-hidden /></span>
                <div className="text-sm">
                  <p className="font-medium">CV conseillé</p>
                  <p className="text-muted-foreground">{resumeTitle ? `Utilise « ${resumeTitle} » et vérifie que les technologies de l'entreprise y apparaissent.` : "Importe d'abord un CV pour l'adapter à cette entreprise."}</p>
                </div>
              </li>
            </>
          ) : (
            <li className="flex gap-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Wand2 className="size-4" aria-hidden /></span>
              <div className="text-sm">
                <p className="font-medium">Email, message LinkedIn, CV adapté et suivi</p>
                <p className="text-muted-foreground">Crée un compte gratuitement pour générer l'email et le message à partir de ton profil, adapter ton CV et suivre cette candidature. Tu peux aussi contacter l'entreprise directement via ses canaux officiels affichés sur cette page.</p>
              </div>
            </li>
          )}
        </ol>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>{isAuthenticated ? "Fermer" : "Continuer sans compte"}</Button>
          {!isAuthenticated ? (
            <Button asChild>
              <Link href={`/register?next=${next}`}>
                <UserRound /> Créer un compte gratuitement
              </Link>
            </Button>
          ) : added ? (
            <Button asChild variant="outline">
              <Link href="/applications">
                <Check /> Voir dans le suivi <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button onClick={addToTracker} loading={pending}>
              Ajouter au suivi des candidatures
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
