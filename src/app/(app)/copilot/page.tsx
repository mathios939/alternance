import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { AI_UNAVAILABLE_MESSAGE, isAIUnavailable, isMockAI } from "@/lib/ai";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bot } from "lucide-react";
import { getContextSummary, getConversation, getConversations, getDocument, getDocuments } from "@/features/copilot/server/queries";
import { CopilotChat } from "@/features/copilot/components/copilot-chat";
import { CopilotSidebar } from "@/features/copilot/components/copilot-sidebar";
import { DocumentGenerator } from "@/features/copilot/components/document-generator";
import { PageContainer } from "@/components/layout/app-shell";
import type { DocumentKindKey } from "@/lib/ai/prompts";

export const metadata: Metadata = { title: "Copilote" };

const KINDS: DocumentKindKey[] = ["cover_letter", "email", "linkedin_message", "follow_up", "interview_prep", "resume_adaptation", "spontaneous_email", "spontaneous_pitch"];

function str(v: string | string[] | undefined): string | null {
  return typeof v === "string" && v ? v : null;
}

export default async function CopilotPage(props: PageProps<"/copilot">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const convId = str(params["c"]);
  const docId = str(params["document"]);
  const intent = str(params["intent"]);
  const ctxParams = { jobSlug: str(params["job"]), companySlug: str(params["company"]), applicationId: str(params["application"]), interviewId: str(params["interview"]), resumeId: str(params["resume"]) };
  const [conversations, documents, conversation, document, summary] = await Promise.all([
    getConversations(user.id),
    getDocuments(user.id),
    convId ? getConversation(user.id, convId) : null,
    docId ? getDocument(user.id, docId) : null,
    getContextSummary(user.id, ctxParams),
  ]);
  const kind = intent && (KINDS as string[]).includes(intent) ? (intent as DocumentKindKey) : null;
  const mock = isMockAI();
  const unavailable = isAIUnavailable();

  return (
    <PageContainer wide className="h-[calc(100vh-4rem)] py-4 sm:py-4">
      <h1 className="sr-only">Copilote IA</h1>
      {unavailable ? (
        <Alert variant="warning" className="mb-4">
          <Bot />
          <AlertTitle>{AI_UNAVAILABLE_MESSAGE}</AlertTitle>
          <AlertDescription>Aucun fournisseur IA n'est configuré sur ce déploiement (AI_PROVIDER, ANTHROPIC_API_KEY ou OPENAI_API_KEY). Le reste de l'application fonctionne normalement ; aucune réponse n'est simulée.</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid h-full gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="surface hidden overflow-y-auto p-4 lg:block scrollbar-thin">
          <CopilotSidebar conversations={conversations} documents={documents} activeId={convId} activeDocId={docId} />
        </aside>
        <section className="surface flex min-h-0 flex-col overflow-hidden">
          {document ? (
            <DocumentGenerator kind={KINDS.find((k) => k.toUpperCase() === document.kind || (document.kind === "EMAIL" && k === "email")) ?? "email"} params={{ applicationId: document.applicationId }} contextLabel={document.title} existing={{ id: document.id, title: document.title, content: document.content, provider: document.provider ?? "mock", model: document.model ?? "", isDemo: document.provider === "mock" }} autoStart={false} />
          ) : kind ? (
            <DocumentGenerator kind={kind} params={ctxParams} contextLabel={summary.label} />
          ) : (
            <CopilotChat key={conversation?.id ?? "new"} conversationId={conversation?.id ?? null} initialMessages={conversation?.messages ?? []} isMock={mock} contextLabel={summary.label} contextParams={{ jobSlug: ctxParams.jobSlug, companySlug: ctxParams.companySlug, applicationId: ctxParams.applicationId }} initialPrompt={str(params["q"])} />
          )}
        </section>
      </div>
    </PageContainer>
  );
}
