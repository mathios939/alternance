"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, FileUp, Loader2, Sparkles, Upload } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { CONTRACT_TYPES, DURATIONS, EDUCATION_LEVELS, EDUCATION_LEVEL_KEYS, JOB_FAMILIES, MOBILITIES, RADIUS_OPTIONS, REMOTE_POLICIES, REMOTE_POLICY_CHOICES, SECTORS, SECTOR_KEYS, WORK_RHYTHMS, guessJobFamily, type JobFamilyKey } from "@/config/taxonomy";
import { ContractType, EducationLevel, Mobility, RemotePolicy, WorkRhythm } from "@/generated/prisma/enums";
import { DEFAULT_PROFILE_VALUES, profileSchema, type ProfileValues } from "@/lib/validation/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { CityAutocomplete } from "@/components/shared/city-autocomplete";
import { SkillsInput } from "@/components/shared/skills-input";
import { ChipSelect } from "@/components/shared/chip-select";
import { saveProfile } from "@/features/onboarding/server/actions";
import { importResumeForOnboarding } from "@/features/onboarding/server/import-resume";
import { FAMILY_SKILL_SUGGESTIONS } from "@/config/skills";
import { clearGuestProfile } from "@/lib/guest/use-guest-profile";

const STEPS = [
  { key: "you", title: "Toi", subtitle: "Ce que tu cherches", schema: profileSchema.pick({ firstName: true, targetJobTitle: true }) },
  { key: "education", title: "Formation", subtitle: "Ton niveau et ton école", schema: profileSchema.pick({ educationLevel: true }).extend({ educationLevel: z.enum(EducationLevel, { error: "Choisis ton niveau" }) }) },
  { key: "location", title: "Localisation", subtitle: "Où et jusqu'où", schema: profileSchema.pick({ city: true }) },
  { key: "contract", title: "Contrat", subtitle: "Dates, durée et rythme", schema: z.object({}) },
  { key: "skills", title: "Compétences", subtitle: "Pour un score précis", schema: profileSchema.pick({ skills: true }).extend({ skills: z.array(z.string()).min(1, "Ajoute au moins une compétence") }) },
] as const;

type Props = { initial?: Partial<ProfileValues>; mode?: "onboarding" | "edit" };

