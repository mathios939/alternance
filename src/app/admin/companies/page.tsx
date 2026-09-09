import Link from "next/link";
import { listCompaniesAdmin } from "@/features/admin/server/queries";
import { AdminSearch } from "@/features/admin/components/admin-search";
import { CompanyFlags } from "@/features/admin/components/admin-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { COMPANY_SIZES } from "@/config/taxonomy";

export default async function AdminCompaniesPage(props: PageProps<"/admin/companies">) {
  const params = await props.searchParams;
  const q = typeof params["q"] === "string" ? params["q"] : "";
  const { items, total } = await listCompaniesAdmin(1, q);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><AdminSearch placeholder="Rechercher une entreprise" basePath="/admin/companies" /><p className="text-sm text-muted-foreground">{total} entreprises</p></div>
      <div className="surface overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Entreprise</TableHead><TableHead>Ville</TableHead><TableHead>Taille</TableHead><TableHead>Offres</TableHead><TableHead>Contacts</TableHead><TableHead>Cand.</TableHead><TableHead>Origine</TableHead><TableHead>Drapeaux</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell><Link href={`/companies/${c.slug}`} className="font-medium hover:underline">{c.name}</Link></TableCell>
                <TableCell>{c.city}</TableCell>
                <TableCell>{COMPANY_SIZES[c.size].label}</TableCell>
                <TableCell className="tabular-nums">{c._count.jobs}</TableCell>
                <TableCell className="tabular-nums">{c._count.contacts}</TableCell>
                <TableCell className="tabular-nums">{c._count.applications}</TableCell>
                <TableCell><Badge variant={c.isDemo ? "warning" : "success"}>{c.dataOrigin}</Badge></TableCell>
                <TableCell><CompanyFlags companyId={c.id} hiresApprentices={c.hiresApprentices} isHiring={c.isHiring} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
