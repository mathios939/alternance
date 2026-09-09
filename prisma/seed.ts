/**
 * Seed de démonstration — Alternance OS
 * Toutes les données créées ici sont fictives et marquées isDemo = true.
 * Usage : npm run db:seed (ou automatiquement après `prisma migrate reset`).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import type { ApplicationStatus, DailyActionType } from "../src/generated/prisma/enums";
import { CITIES, findCity } from "../src/config/cities";
import { SKILL_CATALOG } from "../src/config/skills";
import { analyzeResume } from "../src/features/resume/lib/analyze";
import { parseResumeText } from "../src/features/resume/lib/parse";
import { JOB_FAMILIES } from "../src/config/taxonomy";
import { skillSlugs } from "../src/lib/skills";
import { normalizeCompanyName } from "../src/lib/text/normalize";
import { slugify } from "../src/lib/utils";
import { normalizeJobTitle } from "../src/services/job-sources/normalize";
import { SEED_COMPANIES } from "./seed-data/companies";
import { ADMIN_USER, DEMO_RESUME_TEXT, DEMO_USER } from "./seed-data/demo-user";
import { pickBenefits, templatesFor } from "./seed-data/job-templates";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) throw new Error("DATABASE_URL manquante");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// PRNG déterministe (mulberry32) pour un seed reproductible
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260909);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const daysAgo = (d: number) => hoursAgo(d * 24);
const daysFromNow = (d: number) => hoursAgo(-d * 24);

/** Léger décalage de coordonnées pour éviter que tout s'empile sur un point. */
function jitter(value: number, amount = 0.02): number {
  return value + (rand() - 0.5) * amount;
}

