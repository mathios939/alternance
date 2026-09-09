import { findCity, findRegion } from "@/config/cities";
import { EducationLevel, RemotePolicy, ContractType } from "@/generated/prisma/enums";
import { normalizeText } from "@/lib/text/normalize";
import type { JobFilters } from "./filters";

export type ParsedQuery = Partial<Pick<JobFilters, "q" | "city" | "region" | "radius" | "levels" | "remote" | "contracts" | "durations" | "published">> & {
  interpretation: string[];
};

const LEVEL_PATTERNS: Array<[RegExp, EducationLevel]> = [
  [/bac ?\+ ?5|master|ingenieur|m2\b/, "BAC5"],
  [/bac ?\+ ?4|m1\b/, "BAC4"],
  [/bac ?\+ ?3|licence|bachelor|\bbut\b/, "BAC3"],
  [/bac ?\+ ?2|\bbts\b|\bdut\b/, "BAC2"],
  [/bac ?\+ ?1/, "BAC1"],
  [/\bbac\b(?! ?\+)/, "BAC"],
  [/\bcap\b/, "CAP"],
];

/**
 * Transforme une requête en langage naturel en filtres.
 * Ex : « Alternance cybersécurité à Rennes Bac+3 dans un rayon de 30 km »
 */
export function parseNaturalQuery(input: string): ParsedQuery {
  const interpretation: string[] = [];
  let text = normalizeText(input);
  const result: ParsedQuery = { interpretation };

  // Rayon
  const radius = text.match(/(?:rayon|autour|moins) (?:de |d )?(\d{1,3}) ?km|(\d{1,3}) ?km/);
  if (radius) {
    const km = Number(radius[1] ?? radius[2]);
    const allowed = [5, 10, 20, 30, 50, 100];
    result.radius = allowed.reduce((prev, cur) => (Math.abs(cur - km) < Math.abs(prev - km) ? cur : prev), allowed[0]!);
    interpretation.push(`rayon de ${result.radius} km`);
    text = text.replace(radius[0], " ");
    text = text.replace(/dans un rayon (de|d)\b/g, " ");
  }

  // Niveau
  for (const [re, level] of LEVEL_PATTERNS) {
    const m = text.match(re);
    if (m) {
      result.levels = [level];
      interpretation.push(`niveau ${level.replace("BAC", "Bac+").replace("Bac+", level === "BAC" ? "Bac" : "Bac+")}`.replace("Bac+CAP", "CAP"));
      text = text.replace(m[0], " ");
      break;
    }
  }

  // Télétravail
  if (/full remote|100 ?% teletravail|teletravail complet/.test(text)) {
    result.remote = [RemotePolicy.FULL];
    interpretation.push("télétravail complet");
    text = text.replace(/full remote|100 ?% teletravail|teletravail complet/, " ");
  } else if (/teletravail|hybride|remote/.test(text)) {
    result.remote = [RemotePolicy.HYBRID, RemotePolicy.FULL];
    interpretation.push("télétravail possible");
    text = text.replace(/teletravail|hybride|remote/, " ");
  }

  // Contrat
  if (/professionnalisation|contrat pro\b/.test(text)) {
    result.contracts = [ContractType.PROFESSIONNALISATION];
    interpretation.push("contrat de professionnalisation");
    text = text.replace(/professionnalisation|contrat pro\b/, " ");
  }

  // Durée
  const duration = text.match(/(\d{1,2}) mois/);
  if (duration && [6, 12, 24, 36].includes(Number(duration[1]))) {
    result.durations = [Number(duration[1])];
    interpretation.push(`${duration[1]} mois`);
    text = text.replace(duration[0], " ");
  }

  // Fraîcheur
  if (/aujourd ?hui|24 ?h|derniere(s)? 24/.test(text)) {
    result.published = "24h";
    interpretation.push("publiées depuis 24 h");
    text = text.replace(/aujourd ?hui|24 ?h|derniere(s)? 24/, " ");
  } else if (/cette semaine|7 jours/.test(text)) {
    result.published = "7d";
    interpretation.push("publiées cette semaine");
    text = text.replace(/cette semaine|7 jours/, " ");
  }

  // Ville / région : « à Rennes », « sur Nantes », ou nom de ville présent
  const locMatch = text.match(/\b(?:a|à|sur|vers|pres de|près de|autour de)\s+([a-z][a-z' -]{2,30})$/) ?? text.match(/\b(?:a|à|sur|vers|pres de|près de|autour de)\s+([a-z][a-z' -]{2,30}?)(?=\s+(?:bac|niveau|en|dans|avec|pour)|$)/);
  let cityFound = locMatch ? findCity(locMatch[1]) : undefined;
  if (!cityFound) {
    for (const token of text.split(/\s+/)) {
      const c = token.length >= 4 ? findCity(token) : undefined;
      if (c && normalizeText(c.name) === token) {
        cityFound = c;
        break;
      }
    }
    // Villes composées (Saint-Nazaire, Le Mans…)
    if (!cityFound) {
      const multi = text.match(/\b(saint[ -][a-z]+|le mans|la roche[ -]sur[ -]yon|cesson[ -]sevigne)\b/);
      if (multi) cityFound = findCity(multi[1]);
    }
  }
  if (cityFound) {
    result.city = cityFound.name;
    interpretation.push(`à ${cityFound.name}`);
    text = text.replace(new RegExp(`\\b(?:a|sur|vers|pres de|autour de)?\\s*${normalizeText(cityFound.name).replace(/[ -]/g, "[ -]")}\\b`), " ");
  } else {
    const region = findRegion(locMatch?.[1] ?? "") ?? ["bretagne", "pays de la loire", "ile de france", "normandie", "occitanie"].map(findRegion).find((r) => r && text.includes(normalizeText(r)));
    if (region) {
      result.region = region;
      interpretation.push(`en ${region}`);
      text = text.replace(normalizeText(region), " ");
    }
  }

  // Ce qui reste = mots-clés métier
  const q = text
    .replace(/\b(alternance|alternant|apprentissage|contrat|offre|offres|recherche|cherche|je|un|une|de|d|en|a|à|dans|pour|le|la|les|des|du|et)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (q) {
    result.q = q;
    interpretation.unshift(`« ${q} »`);
  }
  return result;
}
