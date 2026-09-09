"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { saveResumeText } from "@/features/resume/server/actions";

const TEMPLATE = `Prénom Nom
Intitulé (ex. Étudiant·e BTS SIO, futur·e développeur·se)
email@exemple.fr · 06 00 00 00 00 · linkedin.com/in/…
Code postal Ville

Profil
Deux phrases : ce que tu cherches, ce que tu apportes.

Expériences
Poste — Entreprise, Ville (mois année – mois année)
- Action + outil + résultat chiffré

Formation
Diplôme — École, Ville (années)

Compétences
Outil 1, Outil 2, Méthode 3

Langues
Anglais B2`;

export function ResumeEditor({ resumeId, initialText }: { resumeId: string; initialText: string | null }) {
  const router = useRouter();
  const [text, setText] = useState(initialText ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={TEMPLATE} className="min-h-[360px] font-mono text-[13px] leading-relaxed" aria-label="Contenu du CV" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{text.trim().split(/\s+/).filter(Boolean).length} mots. Enregistrer crée une nouvelle version analysée.</p>
        <div className="flex gap-2">
          {!text ? <Button variant="ghost" size="sm" onClick={() => setText(TEMPLATE)}>Partir du modèle</Button> : null}
          <Button size="sm" loading={pending} disabled={text.trim().length < 50} onClick={() => startTransition(async () => { const r = await saveResumeText({ resumeId, text }); if (!r.ok) toast.error(r.error); else { toast.success(`Version enregistrée : ${r.data.score}/100`); router.refresh(); } })}>
            <Save /> Enregistrer et analyser
          </Button>
        </div>
      </div>
    </div>
  );
}