async function reset() {
  console.log("→ Nettoyage des données de démonstration…");
  await prisma.$transaction([
    prisma.report.deleteMany(),
    prisma.dailyAction.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.recommendation.deleteMany(),
    prisma.aIMessage.deleteMany(),
    prisma.aIConversation.deleteMany(),
    prisma.interview.deleteMany(),
    prisma.outreach.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.savedSearch.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.applicationEvent.deleteMany(),
    prisma.generatedDocument.deleteMany(),
    prisma.application.deleteMany(),
    prisma.resumeVersion.deleteMany(),
    prisma.resume.deleteMany(),
    prisma.jobSourceEntry.deleteMany(),
    prisma.jobSkill.deleteMany(),
    prisma.job.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.companyLocation.deleteMany(),
    prisma.company.deleteMany(),
    prisma.jobSource.deleteMany(),
    prisma.userSkill.deleteMany(),
    prisma.skill.deleteMany(),
    prisma.candidateProfile.deleteMany(),
    prisma.alertPreference.deleteMany(),
    prisma.account.deleteMany(),
    prisma.session.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function seedSkills() {
  console.log("→ Compétences…");
  await prisma.skill.createMany({
    data: SKILL_CATALOG.map((s) => ({ name: s.name, slug: slugify(s.name), category: s.category, aliases: s.aliases ?? [] })),
    skipDuplicates: true,
  });
  const skills = await prisma.skill.findMany({ select: { id: true, slug: true } });
  return new Map(skills.map((s) => [s.slug, s.id]));
}

async function seedSources() {
  console.log("→ Sources d'offres…");
  const manual = await prisma.jobSource.create({
    data: { key: "manual", name: "Données de démonstration", type: "MANUAL", isEnabled: true, lastSyncStatus: "SUCCESS", lastSyncAt: new Date() },
  });
  await prisma.jobSource.createMany({
    data: [
      { key: "france-travail", name: "France Travail (API officielle)", type: "FRANCE_TRAVAIL", baseUrl: "https://api.francetravail.io", isEnabled: false, lastSyncStatus: "DISABLED", lastSyncError: "Identifiants API non configurés" },
      { key: "company-career", name: "Sites carrières partenaires", type: "COMPANY_CAREER", isEnabled: false, lastSyncStatus: "DISABLED", lastSyncError: "Aucun flux partenaire configuré" },
    ],
  });
  return manual;
}

async function seedCompanies() {
  console.log("→ Entreprises, implantations et contacts…");
  const ids = new Map<string, string>();
  for (const c of SEED_COMPANIES) {
    const city = findCity(c.city);
    if (!city) throw new Error(`Ville inconnue : ${c.city}`);
    const company = await prisma.company.create({
      data: {
        name: c.name,
        nameNormalized: normalizeCompanyName(c.name),
        slug: c.slug,
        description: c.description,
        sector: c.sector,
        size: c.size,
        headcount: c.headcount,
        website: c.website,
        careersUrl: `${c.website}/carrieres`,
        foundedYear: c.foundedYear,
        city: city.name,
        postalCode: city.postalCode,
        department: city.department,
        region: city.region,
        latitude: jitter(city.lat),
        longitude: jitter(city.lng),
        technologies: c.technologies,
        jobFamilies: c.jobFamilies,
        hiresApprentices: c.hiresApprentices,
        apprenticeCountEstimate: c.apprenticeCountEstimate,
        isHiring: c.isHiring,
        lastActivityAt: daysAgo(between(1, 60)),
        dataOrigin: "DEMO",
        sizeOrigin: "DEMO",
        isDemo: true,
        dataSources: [{ source: "seed", url: null, fetchedAt: new Date().toISOString(), label: "Données de démonstration" }],
        locations: {
          create: [
            { label: "Siège", city: city.name, postalCode: city.postalCode, department: city.department, region: city.region, latitude: jitter(city.lat), longitude: jitter(city.lng), isHeadquarters: true },
            ...(c.otherLocations ?? []).map((name) => {
              const loc = findCity(name);
              if (!loc) throw new Error(`Ville inconnue : ${name}`);
              return { label: `Site de ${loc.name}`, city: loc.name, postalCode: loc.postalCode, department: loc.department, region: loc.region, latitude: jitter(loc.lat), longitude: jitter(loc.lng), isHeadquarters: false };
            }),
          ],
        },
        contacts: {
          create: c.contacts.map((ct) => ({
            firstName: ct.firstName,
            lastName: ct.lastName,
            jobTitle: ct.jobTitle,
            department: ct.department ?? null,
            linkedinUrl: null,
            email: null,
            source: "DEMO",
            sourceUrl: null,
            confidenceScore: between(55, 85),
            dataOrigin: "DEMO",
            isDemo: true,
            notes: "Contact fictif de démonstration : aucune coordonnée réelle.",
          })),
        },
      },
    });
    ids.set(c.slug, company.id);
  }
  return ids;
}

async function seedJobs(companyIds: Map<string, string>, skillIds: Map<string, string>, sourceId: string) {
  console.log("→ Offres…");
  let count = 0;
  const jobIds: string[] = [];
  for (const c of SEED_COMPANIES) {
    const companyId = companyIds.get(c.slug)!;
    const locations = await prisma.companyLocation.findMany({ where: { companyId } });
    const usedTitles = new Set<string>();
    for (let i = 0; i < c.jobsCount; i++) {
      const family = c.jobFamilies[i % c.jobFamilies.length]!;
      const templates = templatesFor(family);
      if (templates.length === 0) continue;
      const tpl = pick(templates);
      let title = pick(tpl.titles);
      let guard = 0;
      while (usedTitles.has(title) && guard++ < 5) title = pick(tpl.titles);
      usedTitles.add(title);
      const location = i === 0 || rand() < 0.65 ? locations.find((l) => l.isHeadquarters)! : pick(locations);
      const cityInfo = CITIES.find((x) => x.name === location.city);
      const publishedAt = hoursAgo(rand() < 0.35 ? between(1, 48) : between(48, 720));
      const durationMonths = pick(tpl.durations);
      const salaryMin = between(tpl.salary[0], tpl.salary[0] + 200);
      const salaryMax = between(salaryMin + 200, tpl.salary[1]);
      const skillNames = tpl.skills.filter(() => rand() < 0.85);
      const slugs = skillSlugs(skillNames);
      const description = [
        `${c.name} — ${c.description}`,
        "",
        tpl.intro,
        "",
        `Poste basé à ${location.city}${cityInfo ? ` (${cityInfo.department})` : ""}, à pourvoir pour la rentrée, en contrat de ${durationMonths} mois.`,
        "",
        "Ce que tu vas faire :",
        ...tpl.missions.map((m) => `• ${m}`),
        "",
        "Ce que nous recherchons :",
        ...tpl.requirements.map((r) => `• ${r}`),
      ].join("\n");

      const job = await prisma.job.create({
        data: {
          slug: `${slugify(`${title}-${c.name}-${location.city}`)}-${(count + 1).toString(36)}`,
          title,
          normalizedTitle: normalizeJobTitle(title),
          companyNameRaw: c.name,
          companyId,
          description,
          missions: tpl.missions,
          requirements: tpl.requirements,
          benefits: pickBenefits(rand, between(3, 5)),
          skillsText: skillNames,
          city: location.city,
          postalCode: location.postalCode,
          department: location.department,
          region: location.region,
          latitude: location.latitude,
          longitude: location.longitude,
          contractType: rand() < 0.85 ? "APPRENTISSAGE" : "PROFESSIONNALISATION",
          educationLevelMin: tpl.levelMin,
          educationLevelMax: tpl.levelMax,
          durationMonths,
          rhythm: pick(tpl.rhythms),
          salaryMin,
          salaryMax,
          remote: pick(tpl.remote),
          startDate: new Date("2026-09-01"),
          jobFamily: family,
          sector: c.sector,
          publishedAt,
          discoveredAt: publishedAt,
          expiresAt: daysFromNow(between(20, 60)),
          source: "MANUAL",
          sourceUrl: `${c.website}/carrieres/offres/${count + 1}`,
          applicationUrl: `${c.website}/carrieres/offres/${count + 1}/postuler`,
          isActive: true,
          isDemo: true,
          dataOrigin: "DEMO",
          viewCount: between(5, 400),
          skills: {
            create: slugs
              .filter((s) => skillIds.has(s))
              .map((s, idx) => ({ skillId: skillIds.get(s)!, required: idx < 3 })),
          },
          sourceEntries: { create: { sourceId, externalId: `demo-${count + 1}`, url: `${c.website}/carrieres/offres/${count + 1}` } },
        },
      });
      jobIds.push(job.id);
      count++;
    }
  }
  console.log(`   ${count} offres créées`);
  return jobIds;
}

async function createUser(input: { email: string; password: string; name: string; role: "USER" | "ADMIN"; onboardingDone: boolean }) {
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      emailVerified: true,
      role: input.role,
      plan: "FREE",
      onboardingCompletedAt: input.onboardingDone ? daysAgo(12) : null,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      lastActiveAt: now,
      alertPreference: { create: {} },
    },
  });
  await prisma.account.create({
    data: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(input.password) },
  });
  return user;
}

