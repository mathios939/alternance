"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Sparkles } from "lucide-react";
import type { EducationLevel } from "@/generated/prisma/enums";
import { EDUCATION_LEVELS, EDUCATION_LEVEL_KEYS, JOB_FAMILIES, RADIUS_OPTIONS, guessJobFamily } from "@/config/taxonomy";
import { FAMILY_SKILL_SUGGESTIONS } from "@/config/skills";
import { cn } from "@/lib/utils";
import { EMPTY_GUEST_PROFILE, GUEST_SKILLS_MAX, guestProfileSchema, isGuestProfileUsable, type GuestProfile } from "@/lib/guest/profile";
import { useGuestProfile } from "@/lib/guest/use-guest-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CityAutocomplete } from "@/components/shared/city-autocomplete";
import { SkillsInput } from "@/components/shared/skills-input";

type Props = {
  /** Appelé après l'enregistrement (fermeture d'un dialogue, par exemple). */
  onSaved?: () => void;
  /** Valeurs proposées quand aucun profil visiteur n'existe encore (issues de la recherche en cours). */
  initialCity?: string;
  initialQuery?: string;
  initialRadius?: number;
  /** Libellé du bouton principal. */
  submitLabel?: string;
};

/**
 * Formulaire « Personnaliser mes résultats » : 30 secondes, sans compte.
 * Formation, niveau, ville, rayon, compétences, métier recherché → Match Score personnalisé.
 */
export function GuestProfileForm({ onSaved, initialCity = "", initialQuery = "", initialRadius, submitLabel = "Voir mes résultats personnalisés" }: Props) {
  const router = useRouter();
  const { profile, save, clear } = useGuestProfile();
  const [values, setValues] = useState<GuestProfile>(() => profile ?? { ...EMPTY_GUEST_PROFILE, city: initialCity, targetJobTitle: initialQuery, radiusKm: initialRadius && (RADIUS_OPTIONS as readonly number[]).includes(initialRadius) ? initialRadius : EMPTY_GUEST_PROFILE.radiusKm });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof GuestProfile>(key: K, value: GuestProfile[K]) => setValues((v) => ({ ...v, [key]: value }));
  const family = useMemo(() => guessJobFamily(values.targetJobTitle) ?? guessJobFamily(values.educationTitle), [values.targetJobTitle, values.educationTitle]);
  const suggestions = family ? (FAMILY_SKILL_SUGGESTIONS[family] ?? []) : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = guestProfileSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Vérifie les champs saisis.");
      return;
    }
    if (!isGuestProfileUsable(parsed.data)) {
      setError("Indique au moins ta ville ou le métier que tu recherches.");
      return;
    }
    setError(null);
    save(parsed.data);
    toast.success("Résultats personnalisés", { description: "Chaque offre affiche maintenant ton score de compatibilité." });
    router.refresh();
    onSaved?.();
  }

  function reset() {
    clear();
    setValues({ ...EMPTY_GUEST_PROFILE });
    toast.success("Préférences effacées de ce navigateur");
    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-label="Personnaliser mes résultats">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="guest-job">Métier recherché</Label>
          <Input id="guest-job" value={values.targetJobTitle} onChange={(e) => set("targetJobTitle", e.target.value)} placeholder="Développeur web, comptable, marketing…" autoComplete="off" />
          {family ? (
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3 text-primary" aria-hidden /> Famille détectée : <strong className="text-foreground">{JOB_FAMILIES[family].label}</strong>
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="guest-education">Formation</Label>
          <Input id="guest-education" value={values.educationTitle} onChange={(e) => set("educationTitle", e.target.value)} placeholder="BTS SIO, BUT MMI, Master marketing…" autoComplete="off" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Niveau visé à la fin de l'alternance</Label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Niveau d'études">
          {EDUCATION_LEVEL_KEYS.map((k) => {
            const on = values.educationLevel === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} onClick={() => set("educationLevel", on ? null : (k as EducationLevel))} className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-primary", on && "border-primary bg-primary-soft text-primary")}>
                {EDUCATION_LEVELS[k].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="guest-city">Ta ville</Label>
          <CityAutocomplete id="guest-city" value={values.city} onChange={(v) => set("city", v)} placeholder="Nantes, Rennes, Angers…" />
        </div>
        <div className="space-y-2">
          <Label>Rayon</Label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Rayon de recherche">
            {RADIUS_OPTIONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={values.radiusKm === r} onClick={() => set("radiusKm", r)} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary", values.radiusKm === r && "border-primary bg-primary-soft text-primary")}>
                {r} km
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="guest-skills">Compétences</Label>
        <SkillsInput id="guest-skills" value={values.skills} onChange={(v) => set("skills", v)} suggestions={suggestions} max={GUEST_SKILLS_MAX} />
      </div>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="inline-flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Stocké uniquement dans ton navigateur (90 jours), jamais transmis à un tiers.{" "}
            <Link href="/register?next=/jobs" className="font-medium text-primary hover:underline">Crée un compte</Link> pour le retrouver sur tous tes appareils.
          </span>
        </p>
        <div className="flex gap-2">
          {profile ? (
            <Button type="button" variant="ghost" onClick={reset}>
              Effacer
            </Button>
          ) : null}
          <Button type="submit">
            <Sparkles /> {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
