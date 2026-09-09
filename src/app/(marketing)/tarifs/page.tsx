import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_LABELS, type PlanKey } from "@/config/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tarifs", description: "Alternance OS est gratuit pour chercher, suivre et candidater. Le plan Premium arrive bientôt." };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Tarifs</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Gratuit pour trouver ton alternance</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">L'essentiel est et restera gratuit. Le plan Premium ajoutera des fonctionnalités IA avancées, sans paiement pour le moment.</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {(Object.keys(PLAN_LABELS) as PlanKey[]).map((key) => {
          const plan = PLAN_LABELS[key];
          const premium = key === "PREMIUM";
          return (
            <div key={key} className={cn("surface relative p-7", premium && "border-primary/40 shadow-glow")}>
              {premium ? <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Bientôt</span> : null}
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{plan.pitch}</p>
              <p className="mt-5 text-4xl font-semibold tracking-tight">{plan.price}</p>
              <ul className="mt-6 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8 w-full" size="lg" variant={premium ? "outline" : "default"} disabled={premium}>
                <Link href={premium ? "/register" : "/register"}>{premium ? "Être prévenu" : "Commencer gratuitement"}</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
