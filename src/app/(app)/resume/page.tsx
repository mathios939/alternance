import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, RefreshCw } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getResumeJobComparison, getResumeLatestVersion, getResumes } from "@/features/resume/server/queries";
import { ResumeList } from "@/features/resume/components/resume-list";
import { ResumeUpload } from "@/features/resume/components/resume-upload";
import { ResumeScore } from "@/features/resume/components/resume-score";
import { ResumeEditor } from "@/features/resume/components/resume-editor";
import { ResumeJobComparisonView } from "@/features/resume/components/resume-job-comparison";
import { ReanalyzeButton } from "@/features/resume/components/reanalyze-button";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const metadata: Metadata = { title: "Mon CV" };

export default async function ResumePage(props: PageProps<"/resume">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const resumes = await getResumes(user.id);
  const requested = typeof params["resume"] === "string" ? params["resume"] : null;
  const selected = resumes.find((r) => r.id === requested) ?? resumes[0] ?? null;
  const jobSlug = typeof params["job"] === "string" ? params["job"] : null;
  const [version, comparison] = await Promise.all([
    selected ? getResumeLatestVersion(user.id, selected.id) : null,
    selected && jobSlug ? getResumeJobComparison(user.id, selected.id, jobSlug) : null,
  ]);

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Mon CV" description="Importe ton CV, obtiens un score expliqué, garde plusieurs versions et adapte-les à chaque offre." actions={selected && version?.hasFile ? <Button asChild variant="outline"><a href={`/api/resume/${version.id}/file`}><Download /> Télécharger</a></Button> : null} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <ResumeList resumes={resumes} selectedId={selected?.id ?? null} />
          {selected ? <ResumeUpload resumeId={selected.id} compact /> : null}
        </aside>
        <div className="space-y-6">
          {comparison ? <ResumeJobComparisonView job={comparison.job} comparison={comparison.comparison} resumeId={selected!.id} /> : null}
          {!selected ? (
            <div className="space-y-4">
              <ResumeUpload />
              <EmptyState icon={FileText} title="Aucun CV pour le moment" description="Importe un PDF ou rédige ton CV directement. Tu pourras créer plusieurs versions (Développement, Data, Cybersécurité…)." />
            </div>
          ) : !version ? (
            <div className="space-y-4">
              <ResumeUpload resumeId={selected.id} />
              <div className="surface p-5">
                <p className="mb-3 font-semibold">Ou rédige-le ici</p>
                <ResumeEditor resumeId={selected.id} initialText={null} />
              </div>
            </div>
          ) : (
            <Tabs defaultValue={comparison ? "analysis" : "analysis"}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="analysis">Analyse</TabsTrigger>
                  <TabsTrigger value="content">Contenu</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Version {version.version} · {version.fileName ?? "texte"}</span>
                  <ReanalyzeButton resumeId={selected.id} />
                </div>
              </div>
              <TabsContent value="analysis" className="surface p-5">
                {version.analysis ? <ResumeScore analysis={version.analysis} /> : <EmptyState compact icon={RefreshCw} title="Pas encore d'analyse" description="Lance l'analyse pour obtenir ton score." />}
                {!jobSlug ? (
                  <p className="mt-5 text-sm text-muted-foreground">
                    Astuce : depuis une offre, clique sur <strong>« Adapter mon CV »</strong> pour comparer ce CV à l'annonce. <Link href="/jobs?sort=match" className="text-primary hover:underline">Voir mes meilleures offres</Link>
                  </p>
                ) : null}
              </TabsContent>
              <TabsContent value="content" className="space-y-4">
                <div className="surface p-5">
                  <p className="mb-3 font-semibold">Modifier le contenu</p>
                  <ResumeEditor resumeId={selected.id} initialText={version.extractedText} />
                </div>
                <Collapsible className="surface p-5">
                  <CollapsibleTrigger className="text-sm font-medium text-primary hover:underline">Voir le texte extrait tel quel</CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-muted/50 p-3 text-xs whitespace-pre-wrap">{version.extractedText}</pre>
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