async function seedDemoUser(companyIds: Map<string, string>, skillIds: Map<string, string>) {
  console.log("→ Utilisateurs de démonstration…");
  await createUser({ ...ADMIN_USER, role: "ADMIN", onboardingDone: true });
  const user = await createUser({ ...DEMO_USER, role: "USER", onboardingDone: true });
  const nantes = findCity("Nantes")!;

  const profileSkills = ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "PostgreSQL", "Git", "Docker", "Agile"];
  const profile = await prisma.candidateProfile.create({
    data: {
      userId: user.id,
      firstName: DEMO_USER.firstName,
      lastName: DEMO_USER.lastName,
      phone: "06 12 34 56 78",
      headline: "Étudiante BTS SIO, future développeuse full stack",
      targetJobTitle: "Développeuse web",
      jobFamily: "dev",
      educationLevel: "BAC2",
      educationTitle: "BTS SIO option SLAM",
      school: "Lycée Livet",
      city: nantes.name,
      postalCode: nantes.postalCode,
      department: nantes.department,
      region: nantes.region,
      latitude: 47.2138,
      longitude: -1.5561,
      schoolCity: "Nantes",
      schoolLatitude: 47.2201,
      schoolLongitude: -1.5479,
      mobility: "DEPARTMENT",
      hasDrivingLicense: true,
      hasVehicle: false,
      maxRadiusKm: 30,
      remotePreference: "HYBRID",
      startDate: new Date("2026-09-01"),
      durationMonths: 24,
      rhythm: "TWO_THREE",
      contractTypes: ["APPRENTISSAGE"],
      sectors: ["tech", "consulting", "digital-agency", "banking-insurance"],
      bio: "Passée par un stage en agence web, je cherche une alternance où je pourrai progresser sur React et Node.js au sein d'une équipe produit.",
      linkedinUrl: "https://www.linkedin.com/in/lea-martin-demo",
      weeklyGoal: 20,
      currentStreak: 4,
      longestStreak: 9,
      lastActiveDate: new Date(),
      completionScore: 92,
      skills: {
        create: skillSlugs(profileSkills)
          .filter((s) => skillIds.has(s))
          .map((s, i) => ({ skillId: skillIds.get(s)!, level: i < 4 ? 4 : 3 })),
      },
      educations: {
        create: [
          { title: "BTS SIO option SLAM", school: "Lycée Livet, Nantes", level: "BAC2", startYear: 2025, endYear: 2027, current: true },
          { title: "Baccalauréat général, spécialités NSI et mathématiques", school: "Lycée Clemenceau, Nantes", level: "BAC", startYear: 2022, endYear: 2025 },
        ],
      },
      experiences: {
        create: [
          { title: "Stage développeuse web", company: "Agence Pixel", startDate: new Date("2026-05-04"), endDate: new Date("2026-06-27"), description: "Site vitrine React + Tailwind pour 3 clients ; tests automatisés Playwright (-40 % de régressions).", skills: ["React", "Tailwind CSS", "Playwright"] },
          { title: "Vendeuse (job étudiant)", company: "Boulangerie du Bouffay", startDate: new Date("2024-09-01"), endDate: new Date("2025-06-30"), description: "Accueil, conseil client, gestion de caisse.", skills: ["Relation client"] },
        ],
      },
      projects: {
        create: [{ name: "Application de gestion de stock", description: "API REST Node.js + PostgreSQL, CI GitHub Actions, utilisée par 12 étudiants.", url: "https://github.com/example/stock-app", skills: ["Node.js", "PostgreSQL", "CI/CD"] }],
      },
      languages: { create: [{ name: "Anglais", level: "B2" }, { name: "Espagnol", level: "A2" }] },
    },
  });

  // CV
  const parsed = parseResumeText(DEMO_RESUME_TEXT);
  const analysis = analyzeResume(DEMO_RESUME_TEXT, { targetJobFamilyKeywords: JOB_FAMILIES["dev"].keywords });
  await prisma.resume.create({
    data: {
      userId: user.id,
      title: "CV Développement",
      isDefault: true,
      versions: {
        create: {
          version: 1,
          fileName: "CV-Lea-Martin.txt",
          mimeType: "text/plain",
          fileSize: DEMO_RESUME_TEXT.length,
          extractedText: DEMO_RESUME_TEXT,
          content: JSON.parse(JSON.stringify({ email: parsed.email, phone: parsed.phone, skills: parsed.skills.map((s) => s.name), languages: parsed.languages.map((l) => l.name), educationLines: parsed.educationLines, experienceLines: parsed.experienceLines })),
          analysis: JSON.parse(JSON.stringify(analysis)),
        },
      },
    },
  });
  await prisma.resume.create({ data: { userId: user.id, title: "CV Data", isDefault: false } });

  // Candidatures : parcours réaliste
  const devJobs = await prisma.job.findMany({
    where: { jobFamily: "dev", region: "Pays de la Loire" },
    include: { company: true },
    orderBy: { publishedAt: "desc" },
    take: 12,
  });
  const statuses: Array<{ status: ApplicationStatus; appliedDaysAgo: number | null; notes?: string; followUp?: boolean }> = [
    { status: "SENT", appliedDaysAgo: 9, notes: "Candidature via le site carrières. Contact RH : Marie Dupont." },
    { status: "SENT", appliedDaysAgo: 11 },
    { status: "TO_FOLLOW_UP", appliedDaysAgo: 15, followUp: true },
    { status: "INTERVIEW", appliedDaysAgo: 18, notes: "Entretien technique prévu avec le lead dev." },
    { status: "SENT", appliedDaysAgo: 3 },
    { status: "TO_APPLY", appliedDaysAgo: null, notes: "Préparer une lettre orientée React." },
    { status: "TO_APPLY", appliedDaysAgo: null },
    { status: "TO_REVIEW", appliedDaysAgo: null },
    { status: "REJECTED", appliedDaysAgo: 25, notes: "Refus : ils cherchaient un Bac+5." },
    { status: "OFFER", appliedDaysAgo: 30, notes: "Proposition reçue : 1 250 € brut, 2j/3j." },
  ];
  const created: Array<{ id: string; companyId: string; jobId: string; status: ApplicationStatus; companyName: string; title: string }> = [];
  for (let i = 0; i < Math.min(statuses.length, devJobs.length); i++) {
    const job = devJobs[i]!;
    const s = statuses[i]!;
    const appliedAt = s.appliedDaysAgo !== null ? daysAgo(s.appliedDaysAgo) : null;
    const app = await prisma.application.create({
      data: {
        userId: user.id,
        jobId: job.id,
        companyId: job.companyId,
        status: s.status,
        appliedAt,
        notes: s.notes ?? null,
        nextAction: s.status === "SENT" ? "Relancer si pas de réponse" : s.status === "TO_APPLY" ? "Envoyer la candidature" : s.status === "INTERVIEW" ? "Préparer l'entretien" : null,
        nextActionAt: s.status === "SENT" && appliedAt ? new Date(appliedAt.getTime() + 7 * 86_400_000) : s.status === "TO_APPLY" ? daysFromNow(2) : null,
        channel: appliedAt ? "FORM" : null,
        position: i,
        matchScore: between(70, 95),
        createdAt: appliedAt ?? daysAgo(between(1, 5)),
        events: {
          create: [
            { type: "CREATED", toStatus: "TO_REVIEW", createdAt: appliedAt ? new Date(appliedAt.getTime() - 2 * 86_400_000) : daysAgo(between(1, 5)) },
            ...(appliedAt ? [{ type: "STATUS_CHANGED" as const, fromStatus: "TO_APPLY" as const, toStatus: "SENT" as const, createdAt: appliedAt }] : []),
            ...(s.status !== "SENT" && s.status !== "TO_REVIEW" && s.status !== "TO_APPLY"
              ? [{ type: "STATUS_CHANGED" as const, fromStatus: "SENT" as const, toStatus: s.status, createdAt: daysAgo(Math.max(0, (s.appliedDaysAgo ?? 2) - 5)) }]
              : []),
          ],
        },
      },
    });
    created.push({ id: app.id, companyId: job.companyId, jobId: job.id, status: s.status, companyName: job.company.name, title: job.title });
  }

  // Entretien à venir
  const interviewApp = created.find((a) => a.status === "INTERVIEW");
  if (interviewApp) {
    const contact = await prisma.contact.findFirst({ where: { companyId: interviewApp.companyId } });
    await prisma.interview.create({
      data: {
        userId: user.id,
        applicationId: interviewApp.id,
        companyId: interviewApp.companyId,
        jobId: interviewApp.jobId,
        contactId: contact?.id ?? null,
        scheduledAt: daysFromNow(2),
        durationMin: 45,
        type: "VIDEO",
        status: "SCHEDULED",
        location: "Visioconférence (lien envoyé par email)",
        notes: "Revoir les bases de React (hooks, state), préparer 2 questions sur l'équipe.",
      },
    });
  }

  // Favoris
  const favoriteJobs = await prisma.job.findMany({ where: { id: { notIn: created.map((a) => a.jobId) }, region: { in: ["Pays de la Loire", "Bretagne"] }, jobFamily: { in: ["dev", "data"] } }, take: 5 });
  for (const [i, job] of favoriteJobs.entries()) {
    await prisma.favorite.create({ data: { userId: user.id, jobId: job.id, collection: i < 2 ? "PRIORITY" : i < 4 ? "TO_APPLY" : "WATCH" } });
  }
  for (const slug of ["breizh-data", "atlantic-cloud"]) {
    const id = companyIds.get(slug);
    if (id) await prisma.favorite.create({ data: { userId: user.id, companyId: id, collection: "COMPANIES" } });
  }

  // Outreach
  const outreachCompany = companyIds.get("loire-digital")!;
  const outreachContact = await prisma.contact.findFirst({ where: { companyId: outreachCompany } });
  await prisma.outreach.create({
    data: { userId: user.id, companyId: outreachCompany, contactId: outreachContact?.id ?? null, channel: "LINKEDIN", status: "SENT", subject: "Candidature spontanée développeuse web", lastContactAt: daysAgo(5), nextFollowUpAt: daysFromNow(2), notes: "Message LinkedIn envoyé à la lead dev." },
  });
  await prisma.outreach.create({
    data: { userId: user.id, companyId: companyIds.get("breizh-data")!, channel: "EMAIL", status: "PLANNED", subject: "Candidature spontanée data / dev", nextFollowUpAt: daysFromNow(1) },
  });

  // Notifications
  await prisma.notification.createMany({
    data: [
      { userId: user.id, type: "HIGH_MATCH_JOB", title: "3 nouvelles offres à plus de 85 % de compatibilité", body: "Développeur Full Stack chez Nova Systèmes, et 2 autres à Nantes.", href: "/jobs?sort=match", createdAt: hoursAgo(2) },
      { userId: user.id, type: "FOLLOW_UP_REQUIRED", title: "2 candidatures à relancer", body: "Sans réponse depuis plus de 7 jours.", href: "/applications", createdAt: hoursAgo(5) },
      { userId: user.id, type: "INTERVIEW_REMINDER", title: "Entretien dans 2 jours", body: interviewApp ? `Entretien vidéo chez ${interviewApp.companyName}.` : "Prépare ton entretien.", href: "/interviews", createdAt: hoursAgo(20) },
      { userId: user.id, type: "NEW_COMPANY", title: "Nouvelle entreprise repérée par le Radar", body: "Breizh Data recrute des profils dev/data à Nantes.", href: "/companies/breizh-data", readAt: daysAgo(1), createdAt: daysAgo(1) },
    ],
  });

  // Activités (streak de 4 jours)
  const activities: Array<{ type: "APPLICATION_CREATED" | "JOB_SAVED" | "FOLLOW_UP_SENT" | "RESUME_ANALYZED" | "JOB_VIEWED" | "PROFILE_UPDATED"; title: string; daysAgo: number; applicationId?: string }> = [
    { type: "JOB_VIEWED", title: "A consulté 6 offres à Nantes", daysAgo: 0 },
    { type: "APPLICATION_CREATED", title: `Candidature envoyée à ${created[4]?.companyName ?? "une entreprise"}`, daysAgo: 1, applicationId: created[4]?.id },
    { type: "JOB_SAVED", title: "2 offres ajoutées aux favoris", daysAgo: 2 },
    { type: "FOLLOW_UP_SENT", title: `Relance envoyée à ${created[2]?.companyName ?? "une entreprise"}`, daysAgo: 3, applicationId: created[2]?.id },
    { type: "RESUME_ANALYZED", title: "CV Développement analysé : 84/100", daysAgo: 6 },
    { type: "PROFILE_UPDATED", title: "Profil complété à 92 %", daysAgo: 12 },
  ];
  await prisma.activity.createMany({
    data: activities.map((a) => ({ userId: user.id, type: a.type, title: a.title, applicationId: a.applicationId ?? null, createdAt: daysAgo(a.daysAgo) })),
  });

  // Actions du jour
  const followUpApp = created.find((a) => a.status === "TO_FOLLOW_UP");
  const today = new Date(new Date().toISOString().slice(0, 10));
  const actions: Array<{ type: DailyActionType; title: string; description: string; href: string; priority: number; applicationId?: string; jobId?: string; companyId?: string; done?: boolean }> = [
    { type: "APPLY_JOB", title: "Postuler aux 3 offres à plus de 85 %", description: "Nova Systèmes, Atlantic Cloud et Loire Digital te correspondent très bien.", href: "/jobs?sort=match", priority: 90, done: false },
    { type: "FOLLOW_UP", title: followUpApp ? `Relancer ${followUpApp.companyName}` : "Relancer une candidature", description: "Sans réponse depuis 15 jours.", href: `/applications${followUpApp ? `?application=${followUpApp.id}` : ""}`, priority: 85, applicationId: followUpApp?.id, done: false },
    { type: "CONTACT_COMPANY", title: "Contacter Breizh Data", description: "Potentiel estimé 82 %, aucune offre publiée : candidature spontanée.", href: "/companies/breizh-data", priority: 70, companyId: companyIds.get("breizh-data"), done: false },
    { type: "UPDATE_RESUME", title: "Adapter ton CV pour Nova Systèmes", description: "Java et Spring apparaissent dans l'annonce, pas dans ton CV.", href: "/resume", priority: 60, done: true },
  ];
  await prisma.dailyAction.createMany({
    data: actions.map((a) => ({ userId: user.id, date: today, type: a.type, title: a.title, description: a.description, href: a.href, priority: a.priority, applicationId: a.applicationId ?? null, jobId: a.jobId ?? null, companyId: a.companyId ?? null, completedAt: a.done ? hoursAgo(1) : null })),
  });

  // Recherche sauvegardée
  await prisma.savedSearch.create({ data: { userId: user.id, name: "Dev web Nantes 30 km", query: { q: "développeur web", city: "Nantes", radius: 30, levels: ["BAC2", "BAC3"] }, alertEnabled: true, lastRunAt: hoursAgo(6) } });

  // Conversation copilote
  await prisma.aIConversation.create({
    data: {
      userId: user.id,
      title: "Meilleures offres à Nantes",
      messages: {
        create: [
          { role: "USER", content: "Trouve-moi les meilleures offres à Nantes." },
          { role: "ASSISTANT", content: "Voici tes 3 meilleures opportunités à Nantes aujourd'hui, classées par compatibilité : Nova Systèmes (92 %), Atlantic Cloud (88 %) et Loire Digital (86 %). Veux-tu que je t'aide à adapter ton CV pour l'une d'elles ?", provider: "mock", model: "mock-v1" },
        ],
      },
    },
  });

  console.log(`   Compte démo : ${DEMO_USER.email} / ${DEMO_USER.password}`);
  console.log(`   Compte admin : ${ADMIN_USER.email} / ${ADMIN_USER.password}`);
  return profile;
}

async function main() {
  console.log("🌱 Seed Alternance OS (données de démonstration fictives)");
  await reset();
  const skillIds = await seedSkills();
  const source = await seedSources();
  const companyIds = await seedCompanies();
  await seedJobs(companyIds, skillIds, source.id);
  await prisma.jobSource.update({ where: { id: source.id }, data: { jobsCount: await prisma.job.count() } });
  await seedDemoUser(companyIds, skillIds);
  const [companies, jobs, contacts, skills] = await Promise.all([prisma.company.count(), prisma.job.count(), prisma.contact.count(), prisma.skill.count()]);
  console.log(`✅ Terminé : ${companies} entreprises, ${jobs} offres, ${contacts} contacts démo, ${skills} compétences.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
