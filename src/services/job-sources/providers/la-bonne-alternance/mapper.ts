import { z } from "zod";
import type { RemotePolicy } from "@/generated/prisma/enums";
import { departmentCodeFromPostal, findDepartmentByCode } from "@/config/departments";
import type { RawJob } from "../../types";
import { cleanCityLabel } from "../france-travail/mapper";

/**
 * Schéma tolérant d'une offre de l'API Alternance (schéma OpenAPI `JobOfferRead`, identique dans
 * l'export). Tous les champs sont optionnels : la validation métier se fait dans le pipeline.
 * Les champs inconnus sont conservés (loose) pour ne rien perdre dans `rawPayload`.
 */
const str = z.string().nullish();
const num = z.number().nullish();
const strList = z.array(z.string()).nullish();

export const lbaOfferSchema = z.looseObject({
  identifier: z.looseObject({ partner_job_id: str, id: str, partner_label: str }).nullish(),
  workplace: z
    .looseObject({
      name: str,
      description: str,
      website: str,
      siret: str,
      location: z
        .looseObject({
          address: str,
          geopoint: z
            .looseObject({ type: str, coordinates: z.array(z.number()).nullish() })
            .nullish(),
        })
        .nullish(),
      brand: str,
      legal_name: str,
      size: str,
      domain: z
        .looseObject({
          idcc: num,
          opco: str,
          naf: z.looseObject({ code: str, label: str }).nullish(),
        })
        .nullish(),
    })
    .nullish(),
  apply: z.looseObject({ phone: str, url: str, recipient_id: str }).nullish(),
  contract: z.looseObject({ start: str, duration: num, type: strList, remote: str }).nullish(),
  offer: z
    .looseObject({
      title: str,
      description: str,
      rome_codes: strList,
      target_diploma: z
        .looseObject({ european: z.union([z.string(), z.number()]).nullish(), label: str })
        .nullish(),
      desired_skills: strList,
      to_be_acquired_skills: strList,
      access_conditions: strList,
      opening_count: num,
      publication: z.looseObject({ creation: str, expiration: str }).nullish(),
      status: str,
    })
    .nullish(),
});

export type LbaOffer = z.infer<typeof lbaOfferSchema>;

/** Libellé de partenaire désignant France Travail (offres relayées, déjà ingérées à la source). */
export const FRANCE_TRAVAIL_PARTNER_LABEL = "France Travail";

export function isFranceTravailRelay(o: Pick<LbaOffer, "identifier">): boolean {
  return /france\s*travail|pole\s*emploi|pôle\s*emploi/i.test(o.identifier?.partner_label ?? "");
}

/** Offres explicitement pourvues ou annulées par la source (statut renseigné dans l'export). */
export function isInactiveStatus(o: Pick<LbaOffer, "offer">): boolean {
  const s = (o.offer?.status ?? "").toLowerCase();
  return (
    s === "filled" || s === "cancelled" || s === "canceled" || s === "pourvue" || s === "annulee"
  );
}

/** Identifiant stable : identifiant La bonne alternance, sinon « partenaire:identifiant partenaire ». */
export function lbaExternalId(o: Pick<LbaOffer, "identifier">): string {
  const id = o.identifier?.id?.trim();
  if (id) return id;
  const partner = o.identifier?.partner_label?.trim();
  const partnerId = o.identifier?.partner_job_id?.trim();
  return partner && partnerId ? `${partner}:${partnerId}` : (partnerId ?? "");
}

