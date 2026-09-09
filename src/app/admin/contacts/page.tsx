import Link from "next/link";
import { listContactsAdmin } from "@/features/admin/server/queries";
import { AdminSearch } from "@/features/admin/components/admin-search";
import { ContactActions } from "@/features/admin/components/admin-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";

export default async function AdminContactsPage(props: PageProps<"/admin/contacts">) {
  const params = await props.searchParams;
  const q = typeof params["q"] === "string" ? params["q"] : "";
  const { items, total } = await listContactsAdmin(1, q);
  return (
    <div className="space-y-4">
      <Alert variant="info"><ShieldCheck /><AlertDescription>Les contacts proviennent uniquement de sources publiques. « Opposition » retire immédiatement la personne des recommandations (droit d'opposition RGPD) tout en évitant sa réimportation.</AlertDescription></Alert>
      <div className="flex flex-wrap items-center justify-between gap-3"><AdminSearch placeholder="Rechercher un nom ou une entreprise" basePath="/admin/contacts" /><p className="text-sm text-muted-foreground">{total} contacts</p></div>
      <div className="surface overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Contact</TableHead><TableHead>Entreprise</TableHead><TableHead>Source</TableHead><TableHead>Confiance</TableHead><TableHead>Origine</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id} className={c.optOutAt ? "opacity-60" : undefined}>
                <TableCell><p className="font-medium">{c.firstName} {c.lastName}</p><p className="text-xs text-muted-foreground">{c.jobTitle}</p></TableCell>
                <TableCell><Link href={`/companies/${c.company.slug}`} className="hover:underline">{c.company.name}</Link></TableCell>
                <TableCell className="text-xs">{c.source}</TableCell>
                <TableCell className="tabular-nums">{c.confidenceScore} %</TableCell>
                <TableCell><Badge variant={c.isDemo ? "warning" : c.verifiedAt ? "success" : "muted"}>{c.isDemo ? "Démo" : c.verifiedAt ? "Vérifié" : "Non vérifié"}</Badge></TableCell>
                <TableCell><ContactActions contactId={c.id} optedOut={Boolean(c.optOutAt)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
