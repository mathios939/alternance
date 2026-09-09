import { parseResumeText, type ParsedResume } from "./parse";

export type ResumeAnalysis = {
  score: number;
  criteria: Array<{ key: string; label: string; score: number; weight: number; comment: string }>;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  detectedSkills: string[];
  wordCount: number;
  analyzedAt: string;
  method: "rules";
};

/**
 * Analyse d'un CV par règles (sans IA) :
 * lisibilité, structure, mots-clés, compétences, longueur, orthographe (signaux), ATS.
 * Chaque critère est expliqué ; le score est une aide, pas un verdict.
 */
export function analyzeResume(text: string, options?: { targetJobFamilyKeywords?: string[] }): ResumeAnalysis {
  const parsed: ParsedResume = parseResumeText(text);
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const improvements: string[] = [];
  const criteria: ResumeAnalysis["criteria"] = [];

  // 1. Longueur (idéal 250 – 700 mots pour un CV alternance = 1 page)
  const w = parsed.wordCount;
  let lengthScore: number;
  if (w >= 250 && w <= 700) {
    lengthScore = 100;
    strengths.push("Longueur adaptée à un CV d'une page.");
  } else if (w < 120) {
    lengthScore = 30;
    weaknesses.push("CV très court : il manque probablement des détails sur tes expériences ou projets.");
    improvements.push("Détaille chaque expérience avec 2 à 3 puces : contexte, actions, résultat.");
  } else if (w < 250) {
    lengthScore = 65;
    improvements.push("Ajoute quelques précisions (missions, outils, résultats) pour étoffer le CV.");
  } else if (w <= 1000) {
    lengthScore = 70;
    improvements.push("Le CV est dense : vise une page en supprimant les éléments les moins pertinents.");
  } else {
    lengthScore = 40;
    weaknesses.push("CV trop long pour un profil alternance (plus de 1 000 mots).");
    improvements.push("Réduis à une page : garde uniquement ce qui sert le poste visé.");
  }
  criteria.push({ key: "length", label: "Longueur", score: lengthScore, weight: 10, comment: `${w} mots` });

  // 2. Structure : sections attendues
  const expected = ["experience", "education", "skills"] as const;
  const present = expected.filter((s) => (parsed.sections[s] ?? "").length > 20);
  const structureScore = Math.round((present.length / expected.length) * 100);
  const missingSections = expected.filter((s) => !present.includes(s));
  if (structureScore === 100) strengths.push("Sections Expériences, Formation et Compétences clairement identifiées.");
  if (missingSections.length) {
    const labels = { experience: "Expériences", education: "Formation", skills: "Compétences" };
    weaknesses.push(`Section(s) difficile(s) à repérer : ${missingSections.map((s) => labels[s]).join(", ")}.`);
    improvements.push("Utilise des titres de section explicites (Expériences, Formation, Compétences, Langues).");
  }
  criteria.push({ key: "structure", label: "Structure", score: structureScore, weight: 20, comment: `${present.length}/3 sections clés` });

  // 3. Contact & ATS (email, téléphone, LinkedIn, pas de caractères exotiques)
  let atsScore = 40;
  if (parsed.email) atsScore += 25;
  else weaknesses.push("Aucune adresse email détectée.");
  if (parsed.phone) atsScore += 20;
  else improvements.push("Ajoute un numéro de téléphone lisible (format 06 12 34 56 78).");
  if (parsed.linkedinUrl) atsScore += 10;
  else improvements.push("Ajoute l'URL de ton profil LinkedIn.");
  const weirdChars = (text.match(/[■□●◆▪➢➤➔]/g) ?? []).length;
  if (weirdChars > 15) {
    atsScore -= 15;
    weaknesses.push("Beaucoup de symboles graphiques : certains logiciels de recrutement (ATS) les lisent mal.");
  } else if (weirdChars === 0) atsScore += 5;
  atsScore = Math.max(0, Math.min(100, atsScore));
  if (atsScore >= 90) strengths.push("Coordonnées complètes et lisibles par les ATS.");
  criteria.push({ key: "ats", label: "Compatibilité ATS", score: atsScore, weight: 15, comment: [parsed.email && "email", parsed.phone && "téléphone", parsed.linkedinUrl && "LinkedIn"].filter(Boolean).join(", ") || "coordonnées incomplètes" });

  // 4. Compétences détectées
  const hard = parsed.skills.filter((s) => s.category !== "SOFT");
  const soft = parsed.skills.filter((s) => s.category === "SOFT");
  let skillsScore = hard.length >= 8 ? 100 : hard.length >= 5 ? 85 : hard.length >= 3 ? 65 : hard.length >= 1 ? 40 : 15;
  if (soft.length === 0) improvements.push("Mentionne 2 ou 3 qualités concrètes (rigueur, autonomie…) illustrées par des exemples.");
  if (hard.length >= 5) strengths.push(`${hard.length} compétences techniques ou métier identifiées.`);
  else if (hard.length < 3) {
    weaknesses.push("Peu de compétences techniques ou outils explicitement nommés.");
    improvements.push("Liste les outils, langages et méthodes que tu maîtrises, avec leur niveau.");
  }
  criteria.push({ key: "skills", label: "Compétences", score: skillsScore, weight: 20, comment: `${hard.length} techniques · ${soft.length} qualités` });

  // 5. Mots-clés du métier visé
  let keywordScore = 60;
  if (options?.targetJobFamilyKeywords?.length) {
    const lower = text.toLowerCase();
    const hits = options.targetJobFamilyKeywords.filter((k) => lower.includes(k)).length;
    keywordScore = hits >= 4 ? 100 : hits >= 2 ? 75 : hits === 1 ? 50 : 20;
    if (hits >= 3) strengths.push("Le vocabulaire du métier visé est bien présent.");
    else improvements.push("Reprends les mots-clés des annonces que tu vises (intitulés, outils, missions).");
  }
  criteria.push({ key: "keywords", label: "Mots-clés métier", score: keywordScore, weight: 15, comment: options?.targetJobFamilyKeywords?.length ? "par rapport au métier visé" : "métier visé non renseigné" });

  // 6. Lisibilité : phrases/puces courtes, verbes d'action, chiffres
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const longLines = lines.filter((l) => l.length > 180).length;
  const numbers = (text.match(/\b\d+\s?(%|k€|€|clients|utilisateurs|projets|personnes)\b/gi) ?? []).length;
  const actionVerbs = (text.match(/\b(développ|conç|réalis|géré|gér|anim|cré|pilot|analys|optimis|particip|mis en place|organis|accompagn|automatis)\w*/gi) ?? []).length;
  let readability = 70;
  if (longLines > 5) {
    readability -= 20;
    improvements.push("Raccourcis les paragraphes : privilégie des puces d'une ou deux lignes.");
  }
  if (numbers >= 2) {
    readability += 15;
    strengths.push("Des résultats chiffrés : c'est ce qui retient l'attention.");
  } else improvements.push("Ajoute des chiffres (nombre d'utilisateurs, gain de temps, taille d'équipe…).");
  if (actionVerbs >= 4) readability += 15;
  else improvements.push("Commence tes puces par des verbes d'action : « Développé », « Organisé », « Analysé ».");
  readability = Math.max(0, Math.min(100, readability));
  criteria.push({ key: "readability", label: "Lisibilité", score: readability, weight: 12, comment: `${actionVerbs} verbes d'action · ${numbers} résultats chiffrés` });

  // 7. Orthographe (signaux faibles, sans correcteur) : doubles espaces, mots doublés, majuscules manquantes
  const doubledWords = (text.match(/\b(\w{3,})\s+\1\b/gi) ?? []).length;
  const doubleSpaces = (text.match(/ {2,}/g) ?? []).length;
  let spelling = 85;
  if (doubledWords > 0) {
    spelling -= 15 * Math.min(doubledWords, 3);
    weaknesses.push(`${doubledWords} mot(s) répété(s) consécutivement (ex. « le le »).`);
  }
  if (doubleSpaces > 10) spelling -= 10;
  spelling = Math.max(0, spelling);
  criteria.push({ key: "spelling", label: "Orthographe (signaux)", score: spelling, weight: 8, comment: "Vérification automatique partielle : relis-toi ou fais relire." });

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const score = Math.round(criteria.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight);

  return {
    score,
    criteria,
    strengths: Array.from(new Set(strengths)).slice(0, 6),
    weaknesses: Array.from(new Set(weaknesses)).slice(0, 6),
    improvements: Array.from(new Set(improvements)).slice(0, 7),
    detectedSkills: parsed.skills.map((s) => s.name),
    wordCount: w,
    analyzedAt: new Date().toISOString(),
    method: "rules",
  };
}
