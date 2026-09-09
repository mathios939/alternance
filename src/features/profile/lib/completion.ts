export type ProfileForCompletion = {
  firstName: string | null;
  targetJobTitle: string | null;
  educationLevel: string | null;
  educationTitle: string | null;
  school: string | null;
  city: string | null;
  latitude: number | null;
  startDate: Date | null;
  durationMonths: number | null;
  rhythm: string | null;
  skillsCount: number;
  sectorsCount: number;
  experiencesCount: number;
  hasResume: boolean;
  bio: string | null;
  linkedinUrl: string | null;
};

export type CompletionItem = { key: string; label: string; weight: number; done: boolean; href: string };

/** Score de complétion du profil (0-100) avec la liste des manques, triés par impact. */
export function computeProfileCompletion(p: ProfileForCompletion): { score: number; items: CompletionItem[]; missing: CompletionItem[] } {
  const items: CompletionItem[] = [
    { key: "firstName", label: "Prénom", weight: 5, done: Boolean(p.firstName), href: "/settings/profile" },
    { key: "targetJobTitle", label: "Métier recherché", weight: 12, done: Boolean(p.targetJobTitle), href: "/settings/profile" },
    { key: "educationLevel", label: "Niveau d'études", weight: 12, done: Boolean(p.educationLevel), href: "/settings/profile" },
    { key: "educationTitle", label: "Formation", weight: 6, done: Boolean(p.educationTitle), href: "/settings/profile" },
    { key: "school", label: "École", weight: 4, done: Boolean(p.school), href: "/settings/profile" },
    { key: "city", label: "Ville", weight: 12, done: Boolean(p.city && p.latitude !== null), href: "/settings/profile" },
    { key: "startDate", label: "Date de début", weight: 5, done: Boolean(p.startDate), href: "/settings/profile" },
    { key: "durationMonths", label: "Durée souhaitée", weight: 3, done: Boolean(p.durationMonths), href: "/settings/profile" },
    { key: "rhythm", label: "Rythme école / entreprise", weight: 5, done: Boolean(p.rhythm), href: "/settings/profile" },
    { key: "skills", label: "Au moins 3 compétences", weight: 14, done: p.skillsCount >= 3, href: "/settings/profile" },
    { key: "sectors", label: "Secteurs recherchés", weight: 4, done: p.sectorsCount > 0, href: "/settings/profile" },
    { key: "experiences", label: "Une expérience ou un projet", weight: 6, done: p.experiencesCount > 0, href: "/resume" },
    { key: "resume", label: "CV importé", weight: 8, done: p.hasResume, href: "/resume" },
    { key: "bio", label: "Présentation courte", weight: 2, done: Boolean(p.bio), href: "/settings/profile" },
    { key: "linkedin", label: "Profil LinkedIn", weight: 2, done: Boolean(p.linkedinUrl), href: "/settings/profile" },
  ];
  const total = items.reduce((s, i) => s + i.weight, 0);
  const done = items.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);
  const missing = items.filter((i) => !i.done).sort((a, b) => b.weight - a.weight);
  return { score: Math.round((done / total) * 100), items, missing };
}
