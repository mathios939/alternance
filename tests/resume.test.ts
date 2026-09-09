import { describe, expect, it } from "vitest";
import { analyzeResume } from "@/features/resume/lib/analyze";
import { compareResumeToJob } from "@/features/resume/lib/compare";
import { parseResumeText } from "@/features/resume/lib/parse";
import { extractSkills, normalizeSkillName } from "@/lib/skills";
import { computeProfileCompletion } from "@/features/profile/lib/completion";
import { computeStreak, weeklyProgress } from "@/features/dashboard/lib/streak";

const CV = `Léa Martin
Développeuse web en alternance
lea.martin@example.com · 06 12 34 56 78 · linkedin.com/in/lea-martin
44000 Nantes

Profil
Étudiante en BTS SIO option SLAM, je recherche une alternance de 24 mois à partir de septembre.

Expériences
Stage développeuse web — Agence Pixel, Nantes (mai–juin 2026)
- Développé un site vitrine avec React et Tailwind CSS pour 3 clients
- Automatisé les tests avec Playwright, réduisant les régressions de 40 %
Projet tutoré — Application de gestion de stock (2025)
- Conçu une API REST en Node.js et PostgreSQL

Formation
BTS SIO option SLAM — Lycée Livet, Nantes (2025–2027)
Baccalauréat général, spécialités NSI et mathématiques (2025)

Compétences
JavaScript, TypeScript, React, Node.js, SQL, Git, Docker, Méthodes agiles
Rigueur, autonomie, esprit d'équipe

Langues
Anglais B2 (TOEIC 820), Espagnol A2`;

describe("extraction de compétences", () => {
  it("reconnaît les alias et normalise", () => {
    expect(normalizeSkillName("reactjs").slug).toBe("react");
    expect(normalizeSkillName("Node").slug).toBe("node-js");
    expect(normalizeSkillName("Compétence inconnue").known).toBe(false);
  });

  it("extrait les compétences d'un texte sans faux positifs grossiers", () => {
    const skills = extractSkills("Vous maîtrisez React, node et le SQL. Le poste est basé à Rennes.").map((s) => s.slug);
    expect(skills).toEqual(expect.arrayContaining(["react", "node-js", "sql"]));
    expect(skills).not.toContain("c");
    expect(skills).not.toContain("go");
  });
});

describe("parseResumeText", () => {
  it("extrait les coordonnées, sections et compétences", () => {
    const parsed = parseResumeText(CV);
    expect(parsed.email).toBe("lea.martin@example.com");
    expect(parsed.phone).toMatch(/06 12 34 56 78/);
    expect(parsed.linkedinUrl).toContain("linkedin.com/in/lea-martin");
    expect(parsed.firstName).toBe("Léa");
    expect(parsed.lastName).toBe("Martin");
    expect(parsed.city).toBe("Nantes");
    expect(parsed.detectedLevel).toBe("BAC2");
    expect(parsed.skills.map((s) => s.slug)).toEqual(expect.arrayContaining(["react", "typescript", "node-js", "docker"]));
    expect(parsed.languages.map((s) => s.slug)).toEqual(expect.arrayContaining(["anglais", "espagnol"]));
    expect(parsed.experienceLines.length).toBeGreaterThan(2);
  });
});

describe("analyzeResume", () => {
  it("attribue un bon score à un CV structuré et chiffré", () => {
    const analysis = analyzeResume(CV, { targetJobFamilyKeywords: ["développeur", "web", "react", "javascript"] });
    expect(analysis.score).toBeGreaterThanOrEqual(75);
    expect(analysis.strengths.length).toBeGreaterThan(0);
    expect(analysis.criteria.find((c) => c.key === "structure")?.score).toBe(100);
    expect(analysis.method).toBe("rules");
  });

  it("pénalise un CV vide de contenu", () => {
    const analysis = analyzeResume("Jean Dupont\nRecherche alternance");
    expect(analysis.score).toBeLessThan(50);
    expect(analysis.weaknesses.some((w) => w.includes("court"))).toBe(true);
  });
});

describe("compareResumeToJob", () => {
  it("identifie les compétences manquantes sans les inventer", () => {
    const result = compareResumeToJob(
      { text: CV, skills: ["react", "typescript"], experiences: [{ title: "Stage développeuse web — Agence Pixel", description: "Développé un site avec React et Tailwind, tests Playwright" }] },
      { title: "Développeur React / Python", description: "Vous développerez des interfaces React et des scripts Python. Tests automatisés avec Playwright. Environnement agile.", skills: ["react", "python", "tests-logiciels"], missions: ["Interfaces React", "Scripts Python"], requirements: ["Python", "React"] },
    );
    expect(result.matchedSkills).toContain("react");
    expect(result.missingSkills).toContain("python");
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.experiencesToHighlight[0]?.title).toContain("Agence Pixel");
    expect(result.suggestions.join(" ")).toMatch(/ne les invente pas/);
  });
});

describe("complétion de profil et gamification", () => {
  it("calcule un score de complétion et les manques par impact", () => {
    const { score, missing } = computeProfileCompletion({
      firstName: "Léa", targetJobTitle: "Dev", educationLevel: "BAC2", educationTitle: null, school: null, city: "Nantes", latitude: 47.2,
      startDate: null, durationMonths: null, rhythm: null, skillsCount: 1, sectorsCount: 0, experiencesCount: 0, hasResume: false, bio: null, linkedinUrl: null,
    });
    expect(score).toBeGreaterThan(25);
    expect(score).toBeLessThan(60);
    expect(missing[0]?.key).toBe("skills");
  });

  it("calcule la série de jours actifs", () => {
    const now = new Date("2026-09-09T12:00:00Z");
    const d = (n: number) => new Date(now.getTime() - n * 86_400_000);
    expect(computeStreak([d(0), d(1), d(2), d(5)], now)).toMatchObject({ current: 3, activeToday: true });
    expect(computeStreak([d(1), d(2)], now)).toMatchObject({ current: 2, activeToday: false });
    expect(computeStreak([d(3)], now).current).toBe(0);
    expect(computeStreak([], now).longest).toBe(0);
  });

  it("formate la progression hebdomadaire", () => {
    expect(weeklyProgress(12, 20)).toMatchObject({ percent: 60, remaining: 8 });
    expect(weeklyProgress(25, 20).percent).toBe(100);
  });
});
