import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { DeleteAccountDialog, ExportDataButton } from "@/features/settings/components/danger-zone";

export const metadata: Metadata = { title: "Confidentialité & données" };

export default async function PrivacySettingsPage() {
  const user = await requireUser();
  const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { termsAcceptedAt: true, privacyAcceptedAt: true } });
  return (
    <div className="space-y-6">
      <section className="surface p-5">
        <h2 className="inline-flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-success" aria-hidden /> Tes droits, en un clic</h2>
        <p className="mt-2 text-sm text-muted-foreground">Conformément au RGPD, tu peux exporter l'intégralité de tes données (portabilité) et supprimer ton compte (effacement). Nous ne vendons jamais tes données. Détails dans la <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.</p>
        <ul className="mt-3 text-sm text-muted-foreground">
          {fresh?.termsAcceptedAt ? <li>Conditions acceptées le {formatDate(fresh.termsAcceptedAt)}</li> : null}
          {fresh?.privacyAcceptedAt ? <li>Politique de confidentialité acceptée le {formatDate(fresh.privacyAcceptedAt)}</li> : null}
        </ul>
        <div className="mt-4"><ExportDataButton /></div>
      </section>
      <section className="surface p-5">
        <h2 className="font-semibold">Cookies</h2>
        <p className="mt-2 text-sm text-muted-foreground">Seuls des cookies strictement nécessaires sont utilisés (session de connexion, préférence de thème). Aucun traceur publicitaire ni mesure d'audience tierce.</p>
      </section>
      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <h2 className="font-semibold text-destructive">Zone sensible</h2>
        <p className="mt-2 text-sm text-muted-foreground">La suppression est immédiate et définitive : profil, CV, candidatures, favoris, conversations et documents générés.</p>
        <div className="mt-4"><DeleteAccountDialog /></div>
      </section>
    </div>
  );
}
