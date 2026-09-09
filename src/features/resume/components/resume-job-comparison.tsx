import Link from "next/link";
import { ArrowRight, Check, Lightbulb, Minus, X } from "lucide-react";
import type { ResumeJobComparison } from "@/features/resume/lib/compare";
import { skillDisplayName } from "@/lib/skills";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ResumeJobComparisonView({ job, comparison, resumeId }: { job: { slug: string; title: string; companyName: string }; comparison: ResumeJobComparison; resumeId: string }) {
  return (
    <section className="surface space-y-5 p-5" aria-labelledby="compare-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Adapter mon CV à cette offre</p>
          <h2 id="compare-title" className="text-lg font-semibold">{job.title} · {job.companyName}</h2>
          <p className="text-sm text-muted-foreground">Aucune compétence n'est ajoutée à ta place : on te dit quoi mettre en avant, et ce qui manque vraiment.</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link href={`/jobs/${job.slug}`}>Voir l'offre <ArrowRight /></Link></Button>
      </div>
      <div>
        <div className="flex items-center justify-between text-sm"><span>Couverture des compétences de l'offre</span><span className="font-semibold tabular-nums">{comparison.coverage} %</span></div>
        <Progress value={comparison.coverage} className="mt-2" indicatorClassName={comparison.coverage >= 70 ? "bg-success" : comparison.coverage >= 40 ? "bg-primary" : "bg-warning"} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card/60 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-success"><Check className="size-4" aria-hidden /> Compétences à mettre en avant</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{comparison.matchedSkills.length ? comparison.matchedSkills.map((s) => <Badge key={s} variant="success">{skillDisplayName(s)}</Badge>) : <span className="text-sm text-muted-foreground">Aucune compétence commune détectée.</span>}</div>
        </div>
        <div className="rounded-xl border bg-card/60 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-warning-foreground dark:text-warning"><X className="size-4" aria-hidden /> Manquantes dans ton CV</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{comparison.missingSkills.length ? comparison.missingSkills.map((s) => <Badge key={s} variant="warning">{skillDisplayName(s)}</Badge>) : <span className="text-sm text-muted-foreground">Rien ne manque, bravo.</span>}</div>
          {comparison.missingSkills.length ? <p className="mt-2 text-xs text-muted-foreground">Ne les invente pas. Si tu es en train de les apprendre, dis-le honnêtement (projet, cours, certification en cours).</p> : null}
        </div>
      </div>
      {comparison.experiencesToHighlight.length ? (
        <div className="rounded-xl border bg-card/60 p-4">
          <p className="text-sm font-semibold">Expériences à développer</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {comparison.experiencesToHighlight.map((e) => (
              <li key={e.title}><span className="font-medium">{e.title}</span> <span className="text-muted-foreground">— vocabulaire commun : {e.overlap.join(", ")}</span></li>
            ))}
          </ul>
        </div>
      ) : null}
      {comparison.missingKeywords.length ? (
        <div className="rounded-xl border bg-card/60 p-4">
          <p className="text-sm font-semibold">Mots-clés de l'annonce absents de ton CV</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{comparison.missingKeywords.map((k) => <Badge key={k} variant="muted">{k}</Badge>)}</div>
          <p className="mt-2 text-xs text-muted-foreground">Reprends-les seulement s'ils correspondent à une réalité de ton parcours.</p>
        </div>
      ) : null}
      {comparison.lowRelevanceSkills.length > 3 ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Minus className="size-4" aria-hidden /> À condenser (peu liés à l'offre) : {comparison.lowRelevanceSkills.map(skillDisplayName).join(", ")}.</p>
      ) : null}
      <div className="rounded-xl bg-primary-soft/50 p-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold"><Lightbulb className="size-4 text-primary" aria-hidden /> Plan d'action</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{comparison.suggestions.map((s) => <li key={s}>{s}</li>)}</ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm"><Link href={`/copilot?intent=resume_adaptation&job=${job.slug}&resume=${resumeId}`}>Rédiger la version adaptée avec le copilote</Link></Button>
        </div>
      </div>
    </section>
  );
}