export function OnboardingWizard({ initial, mode = "onboarding" }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ProfileValues>({ ...DEFAULT_PROFILE_VALUES, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const current = STEPS[step]!;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const guessedFamily = useMemo(() => guessJobFamily(values.targetJobTitle), [values.targetJobTitle]);
  const familySkills = useMemo(() => {
    const key = (values.jobFamily ?? guessedFamily) as JobFamilyKey | null;
    return key ? (FAMILY_SKILL_SUGGESTIONS[key] ?? []) : [];
  }, [values.jobFamily, guessedFamily]);

  function validateStep(): boolean {
    const parsed = current.schema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return true;
    }
    setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    return false;
  }

  function next() {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else submit();
  }

  function submit() {
    startTransition(async () => {
      const result = await saveProfile({ ...values, jobFamily: values.jobFamily ?? guessedFamily }, { completeOnboarding: mode === "onboarding" });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setErrors(Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [k, v[0] ?? ""])));
        return;
      }
      toast.success(mode === "onboarding" ? `Profil créé à ${result.data.completion} %. Bienvenue !` : "Profil mis à jour");
      // Le profil du compte remplace le profil visiteur du navigateur.
      if (mode === "onboarding") clearGuestProfile();
      router.push(mode === "onboarding" ? "/dashboard" : "/settings/profile");
      router.refresh();
    });
  }

  async function onImport(file: File) {
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await importResumeForOnboarding(fd);
    setImporting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const p = result.data;
    setValues((v) => ({
      ...v,
      firstName: v.firstName || p.firstName || "",
      lastName: v.lastName || p.lastName || "",
      city: v.city || p.city || "",
      phone: v.phone || p.phone || "",
      linkedinUrl: v.linkedinUrl || p.linkedinUrl || "",
      educationLevel: v.educationLevel ?? (p.educationLevel as EducationLevel | null),
      educationTitle: v.educationTitle || p.educationTitle || "",
      skills: Array.from(new Set([...v.skills, ...p.skills])),
    }));
    setImported(file.name);
    toast.success(`CV importé : ${p.skills.length} compétences détectées. Vérifie et complète.`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Étape {step + 1} sur {STEPS.length} · {current.title}
          </span>
          <span className="text-muted-foreground">{progress} %</span>
        </div>
        <Progress value={progress} className="mt-2" aria-label="Progression de l'onboarding" />
        <ol className="mt-3 hidden gap-2 sm:flex" aria-hidden>
          {STEPS.map((s, i) => (
            <li key={s.key} className={cn("flex items-center gap-1.5 text-xs", i === step ? "text-foreground" : i < step ? "text-success" : "text-muted-foreground")}>
              <span className={cn("flex size-5 items-center justify-center rounded-full border text-[10px]", i < step && "border-success bg-success text-success-foreground", i === step && "border-primary text-primary")}>{i < step ? <Check className="size-3" /> : i + 1}</span>
              {s.title}
            </li>
          ))}
        </ol>
      </div>

      <div className="surface p-6 sm:p-8 animate-fade-up" key={current.key}>
        <h2 className="text-xl font-semibold">{current.subtitle}</h2>

        {current.key === "you" ? (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-dashed bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <FileUp className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{imported ? `CV importé : ${imported}` : "Importer mon CV (PDF)"}</p>
                    <p className="text-xs text-muted-foreground">Préremplit prénom, ville, niveau et compétences. Rien n'est inventé.</p>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="application/pdf,text/plain" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ""; }} aria-label="Choisir un fichier CV" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
                  {importing ? <Loader2 className="animate-spin" /> : <Upload />} {importing ? "Lecture…" : imported ? "Remplacer" : "Choisir un fichier"}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" value={values.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Léa" autoComplete="given-name" aria-invalid={Boolean(errors["firstName"])} />
                {errors["firstName"] ? <p className="text-xs text-destructive">{errors["firstName"]}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom <span className="font-normal text-muted-foreground">(optionnel)</span></Label>
                <Input id="lastName" value={values.lastName ?? ""} onChange={(e) => set("lastName", e.target.value)} placeholder="Martin" autoComplete="family-name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetJobTitle">Métier recherché</Label>
              <Input id="targetJobTitle" value={values.targetJobTitle} onChange={(e) => set("targetJobTitle", e.target.value)} placeholder="Développeur web, chargée de marketing, comptable…" aria-invalid={Boolean(errors["targetJobTitle"])} />
              {errors["targetJobTitle"] ? <p className="text-xs text-destructive">{errors["targetJobTitle"]}</p> : null}
              {guessedFamily ? (
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="size-3 text-primary" aria-hidden /> Famille détectée : <strong className="text-foreground">{JOB_FAMILIES[guessedFamily].label}</strong>
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Famille de métier <span className="font-normal text-muted-foreground">(ajuste si besoin)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(JOB_FAMILIES) as JobFamilyKey[]).map((k) => {
                  const on = (values.jobFamily ?? guessedFamily) === k;
                  return (
                    <button key={k} type="button" onClick={() => set("jobFamily", k)} aria-pressed={on} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary", on && "border-primary bg-primary-soft text-primary")}>
                      {JOB_FAMILIES[k].label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {current.key === "education" ? (
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>Niveau d'études visé (à la fin de l'alternance)</Label>
              <ChipSelect aria-label="Niveau d'études" columns={2} size="sm" options={EDUCATION_LEVEL_KEYS.map((k) => ({ value: k, label: EDUCATION_LEVELS[k].label, description: EDUCATION_LEVELS[k].examples }))} value={values.educationLevel} onChange={(v) => set("educationLevel", v as EducationLevel | null)} />
              {errors["educationLevel"] ? <p className="text-xs text-destructive">{errors["educationLevel"]}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="educationTitle">Formation</Label>
                <Input id="educationTitle" value={values.educationTitle ?? ""} onChange={(e) => set("educationTitle", e.target.value)} placeholder="BTS SIO, BUT GEA, Master marketing…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school">École</Label>
                <Input id="school" value={values.school ?? ""} onChange={(e) => set("school", e.target.value)} placeholder="Nom de ton école ou CFA" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schoolCity">Ville de l'école <span className="font-normal text-muted-foreground">(pour les trajets)</span></Label>
              <CityAutocomplete id="schoolCity" value={values.schoolCity ?? ""} onChange={(v) => set("schoolCity", v)} placeholder="Nantes" />
            </div>
          </div>
        ) : null}

        {current.key === "location" ? (
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="city">Ta ville</Label>
              <CityAutocomplete id="city" value={values.city} onChange={(v) => set("city", v)} placeholder="Nantes, Rennes, Angers…" aria-invalid={Boolean(errors["city"])} />
              {errors["city"] ? <p className="text-xs text-destructive">{errors["city"]}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Mobilité</Label>
              <ChipSelect aria-label="Mobilité" columns={2} size="sm" options={(Object.keys(MOBILITIES) as Mobility[]).map((k) => ({ value: k, label: MOBILITIES[k].label, description: MOBILITIES[k].description }))} value={values.mobility} onChange={(v) => set("mobility", (v as Mobility | null) ?? "DEPARTMENT")} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Rayon maximum</Label>
                <span className="text-sm font-medium tabular-nums">{values.maxRadiusKm} km</span>
              </div>
              <Slider min={5} max={100} step={5} value={[values.maxRadiusKm]} onValueChange={(v) => set("maxRadiusKm", v[0] ?? 30)} aria-label="Rayon maximum en kilomètres" />
              <div className="flex flex-wrap gap-1.5">
                {RADIUS_OPTIONS.map((r) => (
                  <button key={r} type="button" onClick={() => set("maxRadiusKm", r)} className={cn("rounded-full border px-2.5 py-1 text-xs", values.maxRadiusKm === r && "border-primary bg-primary-soft text-primary")}>
                    {r} km
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                <span className="text-sm font-medium">Permis B</span>
                <Switch checked={values.hasDrivingLicense} onCheckedChange={(v) => set("hasDrivingLicense", v)} aria-label="Permis B" />
              </label>
              <label className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                <span className="text-sm font-medium">Véhicule</span>
                <Switch checked={values.hasVehicle} onCheckedChange={(v) => set("hasVehicle", v)} aria-label="Véhicule" />
              </label>
            </div>
            <div className="space-y-2">
              <Label>Télétravail souhaité</Label>
              <ChipSelect aria-label="Télétravail" columns={3} size="sm" options={REMOTE_POLICY_CHOICES.map((k) => ({ value: k, label: REMOTE_POLICIES[k].label }))} value={values.remotePreference} onChange={(v) => set("remotePreference", v as RemotePolicy | null)} />
            </div>
          </div>
        ) : null}

        {current.key === "contract" ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Date de début souhaitée</Label>
                <Input id="startDate" type="date" value={values.startDate ?? ""} onChange={(e) => set("startDate", e.target.value || null)} />
              </div>
              <div className="space-y-2">
                <Label>Durée</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DURATIONS.map((d) => (
                    <button key={d} type="button" onClick={() => set("durationMonths", d)} aria-pressed={values.durationMonths === d} className={cn("rounded-lg border px-3 py-2 text-sm", values.durationMonths === d && "border-primary bg-primary-soft text-primary")}>
                      {d} mois
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rythme école / entreprise</Label>
              <ChipSelect aria-label="Rythme" columns={2} size="sm" options={(Object.keys(WORK_RHYTHMS) as WorkRhythm[]).map((k) => ({ value: k, label: WORK_RHYTHMS[k].label }))} value={values.rhythm} onChange={(v) => set("rhythm", v as WorkRhythm | null)} />
            </div>
            <div className="space-y-2">
              <Label>Type de contrat</Label>
              <ChipSelect aria-label="Type de contrat" multiple columns={2} size="sm" options={(Object.keys(CONTRACT_TYPES) as ContractType[]).map((k) => ({ value: k, label: CONTRACT_TYPES[k].label }))} value={values.contractTypes} onChange={(v) => set("contractTypes", (v as ContractType[]) ?? [])} />
            </div>
          </div>
        ) : null}

        {current.key === "skills" ? (
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="skills">Tes compétences</Label>
              <SkillsInput id="skills" value={values.skills} onChange={(v) => set("skills", v)} suggestions={familySkills} />
              {errors["skills"] ? <p className="text-xs text-destructive">{errors["skills"]}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Secteurs qui t'intéressent <span className="font-normal text-muted-foreground">(optionnel)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {SECTOR_KEYS.map((k) => {
                  const on = values.sectors.includes(k);
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => set("sectors", on ? values.sectors.filter((s) => s !== k) : [...values.sectors, k])} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary", on && "border-primary bg-primary-soft text-primary")}>
                      {SECTORS[k].emoji} {SECTORS[k].label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">En une phrase, ce que tu cherches <span className="font-normal text-muted-foreground">(optionnel, utilisé par le copilote)</span></Label>
              <Textarea id="bio" value={values.bio ?? ""} onChange={(e) => set("bio", e.target.value)} placeholder="Ex : je veux progresser sur React dans une équipe produit, idéalement une PME nantaise." className="min-h-20" />
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
            <ArrowLeft /> Retour
          </Button>
          <Button type="button" onClick={next} loading={pending} size="lg">
            {step === STEPS.length - 1 ? (mode === "onboarding" ? "Créer mon assistant" : "Enregistrer") : "Continuer"} {!pending ? <ArrowRight /> : null}
          </Button>
        </div>
      </div>
      {mode === "onboarding" ? <p className="mt-4 text-center text-xs text-muted-foreground">Tu pourras tout modifier ensuite dans tes paramètres.</p> : null}
    </div>
  );
}
