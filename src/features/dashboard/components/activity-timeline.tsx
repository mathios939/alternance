import { Briefcase, Bookmark, FileText, KanbanSquare, MessageSquare, RefreshCw, Sparkles, UserRound, CalendarClock, CheckCircle2, Eye, Bot } from "lucide-react";
import type { ActivityType } from "@/generated/prisma/enums";
import { RelativeTime } from "@/components/shared/relative-time";
import { EmptyState } from "@/components/shared/empty-state";

const ICONS: Record<ActivityType, typeof Briefcase> = {
  PROFILE_UPDATED: UserRound,
  JOB_VIEWED: Eye,
  JOB_SAVED: Bookmark,
  APPLICATION_CREATED: KanbanSquare,
  APPLICATION_STATUS_CHANGED: KanbanSquare,
  FOLLOW_UP_SENT: RefreshCw,
  RESUME_UPLOADED: FileText,
  RESUME_ANALYZED: FileText,
  DOCUMENT_GENERATED: Sparkles,
  INTERVIEW_SCHEDULED: CalendarClock,
  COMPANY_CONTACTED: MessageSquare,
  DAILY_ACTION_COMPLETED: CheckCircle2,
  COPILOT_USED: Bot,
};

export function ActivityTimeline({ items }: { items: Array<{ id: string; type: ActivityType; title: string; createdAt: Date }> }) {
  if (items.length === 0) return <EmptyState compact title="Pas encore d'activité" description="Tes candidatures, favoris et relances apparaîtront ici." />;
  return (
    <ol className="relative space-y-0 border-l pl-5">
      {items.map((a) => {
        const Icon = ICONS[a.type];
        return (
          <li key={a.id} className="relative pb-5 last:pb-0">
            <span className="absolute top-0.5 -left-[29px] flex size-4 items-center justify-center rounded-full border bg-card">
              <Icon className="size-2.5 text-muted-foreground" aria-hidden />
            </span>
            <p className="text-sm">{a.title}</p>
            <p className="text-xs text-muted-foreground"><RelativeTime date={a.createdAt} /></p>
          </li>
        );
      })}
    </ol>
  );
}
