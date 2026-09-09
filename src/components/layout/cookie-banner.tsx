"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "aos.cookie-consent";
const EVENT = "aos:cookie-consent";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readConsent(): string {
  try {
    return localStorage.getItem(KEY) ?? "none";
  } catch {
    return "blocked";
  }
}

/**
 * Bandeau cookies. L'application n'utilise que des cookies strictement nécessaires
 * (session, préférences de thème) : aucun traceur tiers. Le bandeau informe et mémorise le choix.
 */
export function CookieBanner() {
  const consent = useSyncExternalStore(subscribe, readConsent, () => "server");
  const visible = consent === "none";
  function accept(value: "essential" | "all") {
    try {
      localStorage.setItem(KEY, JSON.stringify({ value, at: new Date().toISOString() }));
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }
  if (!visible) return null;
  return (
    <div role="dialog" aria-live="polite" aria-label="Information sur les cookies" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border bg-card p-4 shadow-lg animate-fade-up sm:inset-x-auto sm:right-4 sm:bottom-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Cookie className="size-5" aria-hidden />
        </span>
        <div className="space-y-2 text-sm">
          <p>
            Nous n'utilisons que des cookies <strong>strictement nécessaires</strong> (connexion, préférences). Aucun traceur publicitaire, aucune revente de données.{" "}
            <Link href="/confidentialite" className="underline">
              En savoir plus
            </Link>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => accept("essential")}>
              Compris
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/confidentialite#cookies">Gérer</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
