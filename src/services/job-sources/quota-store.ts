import { prisma } from "@/lib/db";
import type { SharedQuotaStore } from "./quota";

/**
 * Compteur d'appels partagé en base (table `provider_quota`, une ligne par fournisseur et par minute).
 * L'incrément est atomique (upsert sur clé unique) : plusieurs workers voient le même total.
 */
export const prismaQuotaStore: SharedQuotaStore = {
  async reserve(provider, bucket, n) {
    const row = await prisma.providerQuota.upsert({
      where: { provider_bucket: { provider, bucket } },
      create: { provider, bucket, requests: n },
      update: { requests: { increment: n } },
      select: { requests: true },
    });
    return row.requests;
  },
  async usage(provider, bucket) {
    const row = await prisma.providerQuota.findUnique({
      where: { provider_bucket: { provider, bucket } },
      select: { requests: true },
    });
    return row?.requests ?? 0;
  },
};

/** Appels réservés sur les `minutes` dernières minutes (observabilité) et purge des compteurs de plus d'un jour. */
export async function recentQuotaUsage(
  provider: string,
  minutes = 60,
  now = new Date(),
): Promise<{ requests: number; minutes: number; peakPerMinute: number }> {
  const since = new Date(now.getTime() - minutes * 60_000);
  const rows = await prisma.providerQuota.findMany({
    where: { provider, bucket: { gte: since } },
    select: { requests: true },
  });
  return {
    requests: rows.reduce((s, r) => s + r.requests, 0),
    minutes,
    peakPerMinute: rows.reduce((m, r) => Math.max(m, r.requests), 0),
  };
}

export async function purgeQuotaCounters(olderThanHours = 24, now = new Date()): Promise<number> {
  const res = await prisma.providerQuota.deleteMany({
    where: { bucket: { lt: new Date(now.getTime() - olderThanHours * 3_600_000) } },
  });
  return res.count;
}