/** « 20 AVENUE DE SEGUR 75007 PARIS » → { postalCode: "75007", city: "Paris" }. Rien n'est deviné. */
export function parseAddress(address: string | null | undefined): {
  postalCode: string | null;
  city: string | null;
} {
  if (!address) return { postalCode: null, city: null };
  const cleaned = address
    .replace(/\s+/g, " ")
    .replace(/\bcedex\b.*$/i, "")
    .trim();
  // Dernier groupe de cinq chiffres suivi d'un libellé : « BP 12345 44000 NANTES » → 44000 / NANTES.
  const m = cleaned.match(/(?:^|.*\D)(\d{5})\s+(.+?)\s*$/);
  if (!m) return { postalCode: null, city: null };
  const rawCity = (m[2] ?? "")
    .replace(/[,;]/g, " ")
    // Arrondissement en fin de libellé (« PARIS 07 ») : retiré pour retrouver la commune.
    .replace(/\s*\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return { postalCode: m[1] ?? null, city: rawCity ? cleanCityLabel(rawCity) : null };
}

/** Code département d'une offre (à partir du code postal de l'adresse du lieu de travail). */
export function lbaDepartmentCode(o: Pick<LbaOffer, "workplace">): string | null {
  return departmentCodeFromPostal(parseAddress(o.workplace?.location?.address).postalCode);
}

export function parseRemote(value: string | null | undefined): RemotePolicy | null {
  switch ((value ?? "").toLowerCase()) {
    case "onsite":
      return "NONE";
    case "remote":
      return "FULL";
    case "hybrid":
      return "HYBRID";
    default:
      return null;
  }
}

export function parseContractType(types: string[] | null | undefined): RawJob["contractType"] {
  const list = (types ?? []).map((t) => t.toLowerCase());
  if (list.some((t) => t.includes("apprentissage"))) return "APPRENTISSAGE";
  if (list.some((t) => t.includes("professionnalisation"))) return "PROFESSIONNALISATION";
  return null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Transforme une offre validée en RawJob. Rien n'est deviné : ce qui manque reste null. */
export function mapLbaOffer(o: LbaOffer): RawJob {
  const workplace = o.workplace ?? null;
  const offer = o.offer ?? null;
  const contract = o.contract ?? null;
  const { postalCode, city } = parseAddress(workplace?.location?.address);
  const depCode = departmentCodeFromPostal(postalCode);
  const dep = findDepartmentByCode(depCode);
  const coords = workplace?.location?.geopoint?.coordinates ?? null;
  const longitude = coords && typeof coords[0] === "number" ? coords[0] : null;
  const latitude = coords && typeof coords[1] === "number" ? coords[1] : null;
  const applyUrl = o.apply?.url?.trim() || null;
  const contractType = parseContractType(contract?.type);
  const diploma = offer?.target_diploma?.label?.trim();
  const requirements = [
    ...(offer?.access_conditions ?? []).map((s) => s.trim()).filter(Boolean),
    ...(diploma ? [`Diplôme visé : ${diploma}`] : []),
  ];
  const publishedAt = parseDate(offer?.publication?.creation);

  return {
    externalId: lbaExternalId(o),
    title: (offer?.title ?? "").trim(),
    companyName:
      workplace?.name?.trim() || workplace?.brand?.trim() || workplace?.legal_name?.trim() || null,
    companyWebsite: workplace?.website?.trim() || null,
    companyDescription: workplace?.description?.trim() || null,
    description: (offer?.description ?? "").trim(),
    missions: (offer?.to_be_acquired_skills ?? []).map((s) => s.trim()).filter(Boolean),
    requirements,
    skills: (offer?.desired_skills ?? []).map((s) => s.trim()).filter(Boolean),
    city,
    postalCode,
    inseeCode: null,
    department: dep?.name ?? null,
    region: dep?.region ?? null,
    latitude,
    longitude,
    contractType,
    // L'API ne publie que des opportunités en alternance (apprentissage / professionnalisation).
    isAlternance: true,
    educationLevelMin: null,
    educationLevelMax: null,
    durationMonths:
      typeof contract?.duration === "number" && contract.duration > 0 ? contract.duration : null,
    remote: parseRemote(contract?.remote),
    startDate: parseDate(contract?.start),
    publishedAt: publishedAt ?? new Date(NaN),
    updatedAt: null,
    expiresAt: parseDate(offer?.publication?.expiration),
    sourceUrl: applyUrl,
    applicationUrl: applyUrl,
    applicationEmail: null,
    applicationLabel: null,
    romeCode: offer?.rome_codes?.[0]?.trim() || null,
    nafCode: workplace?.domain?.naf?.code?.trim() || null,
    positionsCount:
      typeof offer?.opening_count === "number" && offer.opening_count > 0
        ? offer.opening_count
        : null,
    raw: o,
  };
}
