"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Handshake, Plus, Search, Trash2 } from "lucide-react";
import type { OutreachChannel, OutreachStatus } from "@/generated/prisma/enums";
import type { OutreachRow } from "@/features/outreach/server/queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { CompanyLogo } from "@/features/jobs/components/job-card";
import { createOutreach, deleteOutreach, updateOutreach } from "@/features/outreach/server/actions";

const CHANNELS: Record<OutreachChannel, string> = { EMAIL: "Email", LINKEDIN: "LinkedIn", PHONE: "Téléphone", FORM: "Formulaire", IN_PERSON: "En personne" };
const STATUSES: Record<OutreachStatus, { label: string; variant: "muted" | "soft" | "success" | "warning" | "outline" }> = {
  PLANNED: { label: "Planifié", variant: "muted" },
  SENT: { label: "Envoyé", variant: "soft" },
  REPLIED: { label: "Réponse reçue", variant: "success" },
  NO_REPLY: { label: "Sans réponse", variant: "warning" },
  CLOSED: { label: "Clôturé", variant: "outline" },
};

type CompanyHit = { id: string; slug: string; name: string; city: string; contacts: Array<{ id: string; name: string; jobTitle: string }> };

function NewOutreachDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CompanyHit[]>([]);
  const [company, setCompany] = useState<CompanyHit | null>(null);
  const [contactId, setContactId] = useState<string>("none");
  const [channel, setChannel] = useState<OutreachChannel>("EMAIL");
  const [status, setStatus] = useState<OutreachStatus>("PLANNED");
  const [subject, setSubject] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2 || company) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/companies/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { items: CompanyHit[] }) => setHits(d.items))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, company]);

  function submit() {
    if (!company) return;
    startTransition(async () => {
      const r = await createOutreach({ companyId: company.id, contactId: contactId === "none" ? null : contactId, channel, status, subject, nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null, notes });
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Prise de contact ajoutée");
        setOpen(false);
        setCompany(null);
        setQ("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus /> Nouvelle prise de contact</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle prise de contact</DialogTitle>
          <DialogDescription>Consigne un message envoyé (ou à envoyer) à une entreprise. Rien n'est envoyé depuis ici.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company-search">Entreprise</Label>
            {company ? (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>{company.name} · <span className="text-muted-foreground">{company.city}</span></span>
                <Button variant="ghost" size="sm" onClick={() => setCompany(null)}>Changer</Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="company-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une entreprise" className="pl-9" autoComplete="off" />
                {hits.length > 0 ? (
                  <ul className="absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-xl border bg-popover p-1 shadow-lg" role="listbox">
                    {hits.map((h) => (
                      <li key={h.id} role="option" aria-selected={false} onMouseDown={() => { setCompany(h); setContactId("none"); }} className="cursor-pointer rounded-md px-3 py-2 text-sm hover:bg-accent">
                        {h.name} <span className="text-xs text-muted-foreground">· {h.city}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
          {company && company.contacts.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Interlocuteur</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun / inconnu</SelectItem>
                  {company.contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.jobTitle}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as OutreachChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(CHANNELS) as OutreachChannel[]).map((c) => <SelectItem key={c} value={c}>{CHANNELS[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as OutreachStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(STATUSES) as OutreachStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUSES[s].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Objet</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Candidature spontanée développeuse web" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">Prochaine relance</Label>
            <Input id="next" type="date" value={nextFollowUpAt} onChange={(e) => setNextFollowUpAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!company} loading={pending}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OutreachTable({ rows }: { rows: OutreachRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const now = Date.now();
  function patch(id: string, input: Parameters<typeof updateOutreach>[1], msg?: string) {
    startTransition(async () => {
      const r = await updateOutreach(id, input);
      if (!r.ok) toast.error(r.error);
      else if (msg) toast.success(msg);
      router.refresh();
    });
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><NewOutreachDialog /></div>
      {rows.length === 0 ? (
        <EmptyState icon={Handshake} title="Aucune prise de contact" description="Consigne ici tes candidatures spontanées, messages LinkedIn et appels : un CRM personnel simple." />
      ) : (
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernier contact</TableHead>
                <TableHead>Prochaine relance</TableHead>
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const overdue = r.nextFollowUpAt && new Date(r.nextFollowUpAt).getTime() < now && r.status !== "CLOSED" && r.status !== "REPLIED";
                return (
                  <TableRow key={r.id} className={cn(overdue && "bg-warning-soft/30")}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo name={r.company.name} logoUrl={r.company.logoUrl} size="sm" />
                        <div className="min-w-0">
                          <Link href={`/companies/${r.company.slug}`} className="block truncate font-medium hover:underline">{r.company.name}</Link>
                          <p className="truncate text-xs text-muted-foreground">{r.subject ?? r.company.city}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.contact ? <><span className="font-medium">{r.contact.name}</span><span className="block text-xs text-muted-foreground">{r.contact.jobTitle}</span></> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <Select value={r.channel} onValueChange={(v) => patch(r.id, { channel: v as OutreachChannel })}>
                        <SelectTrigger size="sm" className="w-32" aria-label="Canal"><SelectValue /></SelectTrigger>
                        <SelectContent>{(Object.keys(CHANNELS) as OutreachChannel[]).map((c) => <SelectItem key={c} value={c}>{CHANNELS[c]}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={r.status} onValueChange={(v) => patch(r.id, { status: v as OutreachStatus }, `Statut : ${STATUSES[v as OutreachStatus].label}`)}>
                        <SelectTrigger size="sm" className="w-36" aria-label="Statut"><SelectValue /></SelectTrigger>
                        <SelectContent>{(Object.keys(STATUSES) as OutreachStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUSES[s].label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.lastContactAt ? formatDate(r.lastContactAt) : "—"}</TableCell>
                    <TableCell>
                      <Input type="date" defaultValue={r.nextFollowUpAt ? r.nextFollowUpAt.slice(0, 10) : ""} onChange={(e) => patch(r.id, { nextFollowUpAt: e.target.value ? new Date(e.target.value).toISOString() : null })} className="h-8 w-36 text-xs" aria-label="Prochaine relance" />
                      {overdue ? <Badge variant="warning" className="mt-1">En retard</Badge> : null}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" disabled={pending} aria-label="Supprimer" onClick={() => { if (confirm("Supprimer cette prise de contact ?")) startTransition(async () => { const res = await deleteOutreach(r.id); if (!res.ok) toast.error(res.error); router.refresh(); }); }}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
