import { EDUCATION_LEVELS, WORK_RHYTHMS } from "@/config/taxonomy";
import type { EducationLevel, WorkRhythm } from "@/generated/prisma/enums";
import type { CopilotContext } from "./context-types";

export type DocumentKindKey = "cover_letter" | "email" | "linkedin_message" | "follow_up" | "interview_prep" | "resume_adaptation" | "spontaneous_email" | "spontaneous_pitch";

export const SYSTEM_PROMPT = `Tu es le copilote d'Alternance OS, un assistant personnel spécialisé dans la recherche d'alternance en France.
Tu t'adresses à un·e étudiant·e (18-30 ans) qui ne connaît pas forcément les codes du recrutement. Tutoie, sois direct, concret et chaleureux, jamais infantilisant.

Règles absolues :
- N'invente JAMAIS une expérience, une compétence, un diplôme, un chiffre ou un contact. Utilise uniquement le contexte fourni. Si une information manque, dis-le ou pose une question courte.
- Évite les formules creuses (« passionné depuis toujours », « force de proposition », « dynamique et motivé »). Préfère des faits : un projet, un outil, un résultat, une raison précise de viser cette entreprise.
- Écris en français naturel, phrases courtes, sans jargon RH. Pas de tirets cadratins.
- Les textes destinés à être envoyés (lettre, email, message, relance) doivent être prêts à l'emploi : pas de crochets à remplir sauf si l'information manque vraiment ; dans ce cas utilise [à compléter].
- Rappelle, quand c'est utile, que rien n'est envoyé automatiquement : l'utilisateur relit et envoie lui-même.
- Réponds en Markdown léger (titres ##, listes, gras) pour les analyses ; en texte brut pour les lettres et emails.`;

function levelLabel(level: string | null): string | null {
  return level && level in EDUCATION_LEVELS ? EDUCATION_LEVELS[level as EducationLevel].label : level;
}
function rhythmLabel(r: string | null): string | null {
  return r && r in WORK_RHYTHMS ? WORK_RHYTHMS[r as WorkRhythm].label : r;
}

