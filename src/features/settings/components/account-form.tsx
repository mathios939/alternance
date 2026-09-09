"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateAccount } from "@/features/settings/server/actions";

export function AccountForm({ initial, email }: { initial: { name: string; marketingOptIn: boolean }; email: string }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <form className="surface space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { const r = await updateAccount(form); if (!r.ok) toast.error(r.error); else toast.success("Compte mis à jour"); router.refresh(); }); }}>
      <h2 className="font-semibold">Compte</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="name">Nom affiché</Label><Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" value={email} disabled /><p className="text-xs text-muted-foreground">L'email sert à la connexion et ne peut pas être modifié ici.</p></div>
      </div>
      <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
        <span>Recevoir des conseils par email (jamais de publicité tierce)</span>
        <Switch checked={form.marketingOptIn} onCheckedChange={(v) => setForm({ ...form, marketingOptIn: v })} />
      </label>
      <div className="flex justify-end"><Button type="submit" loading={pending}>Enregistrer</Button></div>
    </form>
  );
}
