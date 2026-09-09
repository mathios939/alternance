"use client";

import { AlertCircle, CalendarClock, Clock, GripVertical, Sparkles } from "lucide-react";
import type { ApplicationCardData } from "@/features/applications/types";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { CompanyLogo } from "@/features/jobs/components/job-card";
import { Badge } from "@/components/ui/badge";

export function ApplicationCard({ app, onOpen, dragging = false, handleProps }: { app: ApplicationCardData; onOpen: (id: string) => void; dragging?: boolean; handleProps?: React.HTMLAttributes<HTMLButtonElement> }) {
  return (
    <div className={cn("surface group relative p-3 transition-shadow", dragging && "rotate-1 shadow-lg ring-2 ring-primary/30", app.needsFollowUp && "border-warning/50")}>
      <button type="button" className="absolute top-2 right-1.5 cursor-grab touch-none rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing" aria-label="Déplacer la candidature" {...handleProps}>
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={() => onOpen(app.id)} className="w-full text-left" aria-label={`Ouvrir la candidature ${app.company.name}`}>
        <div className="flex items-start gap-2.5 pr-5">
          <CompanyLogo name={app.company.name} logoUrl={app.company.logoUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{app.company.name}</p>
            <p className="truncate text-xs text-muted-foreground">{app.job?.title ?? "Candidature spontanée"}</p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {app.matchScore !== null ? (
            <Badge variant={app.matchScore >= 85 ? "success" : app.matchScore >= 70 ? "soft" : "muted"} className="gap-1 font-medium tabular-nums">
              <Sparkles aria-hidden /> {app.matchScore} %
            </Badge>
          ) : null}
          {app.isSpontaneous ? <Badge variant="outline" className="font-normal">Spontanée</Badge> : null}
          {app.needsFollowUp ? (
            <Badge variant="warning" className="gap-1 font-medium">
              <AlertCircle aria-hidden /> À relancer
            </Badge>
          ) : null}
          {app.nextInterviewAt ? (
            <Badge variant="info" className="gap-1 font-normal">
              <CalendarClock aria-hidden /> {formatDateTime(app.nextInterviewAt)}
            </Badge>
          ) : null}
        </div>
        {app.daysSinceApplied !== null || app.nextAction ? (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            {app.daysSinceApplied !== null ? `Envoyée il y a ${app.daysSinceApplied} j` : app.nextAction}
            {app.followUpCount > 0 ? ` · ${app.followUpCount} relance${app.followUpCount > 1 ? "s" : ""}` : ""}
          </p>
        ) : null}
      </button>
    </div>
  );
}
