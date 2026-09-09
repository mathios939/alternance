import { BadgeCheck, Building2, Mail, ShieldAlert, Sparkles, UserRound } from "lucide-react";
import { LinkedInIcon } from "@/components/shared/brand-icons";
import { Badge } from "@/components/ui/badge";
import { DataBadge } from "@/components/shared/data-badge";
import { ReportDialog } from "@/features/reports/components/report-dialog";
import { cn, initials } from "@/lib/utils";
import type { ContactSource, DataOrigin } from "@/generated/prisma/enums";

export type ContactCardData = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string | null;
  linkedinUrl: string | null;
  email: string | null;
  source: ContactSource;
  sourceUrl: string | null;
  verifiedAt: Date | string | null;
  confidenceScore: number;
  dataOrigin: DataOrigin;
  isDemo: boolean;
};

const SOURCE_LABEL: Record<ContactSource, string> = {
  COMPANY_WEBSITE: "Site de l'entreprise",
  PUBLIC_PROFILE: "Profil public",
  PRESS: "Presse",
  USER_PROVIDED: "Ajouté par un utilisateur",
  DEMO: "Démonstration",
};

export function ContactCard({ contact, recommended, reason, className }: { contact: ContactCardData; recommended?: boolean; reason?: string; className?: string }) {
  return (
    <div className={cn("surface relative p-4", recommended && "border-primary/40 shadow-glow", className)}>
      {recommended ? (
        <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
          <Sparkles className="size-3" aria-hidden /> Personne recommandée
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground" aria-hidden>
          {initials(`${contact.firstName} ${contact.lastName}`)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {contact.firstName} {contact.lastName}
          </p>
          <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>
          {contact.department ? (
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="size-3" aria-hidden /> {contact.department}
            </p>
          ) : null}
        </div>
        {contact.isDemo ? <DataBadge kind="DEMO" /> : contact.verifiedAt ? <DataBadge kind="REAL" /> : <DataBadge kind="ESTIMATED" />}
      </div>
      {reason ? (
        <p className="mt-3 rounded-lg bg-primary-soft/50 px-3 py-2 text-sm">
          <span className="font-medium">Pourquoi :</span> {reason}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {contact.linkedinUrl ? (
          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-accent">
            <LinkedInIcon className="size-3.5" /> LinkedIn
          </a>
        ) : null}
        {contact.email ? (
          <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-accent">
            <Mail className="size-3.5" aria-hidden /> {contact.email}
          </a>
        ) : null}
        {!contact.linkedinUrl && !contact.email ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <ShieldAlert className="size-3.5" aria-hidden /> Aucune coordonnée vérifiée : passe par le site carrières ou LinkedIn.
          </span>
        ) : null}
        <Badge variant="muted" className="font-normal" title="Fiabilité estimée de la fiche">
          <BadgeCheck aria-hidden /> Confiance {contact.confidenceScore} %
        </Badge>
        <span className="text-muted-foreground">Source : {SOURCE_LABEL[contact.source]}</span>
        <ReportDialog target={{ contactId: contact.id }} kind="contact" />
      </div>
      <UserRound className="hidden" aria-hidden />
    </div>
  );
}
