import { extractSkills, skillDisplayName } from "@/lib/skills";
import { tokenize } from "@/lib/text/normalize";

export type ResumeJobComparison = {
  coverage: number; // % des compétences de l'offre présentes dans le CV
  matchedSkills: string[];
  missingSkills: string[];
  /** Mots-clés de l'annonce absents du CV (hors compétences). */
  missingKeywords: string[];
  /** Expériences du CV à mettre en avant (chevauchement lexical avec l'offre). */
  experiencesToHighlight: Array<{ title: string; overlap: string[] }>;
  /** Compétences du CV sans lien avec l'offre (à condenser, pas à supprimer). */
  lowRelevanceSkills: string[];
  suggestions: string[];
};

/**
 * Compare un CV et une offre. Ne suggère JAMAIS d'ajouter une compétence
 * que le candidat ne possède pas : seulement de mieux mettre en avant ce qu'il a.
 */
export function compareResumeToJob(
  resume: { text: string; skills: string[]; experiences: Array<{ title: string; description: string | null }> },
  job: { title: string; description: string; skills: string[]; missions: string[]; requirements: string[] },
): ResumeJobComparison {
  const resumeSkillSlugs = new Set([...resume.skills, ...extractSkills(resume.text, { includeSoft: true }).map((s) => s.slug)]);
  const jobSkillSlugs = Array.from(new Set(job.skills));
  const matchedSkills = jobSkillSlugs.filter((s) => resumeSkillSlugs.has(s));
  const missingSkills = jobSkillSlugs.filter((s) => !resumeSkillSlugs.has(s));
  const coverage = jobSkillSlugs.length === 0 ? 100 : Math.round((matchedSkills.length / jobSkillSlugs.length) * 100);

  const jobText = [job.title, job.description, ...job.missions, ...job.requirements].join(" ");
  const jobTokens = tokenize(jobText);
  const freq = new Map<string, number>();
  for (const t of jobTokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const resumeTokens = new Set(tokenize(resume.text));
  const missingKeywords = [...freq.entries()]
    .filter(([t, n]) => n >= 2 && t.length >= 4 && !resumeTokens.has(t) && !/^\d+$/.test(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);

  const jobTokenSet = new Set(jobTokens.filter((t) => t.length >= 4));
  const experiencesToHighlight = resume.experiences
    .map((e) => {
      const tokens = new Set(tokenize(`${e.title} ${e.description ?? ""}`));
      const overlap = [...tokens].filter((t) => jobTokenSet.has(t)).slice(0, 6);
      return { title: e.title, overlap };
    })
    .filter((e) => e.overlap.length >= 2)
    .sort((a, b) => b.overlap.length - a.overlap.length)
    .slice(0, 3);

  const lowRelevanceSkills = [...resumeSkillSlugs].filter((s) => !jobSkillSlugs.includes(s) && !jobTokenSet.has(s)).slice(0, 6);

  const suggestions: string[] = [];
  if (matchedSkills.length) suggestions.push(`Place ${matchedSkills.slice(0, 3).map(skillDisplayName).join(", ")} en tête de ta section Compétences.`);
  if (experiencesToHighlight.length) suggestions.push(`Développe l'expérience « ${experiencesToHighlight[0]!.title} » : elle parle le langage de l'offre.`);
  if (missingKeywords.length) suggestions.push(`Si c'est vrai pour toi, reprends les termes de l'annonce : ${missingKeywords.slice(0, 4).join(", ")}.`);
  if (missingSkills.length) suggestions.push(`${missingSkills.slice(0, 3).map(skillDisplayName).join(", ")} manquent : ne les invente pas, mais mentionne une formation ou un projet en cours si c'est le cas.`);
  if (lowRelevanceSkills.length > 3) suggestions.push("Condense les compétences sans lien avec le poste pour gagner de la place.");
  if (suggestions.length === 0) suggestions.push("Ton CV couvre bien l'offre : soigne l'accroche et la lettre.");

  return { coverage, matchedSkills, missingSkills, missingKeywords, experiencesToHighlight, lowRelevanceSkills, suggestions };
}
