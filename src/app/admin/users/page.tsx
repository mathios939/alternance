import { listUsersAdmin } from "@/features/admin/server/queries";
import { AdminSearch } from "@/features/admin/components/admin-search";
import { UserControls } from "@/features/admin/components/admin-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelative, formatDate } from "@/lib/format";

export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  const params = await props.searchParams;
  const q = typeof params["q"] === "string" ? params["q"] : "";
  const { items, total } = await listUsersAdmin(1, q);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><AdminSearch placeholder="Rechercher par email ou nom" basePath="/admin/users" /><p className="text-sm text-muted-foreground">{total} utilisateurs</p></div>
      <div className="surface overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Profil</TableHead><TableHead>Inscription</TableHead><TableHead>Actif</TableHead><TableHead>Cand.</TableHead><TableHead>Rôle & plan</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((u) => (
              <TableRow key={u.id}>
                <TableCell><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.profile ? `${u.profile.targetJobTitle ?? "—"} · ${u.profile.city ?? "—"} · ${u.profile.completionScore} %` : u.onboardingCompletedAt ? "—" : "Onboarding non terminé"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.lastActiveAt ? formatRelative(u.lastActiveAt) : "—"}</TableCell>
                <TableCell className="tabular-nums">{u._count.applications}</TableCell>
                <TableCell><UserControls userId={u.id} role={u.role} plan={u.plan} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
