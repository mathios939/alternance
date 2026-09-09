import { describe, expect, it } from "vitest";
import { buildDailyMission, getNextBestAction, type UserStateForActions } from "@/lib/matching";

function state(overrides: Partial<UserStateForActions> = {}): UserStateForActions {
  return {
    profileCompletion: 85,
    hasResume: true,
    resumeScore: 80,
    upcomingInterviews: [],
    followUpsDue: [],
    highMatchJobs: [
      { jobId: "j1", title: "Dev web", companyName: "Sopra", matchScore: 92, city: "Nantes", slug: "dev-web" },
      { jobId: "j2", title: "Dev data", companyName: "Capgemini", matchScore: 88, city: "Nantes", slug: "dev-data" },
    ],
    radarCompanies: [{ companyId: "c1", name: "Lengow", opportunityScore: 80, slug: "lengow", city: "Nantes" }],
    applicationsThisWeek: 3,
    weeklyGoal: 20,
    savedJobsNotApplied: [],
    urgencyMode: false,
    now: new Date("2026-09-09T09:00:00Z"),
    ...overrides,
  };
}

describe("getNextBestAction", () => {
  it("priorise un entretien imminent", () => {
    const action = getNextBestAction(state({ upcomingInterviews: [{ id: "i1", companyName: "Orange", scheduledAt: new Date("2026-09-10T10:00:00Z"), applicationId: "a1" }] }));
    expect(action?.type).toBe("PREPARE_INTERVIEW");
    expect(action?.href).toBe("/interviews/i1");
  });

  it("demande de compléter le profil s'il est trop vide", () => {
    const action = getNextBestAction(state({ profileCompletion: 30 }));
    expect(action?.type).toBe("COMPLETE_PROFILE");
  });

  it("demande le CV avant de candidater", () => {
    const action = getNextBestAction(state({ hasResume: false }));
    expect(action?.type).toBe("UPDATE_RESUME");
  });

  it("préfère la relance à une nouvelle candidature", () => {
    const action = getNextBestAction(state({ followUpsDue: [{ applicationId: "a1", companyName: "Capgemini", daysSinceApplied: 9 }] }));
    expect(action?.type).toBe("FOLLOW_UP");
    expect(action?.title).toContain("Capgemini");
  });

  it("propose la meilleure offre quand tout est en ordre", () => {
    const action = getNextBestAction(state());
    expect(action?.type).toBe("APPLY_JOB");
    expect(action?.jobId).toBe("j1");
  });

  it("retourne null sans aucune opportunité", () => {
    const action = getNextBestAction(state({ highMatchJobs: [], radarCompanies: [], applicationsThisWeek: 15 }));
    expect(action).toBeNull();
  });
});

describe("buildDailyMission", () => {
  it("construit une mission variée de 5 actions maximum", () => {
    const mission = buildDailyMission(
      state({
        followUpsDue: [
          { applicationId: "a1", companyName: "Capgemini", daysSinceApplied: 9 },
          { applicationId: "a2", companyName: "Sopra", daysSinceApplied: 12 },
          { applicationId: "a3", companyName: "Atos", daysSinceApplied: 15 },
        ],
      }),
    );
    expect(mission.length).toBeLessThanOrEqual(5);
    const followUps = mission.filter((a) => a.type === "FOLLOW_UP");
    expect(followUps.length).toBe(2);
    expect(mission.some((a) => a.type === "APPLY_JOB")).toBe(true);
    expect(mission.some((a) => a.type === "CONTACT_COMPANY")).toBe(true);
  });

  it("augmente le volume en mode urgence", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ jobId: `j${i}`, title: `Job ${i}`, companyName: `C${i}`, matchScore: 90 - i, city: "Nantes", slug: `job-${i}` }));
    const normal = buildDailyMission(state({ highMatchJobs: many, radarCompanies: [] }));
    const urgent = buildDailyMission(state({ highMatchJobs: many, radarCompanies: [], urgencyMode: true }));
    expect(urgent.filter((a) => a.type === "APPLY_JOB").length).toBeGreaterThan(normal.filter((a) => a.type === "APPLY_JOB").length);
  });
});
