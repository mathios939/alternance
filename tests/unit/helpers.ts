import type { CandidateForMatching, JobForMatching, CompanyForMatching } from "@/lib/matching";

export const nantes = { lat: 47.2184, lng: -1.5536 };
export const rennes = { lat: 48.1173, lng: -1.6778 };
export const saintHerblain = { lat: 47.2122, lng: -1.6497 };

export function makeCandidate(overrides: Partial<CandidateForMatching> = {}): CandidateForMatching {
  return {
    educationLevel: "BAC2",
    jobFamily: "dev",
    targetJobTitle: "Développeur web",
    skills: ["react", "typescript", "node-js", "sql"],
    latitude: nantes.lat,
    longitude: nantes.lng,
    city: "Nantes",
    department: "Loire-Atlantique",
    region: "Pays de la Loire",
    maxRadiusKm: 30,
    mobility: "DEPARTMENT",
    hasDrivingLicense: true,
    hasVehicle: false,
    remotePreference: "HYBRID",
    rhythm: "TWO_THREE",
    durationMonths: 24,
    startDate: new Date("2026-09-01"),
    contractTypes: ["APPRENTISSAGE"],
    sectors: ["tech"],
    experienceMonths: 2,
    experienceKeywords: ["developpeur", "web"],
    ...overrides,
  };
}

export function makeJob(overrides: Partial<JobForMatching> = {}): JobForMatching {
  return {
    id: "job-1",
    title: "Développeur Full Stack — Alternance",
    jobFamily: "dev",
    sector: "tech",
    skills: ["react", "typescript", "node-js", "python", "sql"],
    requiredSkills: ["react", "typescript"],
    educationLevelMin: "BAC2",
    educationLevelMax: "BAC5",
    latitude: saintHerblain.lat,
    longitude: saintHerblain.lng,
    city: "Saint-Herblain",
    department: "Loire-Atlantique",
    region: "Pays de la Loire",
    remote: "HYBRID",
    rhythm: "TWO_THREE",
    durationMonths: 24,
    startDate: new Date("2026-09-01"),
    contractType: "APPRENTISSAGE",
    publishedAt: new Date(Date.now() - 6 * 3_600_000),
    ...overrides,
  };
}

export function makeCompany(overrides: Partial<CompanyForMatching> = {}): CompanyForMatching {
  return {
    id: "company-1",
    sector: "tech",
    size: "PME",
    jobFamilies: ["dev", "data"],
    technologies: ["react", "node-js"],
    latitude: saintHerblain.lat,
    longitude: saintHerblain.lng,
    city: "Saint-Herblain",
    department: "Loire-Atlantique",
    region: "Pays de la Loire",
    hiresApprentices: true,
    apprenticeCountEstimate: 6,
    isHiring: false,
    activeJobsCount: 0,
    lastActivityAt: new Date(),
    ...overrides,
  };
}
