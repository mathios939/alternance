"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signIn } from "@/lib/auth/client";
import { SocialButtons } from "./social-buttons";

const schema = z.object({
  email: z.email("Adresse email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
});

type Props = { providers: { google: boolean; microsoft: boolean }; next: string; demoEmail?: string };

export function LoginForm({ providers, next, demoEmail }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const { error: err } = await signIn.email({ email: parsed.data.email, password: parsed.data.password, callbackURL: next });
    setLoading(false);
    if (err) {
      setError(err.status === 429 ? "Trop de tentatives. Réessaie dans une minute." : "Email ou mot de passe incorrect.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <Card className="gap-6 py-7">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Bon retour</CardTitle>
        <CardDescription>Connecte-toi pour retrouver tes opportunités du jour.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <SocialButtons providers={providers} callbackURL={next} />
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.fr" aria-invalid={Boolean(fieldErrors["email"])} required />
            {fieldErrors["email"] ? <p className="text-xs text-destructive">{fieldErrors["email"]}</p> : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <Link href="/login?reset=1" className="text-xs text-muted-foreground hover:text-foreground">
                Oublié ?
              </Link>
            </div>
            <div className="relative">
              <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" aria-invalid={Boolean(fieldErrors["password"])} required />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {fieldErrors["password"] ? <p className="text-xs text-destructive">{fieldErrors["password"]}</p> : null}
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {!loading ? <LogIn /> : null} Se connecter
          </Button>
        </form>
        {demoEmail ? (
          <button
            type="button"
            onClick={() => {
              setEmail(demoEmail);
              setPassword("Demo1234!");
            }}
            className="w-full rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            Mode démo : remplir avec le compte <span className="font-medium text-foreground">{demoEmail}</span>
          </button>
        ) : null}
        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href={`/register${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
            Créer un compte
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
