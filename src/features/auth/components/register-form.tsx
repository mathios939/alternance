"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signUp } from "@/lib/auth/client";
import { SocialButtons } from "./social-buttons";

const schema = z.object({
  name: z.string().trim().min(2, "Ton prénom (2 caractères minimum)").max(60),
  email: z.email("Adresse email invalide"),
  password: z
    .string()
    .min(8, "8 caractères minimum")
    .max(128)
    .refine((p) => /[a-z]/i.test(p) && /\d/.test(p), "Utilise des lettres et au moins un chiffre"),
  terms: z.literal(true, { error: "Tu dois accepter les conditions d'utilisation" }),
});

type Props = { providers: { google: boolean; microsoft: boolean }; next: string };

export function RegisterForm({ providers, next }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", terms: false });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const { error: err } = await signUp.email({ name: parsed.data.name, email: parsed.data.email, password: parsed.data.password, callbackURL: "/onboarding" });
    setLoading(false);
    if (err) {
      setError(err.status === 422 || err.code === "USER_ALREADY_EXISTS" ? "Un compte existe déjà avec cet email." : (err.message ?? "Impossible de créer le compte."));
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  const strength = form.password.length === 0 ? 0 : form.password.length < 8 ? 1 : /[A-Z]/.test(form.password) && /\d/.test(form.password) && form.password.length >= 12 ? 3 : 2;

  return (
    <Card className="gap-6 py-7">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Crée ton compte</CardTitle>
        <CardDescription>Gratuit. Moins de 3 minutes pour configurer ton assistant.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <SocialButtons providers={providers} callbackURL="/onboarding" />
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Prénom</Label>
            <Input id="name" autoComplete="given-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Léa" aria-invalid={Boolean(fieldErrors["name"])} required />
            {fieldErrors["name"] ? <p className="text-xs text-destructive">{fieldErrors["name"]}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="toi@exemple.fr" aria-invalid={Boolean(fieldErrors["email"])} required />
            {fieldErrors["email"] ? <p className="text-xs text-destructive">{fieldErrors["email"]}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-invalid={Boolean(fieldErrors["password"])} aria-describedby="password-help" required />
            <div className="flex gap-1" aria-hidden>
              {[1, 2, 3].map((i) => (
                <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${strength >= i ? (strength === 1 ? "bg-destructive" : strength === 2 ? "bg-warning" : "bg-success") : "bg-muted"}`} />
              ))}
            </div>
            <p id="password-help" className="text-xs text-muted-foreground">
              {fieldErrors["password"] ?? "8 caractères minimum, avec au moins un chiffre."}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="terms" checked={form.terms} onCheckedChange={(v) => setForm({ ...form, terms: v === true })} aria-invalid={Boolean(fieldErrors["terms"])} />
            <Label htmlFor="terms" className="text-xs leading-relaxed font-normal text-muted-foreground">
              J'accepte les{" "}
              <Link href="/cgu" className="underline" target="_blank">
                conditions d'utilisation
              </Link>{" "}
              et la{" "}
              <Link href="/confidentialite" className="underline" target="_blank">
                politique de confidentialité
              </Link>
              . Mes données ne sont jamais vendues.
            </Label>
          </div>
          {fieldErrors["terms"] ? <p className="text-xs text-destructive">{fieldErrors["terms"]}</p> : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {!loading ? <Sparkles /> : null} Commencer gratuitement
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link href={`/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
