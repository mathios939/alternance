import { Prisma } from "@/generated/prisma/client";
import { DEPARTMENTS, departmentCodeFromPostal } from "@/config/departments";
import { prisma } from "@/lib/db";
import { VISIBLE_REAL_JOB_WHERE } from "./coverage";

/**
 * CONTRÔLE QUALITÉ NATIONAL (Phase 31) : taux de complétude et incohérences MESURÉS sur les offres
 * réelles visibles. Aucune donnée n'est corrigée ni inventée : ce rapport sert à décider.
 *
 *   • sans titre / sans entreprise (employeur non communiqué) / sans localisation exploitable /
 *     sans description / sans URL de candidature ;
 *   • doublons suspects (offres masquées derrière une canonique, entrées rattachées) ;
 *   • offres expirées ou retirées encore visibles (doit être 0 : exclues par construction) ;
 *   • département incohérent avec le code postal ;
 *   • coordonnées incohérentes (hors de France ou à plus de 150 km du centre du département) ;
 *   • offres obsolètes (non confirmées depuis 14 jours).
 */
export type QualityReport = {
  checkedAt: string;
  activeTotal: number;
  missingTitle: number;
  missingCompany: number;
  missingLocation: number;
  missingDescription: number;
  missingApplicationUrl: number;
  suspiciousDuplicates: { hiddenProbable: number; attachedEntries: number };
  expiredStillVisible: number;
  inconsistentDepartment: number;
  inconsistentCoordinates: number;
  stale: number;
  withoutCoordinates: number;
  completeness: Record<"title" | "company" | "location" | "description" | "applicationUrl" | "coordinates", number>;
};

/** Centres approximatifs des départements (préfecture), pour détecter des coordonnées aberrantes. */
const DEPARTMENT_CENTERS: Record<string, [number, number]> = {
  "01": [46.2, 5.23], "02": [49.57, 3.62], "03": [46.34, 3.43], "04": [44.09, 6.24], "05": [44.56, 6.08], "06": [43.7, 7.27], "07": [44.74, 4.6], "08": [49.77, 4.72], "09": [42.96, 1.61], "10": [48.3, 4.07],
  "11": [43.21, 2.35], "12": [44.35, 2.57], "13": [43.3, 5.37], "14": [49.18, -0.37], "15": [44.93, 2.44], "16": [45.65, 0.16], "17": [46.16, -1.15], "18": [47.08, 2.4], "19": [45.27, 1.77], "2A": [41.93, 8.74],
  "2B": [42.7, 9.45], "21": [47.32, 5.04], "22": [48.51, -2.77], "23": [46.17, 1.87], "24": [45.18, 0.72], "25": [47.24, 6.02], "26": [44.93, 4.89], "27": [49.02, 1.15], "28": [48.44, 1.49], "29": [48.39, -4.49],
  "30": [43.84, 4.36], "31": [43.6, 1.44], "32": [43.65, 0.59], "33": [44.84, -0.58], "34": [43.61, 3.88], "35": [48.11, -1.68], "36": [46.81, 1.69], "37": [47.39, 0.69], "38": [45.19, 5.72], "39": [46.67, 5.55],
  "40": [43.89, -0.5], "41": [47.59, 1.33], "42": [45.43, 4.39], "43": [45.04, 3.88], "44": [47.22, -1.55], "45": [47.9, 1.9], "46": [44.45, 1.44], "47": [44.2, 0.62], "48": [44.52, 3.5], "49": [47.47, -0.55],
  "50": [49.12, -1.09], "51": [49.04, 3.96], "52": [48.11, 5.14], "53": [48.07, -0.77], "54": [48.69, 6.18], "55": [49.16, 5.38], "56": [47.66, -2.76], "57": [49.12, 6.18], "58": [47.0, 3.16], "59": [50.63, 3.06],
  "60": [49.42, 2.83], "61": [48.43, 0.09], "62": [50.29, 2.78], "63": [45.78, 3.08], "64": [43.3, -0.37], "65": [43.23, 0.07], "66": [42.7, 2.9], "67": [48.58, 7.75], "68": [47.75, 7.34], "69": [45.76, 4.84],
  "70": [47.62, 6.15], "71": [46.78, 4.86], "72": [48.0, 0.2], "73": [45.57, 5.92], "74": [45.9, 6.13], "75": [48.86, 2.35], "76": [49.44, 1.1], "77": [48.54, 2.66], "78": [48.8, 2.13], "79": [46.32, -0.46],
  "80": [49.89, 2.3], "81": [43.93, 2.15], "82": [44.02, 1.36], "83": [43.12, 5.93], "84": [43.95, 4.81], "85": [46.67, -1.43], "86": [46.58, 0.34], "87": [45.83, 1.26], "88": [48.17, 6.45], "89": [47.8, 3.57],
  "90": [47.64, 6.86], "91": [48.63, 2.44], "92": [48.89, 2.24], "93": [48.91, 2.44], "94": [48.79, 2.45], "95": [49.03, 2.08],
  "971": [16.24, -61.53], "972": [14.62, -61.05], "973": [4.93, -52.33], "974": [-20.88, 55.45], "976": [-12.78, 45.23],
};

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function getQualityReport(now: Date = new Date()): Promise<QualityReport> {
  const visible = VISIBLE_REAL_JOB_WHERE;
  const staleBefore = new Date(now.getTime() - 14 * 86_400_000);
  const [activeTotal, missingTitle, missingCompany, missingLocation, missingDescription, missingApplicationUrl, hiddenProbable, attachedEntries, expiredStillVisible, stale, withoutCoordinates] =
    await Promise.all([
      prisma.job.count({ where: visible }),
      prisma.job.count({ where: { ...visible, title: "" } }),
      prisma.job.count({ where: { ...visible, OR: [{ companyNameRaw: null }, { company: { isPlaceholder: true } }] } }),
      prisma.job.count({ where: { ...visible, latitude: null, OR: [{ city: "" }, { city: "France" }] } }),
      prisma.job.count({ where: { ...visible, description: "" } }),
      prisma.job.count({ where: { ...visible, OR: [{ applicationUrl: null }, { applicationUrl: "" }] } }),
      prisma.job.count({ where: { isDemo: false, isActive: true, canonicalJobId: { not: null } } }),
      prisma.jobSourceEntry.count({ where: { duplicateConfidence: { not: null }, status: { in: ["ACTIVE", "UNKNOWN"] } } }),
      // Par construction 0 : la recherche exclut EXPIRED / REMOVED. Mesuré quand même (offres inactives visibles seraient une régression).
      prisma.job.count({ where: { isDemo: false, isActive: true, canonicalJobId: null, verificationStatus: { in: ["EXPIRED", "REMOVED"] } } }),
      prisma.job.count({ where: { ...visible, OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: staleBefore } }] } }),
      prisma.job.count({ where: { ...visible, OR: [{ latitude: null }, { longitude: null }] } }),
    ]);

  // Cohérence département ↔ code postal et coordonnées ↔ département (échantillon complet, colonnes légères).
  const rows = await prisma.job.findMany({
    where: visible,
    select: { postalCode: true, department: true, latitude: true, longitude: true },
  });
  const nameToCode = new Map(DEPARTMENTS.map((d) => [d.name, d.code]));
  let inconsistentDepartment = 0;
  let inconsistentCoordinates = 0;
  for (const r of rows) {
    const code = r.department ? nameToCode.get(r.department) : undefined;
    const fromPostal = departmentCodeFromPostal(r.postalCode);
    if (code && fromPostal && code !== fromPostal) inconsistentDepartment++;
    if (r.latitude !== null && r.longitude !== null) {
      const inFrance = (r.latitude >= 41 && r.latitude <= 51.5 && r.longitude >= -5.5 && r.longitude <= 10) || (code !== undefined && code.length === 3);
      const center = code ? DEPARTMENT_CENTERS[code] : undefined;
      if (!inFrance || (center && haversineKm(center, [r.latitude, r.longitude]) > 150)) inconsistentCoordinates++;
    }
  }
  const rate = (n: number) => (activeTotal === 0 ? 100 : Math.round(((activeTotal - n) / activeTotal) * 1000) / 10);
  return {
    checkedAt: now.toISOString(),
    activeTotal,
    missingTitle,
    missingCompany,
    missingLocation,
    missingDescription,
    missingApplicationUrl,
    suspiciousDuplicates: { hiddenProbable, attachedEntries },
    expiredStillVisible,
    inconsistentDepartment,
    inconsistentCoordinates,
    stale,
    withoutCoordinates,
    completeness: {
      title: rate(missingTitle),
      company: rate(missingCompany),
      location: rate(missingLocation),
      description: rate(missingDescription),
      applicationUrl: rate(missingApplicationUrl),
      coordinates: rate(withoutCoordinates),
    },
  };
}

