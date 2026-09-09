import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PLAN_LABELS } from "@/config/plans";
import { AccountForm } from "@/features/settings/components/account-form";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [fresh, accounts] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, plan: true, createdAt: true, marketingOptIn: true } }),
    prisma.account.findMany({ where: { userId: user.id }, select: { providerId: true } }),
  ]);
  if (!fresh) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <AccountForm initial={{ name: fresh.name, marketingOptIn: fresh.marketingOptIn }} email={fresh.email} />
      <aside className="space-y-4">
        <div className="surface p-5">
          <p className="text-sm font-semibold">Plan</p>
          <p className="mt-1 text-2xl font-semibold">{PLAN_LABELS[fresh.plan].name} <Badge variant="soft">{fresh.plan}</Badge></p>
          <p className="text-xs text-muted-foreground">{PLAN_LABELS[fresh.plan].pitch}</p>
          <ul className="mt-3 space-y-1 text-sm">{PLAN_LABELS[fresh.plan].features.map((f) => <li key={f}>· {f}</li>)}</ul>
        </div>
        <div className="surface p-5 text-sm">
          <p className="font-semibold">Connexion</p>
          <p className="mt-1 text-muted-foreground">Méthodes : {accounts.map((a) => (a.providerId === "credential" ? "email / mot de passe" : a.providerId)).join(", ") || "—"}</p>
          <p className="mt-1 text-muted-foreground">Membre depuis le {formatDate(fresh.createdAt)}</p>
        </div>
      </aside>
    </div>
  );
}
