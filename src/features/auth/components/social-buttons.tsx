"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GoogleIcon, MicrosoftIcon } from "@/components/shared/brand-icons";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/client";

type Props = { providers: { google: boolean; microsoft: boolean }; callbackURL: string };

export function SocialButtons({ providers, callbackURL }: Props) {
  const [loading, setLoading] = useState<"google" | "microsoft" | null>(null);
  if (!providers.google && !providers.microsoft) return null;

  async function handle(provider: "google" | "microsoft") {
    setLoading(provider);
    const { error } = await signIn.social({ provider, callbackURL });
    if (error) {
      toast.error("Connexion impossible avec ce fournisseur.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.google ? (
          <Button type="button" variant="outline" size="lg" onClick={() => handle("google")} loading={loading === "google"}>
            {loading !== "google" ? <GoogleIcon /> : null} Google
          </Button>
        ) : null}
        {providers.microsoft ? (
          <Button type="button" variant="outline" size="lg" onClick={() => handle("microsoft")} loading={loading === "microsoft"}>
            {loading !== "microsoft" ? <MicrosoftIcon /> : null} Microsoft
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou avec ton email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
