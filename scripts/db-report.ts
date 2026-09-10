/**
 * ÉTAT DE LA BASE (production ou locale) : compteurs réels, sans aucune donnée personnelle.
 *
 *   npm run db:report
 *
 * Sert au contrôle après migration et après ingestion : offres réelles actives, liens de
 * candidature, entreprises rapprochées, doublons, données de démonstration, dernières exécutions.
 */
import { disconnectPrisma, EXIT, heading, info, ok, runMain, warn } from "./lib/bootstrap";

runMain(async () => {
  const { prisma } = await import("../src/lib/db");
  const visible = { isActive: true, canonicalJobId: null, verificationStatus: { notIn: ["EXPIRED", "REMOVED"] as ("EXPIRED" | "REMOVED")[] } };
  const [realActive, demoActive, withUrl, withCoords, hidden, companiesReal, companiesDemo, placeholder, contactsReal, contactsDemo, e2eUsers, sources, runs] = await Promise.all([
    prisma.job.count({ where: { ...visible, isDemo: false } }),
    prisma.job.count({ where: { ...visible, isDemo: true } }),
    prisma.job.count({ where: { ...visible, isDemo: false, applicationUrl: { not: null } } }),
    prisma.job.count({ where: { ...visible, isDemo: false, latitude: { not: null } } }),
    prisma.job.count({ where: { canonicalJobId: { not: null } } }),
    prisma.company.count({ where: { isDemo: false, isPlaceholder: false } }),
    prisma.company.count({ where: { isDemo: true } }),
    prisma.company.count({ where: { isPlaceholder: true } }),
    prisma.contact.count({ where: { isDemo: false } }),
    prisma.contact.count({ where: { isDemo: true } }),
    prisma.user.count({ where: { email: { endsWith: "@alternance.test" } } }),
    prisma.jobSource.findMany({ select: { key: true, name: true, jobsCount: true, lastSyncAt: true, lastSyncStatus: true }, orderBy: { key: "asc" } }),
    prisma.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 5, select: { sourceKey: true, trigger: true, status: true, startedAt: true, durationMs: true, fetchedCount: true, createdCount: true, updatedCount: true, duplicateCount: true, rejectedCount: true, failedCount: true } }),
  ]);
  const byCity = await prisma.job.groupBy({ by: ["city"], where: { ...visible, isDemo: false }, _count: { _all: true }, orderBy: { _count: { city: "desc" } }, take: 8 });

  heading("Offres");
  ok(`Offres réelles actives : ${realActive} (${withUrl} avec lien de candidature, ${withCoords} géolocalisées, ${hidden} doublons rattachés)`);
  (demoActive > 0 ? warn : ok)(`Offres de démonstration actives en base : ${demoActive}${demoActive > 0 ? " (invisibles si DEMO_MODE=false)" : ""}`);
  for (const c of byCity) info(`${c.city} : ${c._count._all}`);

  heading("Entreprises et contacts");
  ok(`Entreprises réelles : ${companiesReal} · fiches techniques « employeur non communiqué » : ${placeholder}`);
  (companiesDemo > 0 ? warn : ok)(`Entreprises de démonstration : ${companiesDemo}`);
  ok(`Contacts réels : ${contactsReal} · contacts de démonstration : ${contactsDemo}`);
  (e2eUsers > 0 ? warn : ok)(`Comptes de test (@alternance.test) : ${e2eUsers}`);

  heading("Sources");
  for (const s of sources) info(`${s.name} (${s.key}) : ${s.jobsCount} offre(s) créées · dernière synchro ${s.lastSyncAt?.toISOString() ?? "jamais"} · ${s.lastSyncStatus ?? "—"}`);

  heading("Dernières exécutions");
  if (runs.length === 0) warn("Aucune exécution d'ingestion enregistrée.");
  for (const r of runs) info(`${r.startedAt.toISOString()} · ${r.sourceKey} · ${r.trigger} · ${r.status} · ${r.fetchedCount} récupérées, ${r.createdCount} créées, ${r.updatedCount} mises à jour, ${r.duplicateCount} rattachées, ${r.rejectedCount} rejetées, ${r.failedCount} en erreur · ${r.durationMs ?? "?"} ms`);

  await disconnectPrisma();
  return EXIT.OK;
});