export function formatQualityReport(r: QualityReport): string {
  const pct = (n: number) => `${n} (${r.activeTotal ? Math.round((n / r.activeTotal) * 1000) / 10 : 0} %)`;
  return [
    `ACTIVE_TOTAL: ${r.activeTotal}`,
    `MISSING_TITLE: ${pct(r.missingTitle)}`,
    `MISSING_COMPANY (employeur non communiqué): ${pct(r.missingCompany)}`,
    `MISSING_LOCATION: ${pct(r.missingLocation)}`,
    `MISSING_DESCRIPTION: ${pct(r.missingDescription)}`,
    `MISSING_APPLICATION_URL: ${pct(r.missingApplicationUrl)}`,
    `WITHOUT_COORDINATES: ${pct(r.withoutCoordinates)}`,
    `SUSPICIOUS_DUPLICATES: ${r.suspiciousDuplicates.hiddenProbable} masquées (probables) · ${r.suspiciousDuplicates.attachedEntries} entrées rattachées à une offre canonique`,
    `EXPIRED_STILL_VISIBLE: ${r.expiredStillVisible}`,
    `INCONSISTENT_DEPARTMENT: ${pct(r.inconsistentDepartment)}`,
    `INCONSISTENT_COORDINATES: ${pct(r.inconsistentCoordinates)}`,
    `STALE (non confirmées depuis 14 j): ${pct(r.stale)}`,
    `COMPLETENESS: titre ${r.completeness.title} % · entreprise ${r.completeness.company} % · localisation ${r.completeness.location} % · description ${r.completeness.description} % · URL candidature ${r.completeness.applicationUrl} % · coordonnées ${r.completeness.coordinates} %`,
  ].join("\n");
}

export const _internal = { haversineKm, DEPARTMENT_CENTERS, Prisma };