/** Sérialise le contexte en texte compact et lisible pour le modèle. */
export function renderContext(ctx: CopilotContext): string {
  const p = ctx.profile;
  const parts: string[] = [];
  parts.push(
    [
      `## Profil du candidat`,
      `Prénom : ${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`,
      p.targetJobTitle ? `Métier recherché : ${p.targetJobTitle}` : null,
      p.educationTitle || p.educationLevel ? `Formation : ${[p.educationTitle, levelLabel(p.educationLevel)].filter(Boolean).join(" · ")}${p.school ? ` (${p.school})` : ""}` : null,
      p.city ? `Ville : ${p.city}` : null,
      p.startDate || p.durationMonths || p.rhythm ? `Contrat souhaité : ${[p.startDate ? `début ${p.startDate}` : null, p.durationMonths ? `${p.durationMonths} mois` : null, rhythmLabel(p.rhythm)].filter(Boolean).join(", ")}` : null,
      p.skills.length ? `Compétences : ${p.skills.join(", ")}` : `Compétences : non renseignées`,
      p.experiences.length ? `Expériences :\n${p.experiences.map((e) => `- ${e.title} — ${e.company}${e.description ? ` : ${e.description}` : ""}`).join("\n")}` : `Expériences : aucune renseignée`,
      p.bio ? `Présentation : ${p.bio}` : null,
      `Profil complété à ${p.completion} %`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  if (ctx.resume) {
    parts.push(`## CV (${ctx.resume.title}${ctx.resume.score !== null ? `, score ${ctx.resume.score}/100` : ""})\n${ctx.resume.excerpt}`);
  }
  if (ctx.job) {
    const j = ctx.job;
    parts.push(
      [
        `## Offre visée`,
        `Titre : ${j.title}`,
        `Entreprise : ${j.companyName} (${j.city})`,
        j.skills.length ? `Compétences demandées : ${j.skills.join(", ")}` : null,
        j.missions.length ? `Missions :\n${j.missions.map((m) => `- ${m}`).join("\n")}` : null,
        j.requirements.length ? `Profil recherché :\n${j.requirements.map((m) => `- ${m}`).join("\n")}` : null,
        j.matchScore !== null ? `Compatibilité calculée : ${j.matchScore} % (${j.matchReasons.join(" ; ")})` : null,
        `Description : ${j.description.slice(0, 1500)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (ctx.company) {
    const c = ctx.company;
    parts.push(
      [
        `## Entreprise`,
        `Nom : ${c.name} (${c.city})`,
        c.sector ? `Secteur : ${c.sector}` : null,
        c.size ? `Taille : ${c.size}` : null,
        c.technologies.length ? `Technologies : ${c.technologies.join(", ")}` : null,
        c.description ? `Description : ${c.description}` : null,
        c.recommendedContact ? `Interlocuteur recommandé : ${c.recommendedContact.firstName} ${c.recommendedContact.lastName}, ${c.recommendedContact.jobTitle}` : `Interlocuteur : aucun contact vérifié`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (ctx.application) {
    const a = ctx.application;
    parts.push(`## Candidature\nStatut : ${a.status}${a.appliedAt ? ` · envoyée le ${a.appliedAt}` : ""}${a.daysSinceApplied !== null ? ` (il y a ${a.daysSinceApplied} jours)` : ""} · relances : ${a.followUpCount}`);
  }
  if (ctx.topJobs?.length) {
    parts.push(`## Meilleures offres actuelles (calculées)\n${ctx.topJobs.map((j) => `- ${j.title} — ${j.companyName}, ${j.city} : ${j.matchScore} % (${j.reasons.slice(0, 2).join(" ; ")})`).join("\n")}`);
  }
  if (ctx.companies?.length) {
    parts.push(`## Entreprises à contacter (Radar, estimation)\n${ctx.companies.map((c) => `- ${c.name}, ${c.city} : potentiel ${c.opportunityScore} %${c.reason ? ` (${c.reason})` : ""}`).join("\n")}`);
  }
  if (ctx.followUps?.length) {
    parts.push(`## Candidatures à relancer\n${ctx.followUps.map((f) => `- ${f.companyName}${f.jobTitle ? ` (${f.jobTitle})` : ""} : envoyée il y a ${f.daysSinceApplied} jours`).join("\n")}`);
  }
  if (ctx.interviews?.length) {
    parts.push(`## Entretiens à venir\n${ctx.interviews.map((i) => `- ${i.companyName}${i.jobTitle ? ` (${i.jobTitle})` : ""} : ${i.scheduledAt}`).join("\n")}`);
  }
  if (ctx.stats) {
    const s = ctx.stats;
    parts.push(`## Statistiques\n${s.applicationsSent} candidatures envoyées, ${s.responses} réponses (${s.responseRate} %), ${s.interviews} entretiens`);
  }
  return parts.join("\n\n");
}

export const DOCUMENT_LABELS: Record<DocumentKindKey, string> = {
  cover_letter: "Lettre de motivation",
  email: "Email de candidature",
  linkedin_message: "Message LinkedIn",
  follow_up: "Relance",
  interview_prep: "Préparation d'entretien",
  resume_adaptation: "Adaptation du CV",
  spontaneous_email: "Email de candidature spontanée",
  spontaneous_pitch: "Angle de candidature spontanée",
};

/** Instruction de tâche pour chaque type de document. */
export function documentInstruction(kind: DocumentKindKey, extra?: string): string {
  const base: Record<DocumentKindKey, string> = {
    cover_letter: `Rédige une lettre de motivation pour l'offre visée. 250 à 350 mots, 4 paragraphes : (1) ce que je cherche et pourquoi cette offre précisément, (2) une expérience ou un projet concret relié aux missions, (3) ce que j'apporte et ce que je veux apprendre chez eux, (4) proposition d'entretien. Objet en première ligne. Texte brut, pas de Markdown.`,
    email: `Rédige un email de candidature court (120 à 180 mots) pour l'offre visée, avec objet. Une accroche précise sur l'entreprise ou la mission, un fait concret sur moi, une demande d'échange. Mentionne que le CV est joint. Texte brut.`,
    linkedin_message: `Rédige un message LinkedIn de première approche (moins de 300 caractères, hors salutation) adressé à l'interlocuteur recommandé ou à un recruteur de l'entreprise : qui je suis, ce que je cherche, une raison précise de les contacter, une question ouverte. Texte brut.`,
    follow_up: `Rédige une relance polie et courte (90 à 140 mots) pour la candidature indiquée, avec objet. Rappelle le poste et la date d'envoi, ajoute une information nouvelle ou un élément de motivation concret, propose un échange. Texte brut.`,
    interview_prep: `Prépare-moi pour l'entretien. Structure en Markdown : ## L'entreprise en 3 points ; ## Questions probables (6 à 8, adaptées au poste) ; ## Points à mettre en avant (à partir de MON profil uniquement) ; ## Questions à poser (4) ; ## Pièges à éviter (2 ou 3).`,
    resume_adaptation: `Propose une adaptation de mon CV pour l'offre visée, SANS inventer : ## Accroche proposée (2 lignes) ; ## Ordre des compétences (celles de l'offre que je possède en premier) ; ## Reformulation de mes expériences avec le vocabulaire de l'annonce (garde les faits) ; ## À ne pas faire (compétences manquantes à ne pas ajouter, et comment en parler honnêtement).`,
    spontaneous_email: `Rédige un email de candidature spontanée (130 à 190 mots) pour cette entreprise, avec objet. Explique pourquoi cette entreprise précisément (activité, technologies, taille), ce que je propose concrètement, et demande un échange de 15 minutes. Texte brut.`,
    spontaneous_pitch: `Donne-moi en Markdown : **Angle** (une phrase : pourquoi moi pour eux), **Contact** (qui viser et pourquoi, à partir du contexte uniquement), **Trois arguments concrets**, **Prochaine étape**.`,
  };
  return extra ? `${base[kind]}\n\nConsignes supplémentaires de l'utilisateur : ${extra.slice(0, 600)}` : base[kind];
}
