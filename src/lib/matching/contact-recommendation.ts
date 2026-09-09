import { JOB_FAMILIES, type JobFamilyKey } from "@/config/taxonomy";
import { normalizeText } from "@/lib/text/normalize";
import type { CompanySize } from "@/generated/prisma/enums";

export type ContactForRecommendation = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string | null;
  confidenceScore: number;
  verifiedAt: Date | null;
  optOutAt: Date | null;
  isDemo: boolean;
};

export type ContactRecommendation = {
  contact: ContactForRecommendation;
  score: number;
  reason: string;
};

const HR_KEYWORDS = ["talent", "recrut", "rh", "ressources humaines", "hr", "people", "acquisition", "campus", "alternance", "relations ecoles", "relations écoles"];
const MANAGER_KEYWORDS = ["manager", "responsable", "lead", "head", "chef", "directeur technique", "cto", "directrice technique", "tech lead"];
const EXEC_KEYWORDS = ["ceo", "fondateur", "fondatrice", "co-fondateur", "cofondateur", "gérant", "gerant", "dirigeant", "président", "president", "directeur général", "directrice générale", "dg"];

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(normalizeText(k)));
}

/**
 * Recommande le meilleur interlocuteur selon la taille de l'entreprise :
 *   Grande entreprise / ETI → Talent Acquisition / RH
 *   PME → RH ou manager métier
 *   TPE → dirigeant ou responsable d'équipe
 * Ne retourne jamais un contact inventé : uniquement ceux fournis.
 */
export function recommendBestContact(
  company: { size: CompanySize; name: string; city: string },
  candidate: { jobFamily: string | null },
  contacts: ContactForRecommendation[],
): ContactRecommendation | null {
  const eligible = contacts.filter((c) => !c.optOutAt);
  if (eligible.length === 0) return null;

  const familyLabel = candidate.jobFamily ? JOB_FAMILIES[candidate.jobFamily as JobFamilyKey]?.label.toLowerCase() : null;
  const familyKeywords = candidate.jobFamily ? (JOB_FAMILIES[candidate.jobFamily as JobFamilyKey]?.keywords ?? []) : [];

  const scored = eligible.map((contact) => {
    const title = normalizeText(`${contact.jobTitle} ${contact.department ?? ""}`);
    const isHr = includesAny(title, HR_KEYWORDS);
    const isManager = includesAny(title, MANAGER_KEYWORDS);
    const isExec = includesAny(title, EXEC_KEYWORDS);
    const isFamilyRelated = includesAny(title, familyKeywords);

    let score = 20;
    let reason = `${contact.firstName} travaille chez ${company.name}.`;

    if (company.size === "GE" || company.size === "ETI") {
      if (isHr) {
        score = 90;
        reason = `${contact.firstName} recrute pour ${company.name} : c'est le bon point d'entrée dans une grande structure.`;
      } else if (isManager && isFamilyRelated) {
        score = 70;
        reason = `${contact.firstName} manage une équipe ${familyLabel ?? "métier"} : un contact direct peut accélérer ta candidature.`;
      } else if (isExec) {
        score = 30;
      }
    } else if (company.size === "PME") {
      if (isManager && isFamilyRelated) {
        score = 92;
        reason = `Dans une PME, le manager ${familyLabel ?? "métier"} décide souvent lui-même des alternants.`;
      } else if (isHr) {
        score = 85;
        reason = `${contact.firstName} gère les recrutements de ${company.name}.`;
      } else if (isExec) {
        score = 65;
        reason = `Dans une PME, la direction est souvent impliquée dans les recrutements d'alternants.`;
      } else if (isManager) {
        score = 55;
      }
    } else {
      // TPE
      if (isExec) {
        score = 95;
        reason = `Dans une TPE, c'est généralement ${contact.firstName} qui décide directement.`;
      } else if (isManager) {
        score = 80;
        reason = `${contact.firstName} est responsable d'équipe : le bon interlocuteur dans une petite structure.`;
      } else if (isHr) {
        score = 70;
      }
    }

    if (isFamilyRelated && !isHr) score += 5;
    if (contact.verifiedAt) score += 5;
    score = Math.round(score * (0.6 + 0.4 * (contact.confidenceScore / 100)));

    if (isFamilyRelated && isHr && familyLabel) {
      reason = `${contact.firstName} recrute des profils ${familyLabel} sur ${company.city}.`;
    }
    return { contact, score, reason };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0] ?? null;
}
