import type { ApplicationStatus, ApplicationEventType, OutreachChannel, DocumentKind } from "@/generated/prisma/enums";

export type ApplicationCardData = {
  id: string;
  status: ApplicationStatus;
  position: number;
  appliedAt: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  notes: string | null;
  matchScore: number | null;
  isSpontaneous: boolean;
  followUpCount: number;
  lastFollowUpAt: string | null;
  followUpSnoozedUntil: string | null;
  channel: OutreachChannel | null;
  createdAt: string;
  updatedAt: string;
  job: { id: string; slug: string; title: string; city: string; isDemo: boolean } | null;
  company: { id: string; slug: string; name: string; logoUrl: string | null; city: string };
  contact: { id: string; name: string; jobTitle: string } | null;
  resume: { id: string; title: string } | null;
  coverLetter: { id: string; title: string } | null;
  nextInterviewAt: string | null;
  needsFollowUp: boolean;
  daysSinceApplied: number | null;
};

export type ApplicationDetailData = ApplicationCardData & {
  events: Array<{ id: string; type: ApplicationEventType; fromStatus: ApplicationStatus | null; toStatus: ApplicationStatus | null; createdAt: string; payload: unknown }>;
  documents: Array<{ id: string; kind: DocumentKind; title: string; createdAt: string; provider: string | null }>;
  interviews: Array<{ id: string; scheduledAt: string; type: string; status: string }>;
  availableContacts: Array<{ id: string; name: string; jobTitle: string }>;
  availableResumes: Array<{ id: string; title: string }>;
};

export type BoardData = {
  columns: Record<ApplicationStatus, ApplicationCardData[]>;
  followUps: Array<{ applicationId: string; companyName: string; jobTitle: string | null; daysSinceApplied: number; followUpCount: number; urgency: "high" | "normal" }>;
  total: number;
};
