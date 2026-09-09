import type { CopilotContext } from "../context-types";
import type { AIGenerateOptions, AIProvider, AIResult, AIStreamEvent } from "../types";

/**
 * Fournisseur de démonstration : aucune clé requise.
 * Produit des réponses déterministes construites UNIQUEMENT à partir des données
 * réelles du compte (contexte structuré). Toujours signalé comme « mode démo ».
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock-v1";

  isConfigured(): boolean {
    return true;
  }

  async generate(options: AIGenerateOptions): Promise<AIResult> {
    const text = renderMock(options);
    return { text, provider: this.name, model: this.model, tokensIn: 0, tokensOut: 0, finishReason: "end_turn" };
  }

  async *stream(options: AIGenerateOptions): AsyncGenerator<AIStreamEvent, void, undefined> {
    const text = renderMock(options);
    // Simule un flux de mots pour une expérience proche du réel
    const words = text.split(/(\s+)/);
    let chunk = "";
    for (const w of words) {
      chunk += w;
      if (chunk.length > 12) {
        yield { type: "delta", text: chunk };
        chunk = "";
        await new Promise((r) => setTimeout(r, 12));
      }
    }
    if (chunk) yield { type: "delta", text: chunk };
    yield { type: "done", result: { text, provider: this.name, model: this.model, finishReason: "end_turn" } };
  }
}

const DEMO_NOTE = "\n\n---\n_Mode démo : texte généré par des règles à partir de tes données, sans clé IA. Configure ANTHROPIC_API_KEY pour des textes rédigés par un modèle._";

function first<T>(arr: T[] | undefined): T | undefined {
  return arr?.[0];
}

function renderMock(options: AIGenerateOptions): string {
  const kind = options.meta?.kind ?? "chat";
  const ctx = (options.meta?.context ?? {}) as Partial<CopilotContext>;
  const input = options.meta?.userInput ?? options.messages[options.messages.length - 1]?.content ?? "";
  const p = ctx.profile;
  const firstName = p?.firstName ?? "Candidat";
  const job = ctx.job;
  const company = ctx.company ?? (job ? { name: job.companyName, description: null, sector: null, size: null, technologies: [], recommendedContact: null, city: job.city } : undefined);
  const skills = p?.skills?.slice(0, 4) ?? [];
  const sharedSkills = job ? job.skills.filter((s) => p?.skills?.some((k) => k.toLowerCase() === s.toLowerCase())) : [];
  const exp = first(p?.experiences);

  switch (kind) {
    case "cover_letter":
      return [
        `Objet : Candidature en alternance — ${job?.title ?? p?.targetJobTitle ?? "poste"}`,
        "",
        `Madame, Monsieur,`,
        "",
        `${p?.educationTitle ? `En ${p.educationTitle}${p.school ? ` à ${p.school}` : ""}, je` : "Je"} recherche une alternance de ${p?.durationMonths ?? 24} mois à partir de ${p?.startDate ?? "la rentrée"}${p?.rhythm ? ` (rythme ${p.rhythm})` : ""}. Votre offre « ${job?.title ?? p?.targetJobTitle ?? "alternance"} »${company ? ` chez ${company.name}` : ""} correspond précisément à ce que je veux apprendre : ${job?.missions?.[0]?.toLowerCase() ?? "contribuer à des projets concrets en équipe"}.`,
        "",
        exp
          ? `Lors de mon expérience « ${exp.title} » chez ${exp.company}, ${exp.description ? exp.description.replace(/^./, (c) => c.toLowerCase()).replace(/\.$/, "") : "j'ai travaillé sur des projets réels"}. ${sharedSkills.length ? `J'y ai pratiqué ${sharedSkills.slice(0, 3).join(", ")}, que vous mentionnez dans l'annonce.` : skills.length ? `J'y ai utilisé ${skills.slice(0, 3).join(", ")}.` : ""}`
          : `${skills.length ? `Je maîtrise ${skills.join(", ")}` : "Je me forme activement"}${sharedSkills.length ? `, dont ${sharedSkills.slice(0, 2).join(" et ")} que vous recherchez` : ""}, et je progresse vite sur les outils que je ne connais pas encore.`,
        "",
        `${company?.technologies?.length ? `Votre environnement (${company.technologies.slice(0, 3).join(", ")}) ` : "Votre équipe "}m'intéresse parce que ${company?.description ? company.description.split(".")[0]?.toLowerCase() : "vous accueillez des alternants et les faites monter en compétences"}. Je souhaite y apporter de la rigueur, de l'autonomie et l'envie d'apprendre, en échange d'un accompagnement sur ${job?.skills?.find((s) => !sharedSkills.includes(s)) ?? "vos pratiques"}.`,
        "",
        `Je serais heureux·se d'en discuter lors d'un entretien. Je reste disponible${p?.phone ? ` au ${p.phone}` : ""} et par email.`,
        "",
        `Cordialement,`,
        `${firstName}${p?.lastName ? ` ${p.lastName}` : ""}`,
        DEMO_NOTE,
      ].join("\n");
    case "email":
    case "spontaneous_email":
      return [
        `Objet : ${kind === "email" && job ? `Candidature — ${job.title}` : `Alternance ${p?.targetJobTitle ?? ""} — candidature spontanée`}`,
        "",
        `Bonjour${company?.recommendedContact ? ` ${company.recommendedContact.firstName}` : ""},`,
        "",
        `Je suis ${firstName}, ${p?.educationTitle ? `en ${p.educationTitle}` : "étudiant·e"}${p?.city ? ` à ${p.city}` : ""}, et je cherche une alternance de ${p?.durationMonths ?? 24} mois à partir de ${p?.startDate ?? "septembre"}.`,
        "",
        job
          ? `Votre offre « ${job.title} » m'intéresse pour une raison précise : ${job.missions?.[0]?.toLowerCase() ?? "les missions décrites"}. ${sharedSkills.length ? `Je pratique déjà ${sharedSkills.slice(0, 3).join(", ")}.` : ""}`
          : `${company?.name ?? "Votre entreprise"} ${company?.technologies?.length ? `travaille avec ${company.technologies.slice(0, 3).join(", ")}` : "accueille des alternants"} : ${skills.length ? `c'est exactement ce que je pratique (${skills.slice(0, 3).join(", ")})` : "c'est le type d'environnement où je veux progresser"}.`,
        "",
        exp ? `Concrètement : ${exp.description ?? `${exp.title} chez ${exp.company}`}` : "",
        "",
        `Auriez-vous 15 minutes pour en parler ? Mon CV est en pièce jointe.`,
        "",
        `Bonne journée,`,
        `${firstName}${p?.phone ? ` · ${p.phone}` : ""}`,
        DEMO_NOTE,
      ]
        .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
        .join("\n");
    case "linkedin_message":
      return [
        `Bonjour${company?.recommendedContact ? ` ${company.recommendedContact.firstName}` : ""}, je suis ${firstName}, ${p?.educationTitle ?? "étudiant·e"}${p?.city ? ` à ${p.city}` : ""}. Je cherche une alternance ${p?.targetJobTitle ? `en ${p.targetJobTitle.toLowerCase()}` : ""} dès ${p?.startDate ?? "septembre"}${company ? ` et ${company.name} m'attire${company.technologies?.length ? ` pour son travail sur ${company.technologies.slice(0, 2).join(" et ")}` : ""}` : ""}. ${sharedSkills.length ? `Je pratique ${sharedSkills.slice(0, 2).join(" et ")}.` : skills.length ? `Je pratique ${skills.slice(0, 2).join(" et ")}.` : ""} Seriez-vous ouvert·e à un échange de 10 minutes ? Merci !`,
        DEMO_NOTE,
      ].join("\n");
    case "follow_up":
      return [
        `Objet : Suite à ma candidature — ${job?.title ?? p?.targetJobTitle ?? "alternance"}`,
        "",
        `Bonjour${company?.recommendedContact ? ` ${company.recommendedContact.firstName}` : ""},`,
        "",
        `Je me permets de revenir vers vous au sujet de ma candidature${job ? ` pour le poste « ${job.title} »` : ""} envoyée${ctx.application?.appliedAt ? ` le ${ctx.application.appliedAt}` : " récemment"}.`,
        "",
        `Je reste très motivé·e par ${job?.missions?.[0] ? job.missions[0].toLowerCase() : "vos missions"}${sharedSkills.length ? `, d'autant que je pratique ${sharedSkills.slice(0, 2).join(" et ")}` : ""}. Si vous avez besoin d'un complément (portfolio, références, disponibilités pour un entretien), je peux vous le transmettre rapidement.`,
        "",
        `Merci pour votre temps, et bonne journée.`,
        "",
        `${firstName}${p?.phone ? ` · ${p.phone}` : ""}`,
        DEMO_NOTE,
      ].join("\n");
    case "interview_prep":
      return [
        `# Préparer l'entretien${company ? ` chez ${company.name}` : ""}`,
        "",
        `## L'entreprise en 3 points`,
        company?.description ? `- ${company.description}` : "- Consulte la fiche entreprise pour son activité.",
        company?.technologies?.length ? `- Technologies / outils : ${company.technologies.join(", ")}.` : "",
        company?.size ? `- Taille : ${company.size}${company.sector ? ` · secteur ${company.sector}` : ""}.` : "",
        "",
        `## Questions probables`,
        `1. Présente-toi en deux minutes : formation, ce que tu cherches, pourquoi nous.`,
        job ? `2. Qu'est-ce qui t'attire dans « ${job.title} » ?` : `2. Pourquoi ce métier ?`,
        exp ? `3. Raconte-nous « ${exp.title} » chez ${exp.company} : ton rôle, une difficulté, ce que tu as appris.` : `3. Un projet dont tu es fier·ère ?`,
        job?.skills?.length ? `4. Quel est ton niveau sur ${job.skills.slice(0, 3).join(", ")} ?` : `4. Quelles compétences veux-tu développer ?`,
        `5. Ton rythme d'alternance et tes disponibilités ?`,
        "",
        `## Points à mettre en avant`,
        ...(sharedSkills.length ? sharedSkills.slice(0, 3).map((s) => `- ${s} : demandé dans l'offre et présent dans ton profil.`) : skills.slice(0, 3).map((s) => `- ${s}`)),
        exp ? `- Un résultat concret : ${exp.description ?? exp.title}.` : "- Ta capacité à apprendre vite (donne un exemple daté).",
        "",
        `## Questions à poser`,
        `- Comment se passe l'accompagnement d'un alternant les 3 premiers mois ?`,
        `- Sur quel projet serais-je en premier ?`,
        job?.skills?.length ? `- Quelle place pour ${job.skills.find((s) => !sharedSkills.includes(s)) ?? "la montée en compétences"} dans l'équipe ?` : `- Quels outils utilisez-vous au quotidien ?`,
        `- Quelles sont les prochaines étapes du recrutement ?`,
        DEMO_NOTE,
      ]
        .filter(Boolean)
        .join("\n");
    case "resume_adaptation":
      return [
        `# Adapter ton CV${job ? ` pour « ${job.title} »` : ""}`,
        "",
        `## Accroche proposée`,
        `${p?.educationTitle ?? "Étudiant·e"} — recherche alternance ${p?.targetJobTitle ?? ""}${p?.durationMonths ? ` (${p.durationMonths} mois)` : ""}${sharedSkills.length ? ` · ${sharedSkills.slice(0, 3).join(" · ")}` : ""}`,
        "",
        `## Compétences à placer en premier`,
        ...(sharedSkills.length ? sharedSkills.map((s) => `- ${s}`) : skills.map((s) => `- ${s}`)),
        "",
        `## Ce qu'il ne faut PAS faire`,
        job?.skills?.filter((s) => !sharedSkills.includes(s)).length ? `- N'ajoute pas ${job.skills.filter((s) => !sharedSkills.includes(s)).slice(0, 3).join(", ")} si tu ne les pratiques pas. Mentionne plutôt une formation en cours si c'est vrai.` : "- N'invente aucune compétence.",
        "",
        `## Expérience à développer`,
        exp ? `- ${exp.title} chez ${exp.company} : reformule avec les mots de l'annonce (${job?.missions?.[0] ?? "missions"}).` : "- Ajoute un projet personnel ou scolaire lié au poste.",
        DEMO_NOTE,
      ].join("\n");
    case "spontaneous_pitch":
      return [
        `**Angle :** ${company?.name ?? "Cette entreprise"} ${company?.technologies?.length ? `utilise ${company.technologies.slice(0, 3).join(", ")}` : "accueille des alternants"} ; ${sharedSkills.length ? `tu pratiques déjà ${sharedSkills.join(", ")}` : skills.length ? `tu apportes ${skills.slice(0, 3).join(", ")}` : "tu apportes de la motivation et une capacité d'apprentissage"}.`,
        "",
        `**Contact :** ${company?.recommendedContact ? `${company.recommendedContact.firstName} ${company.recommendedContact.lastName} (${company.recommendedContact.jobTitle})` : "aucun contact vérifié : passe par la page carrières"}.`,
        "",
        `**Prochaine étape :** envoie l'email généré, puis relance dans 7 jours si pas de réponse.`,
        DEMO_NOTE,
      ].join("\n");
    default:
      return renderChat(input, ctx, firstName);
  }
}

function renderChat(input: string, ctx: Partial<CopilotContext>, firstName: string): string {
  const q = input.toLowerCase();
  const lines: string[] = [];
  if (ctx.topJobs?.length && /offre|poste|job|annonce|match|candidat/.test(q)) {
    lines.push(`Voici tes meilleures opportunités actuelles, ${firstName} :`, "");
    ctx.topJobs.slice(0, 5).forEach((j, i) => lines.push(`${i + 1}. **${j.title}** chez ${j.companyName} (${j.city}) — ${j.matchScore} % de compatibilité${j.reasons?.[0] ? ` · ${j.reasons[0]}` : ""}`));
    lines.push("", "Je te conseille de candidater aux trois premières aujourd'hui. Veux-tu une lettre pour l'une d'elles ?");
  } else if (ctx.companies?.length && /entreprise|contacter|spontan|radar|qui/.test(q)) {
    lines.push(`Entreprises à contacter en priorité (potentiel estimé) :`, "");
    ctx.companies.slice(0, 5).forEach((c, i) => lines.push(`${i + 1}. **${c.name}** — ${c.city} · ${c.opportunityScore} %${c.reason ? ` · ${c.reason}` : ""}`));
    lines.push("", "Pour chacune, je peux préparer un email de candidature spontanée et un message LinkedIn.");
  } else if (ctx.followUps?.length && /relanc|réponse|reponse|nouvelles|silence/.test(q)) {
    lines.push(`Candidatures à relancer :`, "");
    ctx.followUps.forEach((f) => lines.push(`- **${f.companyName}**${f.jobTitle ? ` (${f.jobTitle})` : ""} — envoyée il y a ${f.daysSinceApplied} jours`));
    lines.push("", "Une relance courte, polie, avec une nouvelle information (projet, disponibilité) fonctionne mieux qu'un simple rappel.");
  } else if (/pourquoi|marche pas|fonctionne pas|refus|aucune réponse|aucune reponse/.test(q)) {
    const s = ctx.stats;
    lines.push(`Regardons tes chiffres, ${firstName} :`, "");
    if (s) {
      lines.push(`- ${s.applicationsSent} candidatures envoyées, ${s.responses} réponses (${s.responseRate} %), ${s.interviews} entretien${s.interviews > 1 ? "s" : ""}.`);
      if (s.applicationsSent < 10) lines.push("- Volume encore faible : difficile de conclure. Vise 15 à 20 candidatures ciblées avant de changer de stratégie.");
      else if (s.responseRate < 15) lines.push("- Taux de réponse bas : personnalise davantage (une phrase sur l'entreprise, une sur ton apport concret) et relance à 7 jours.");
      else if (s.interviews === 0) lines.push("- Des réponses mais pas d'entretien : vérifie ton CV (score) et cible des offres plus compatibles (≥ 80 %).");
      else lines.push("- Tu obtiens des entretiens : concentre-toi sur la préparation (questions probables, exemples chiffrés).");
    }
    if (ctx.resume?.score !== undefined && ctx.resume.score !== null) lines.push(`- Ton CV est à ${ctx.resume.score}/100${ctx.resume.score < 70 ? " : c'est un levier immédiat." : "."}`);
    if (ctx.profile?.completion !== undefined && ctx.profile.completion < 70) lines.push(`- Profil complété à ${ctx.profile.completion} % : complète-le pour des recommandations plus précises.`);
  } else if (/entretien|interview|prépar|prepar/.test(q)) {
    lines.push(`Pour préparer un entretien, ouvre la fiche de l'entretien concerné et clique sur « Préparer » : je génère le résumé de l'entreprise, les questions probables, tes points forts et les questions à poser.`);
    if (ctx.interviews?.length) lines.push("", ...ctx.interviews.map((i) => `- ${i.companyName} — ${i.scheduledAt}`));
  } else if (/cv|curriculum/.test(q)) {
    lines.push(ctx.resume ? `Ton CV « ${ctx.resume.title} » est noté ${ctx.resume.score ?? "—"}/100.${ctx.resume.improvements?.length ? ` Priorités : ${ctx.resume.improvements.slice(0, 2).join(" ; ")}` : ""}` : "Importe d'abord ton CV depuis la page « Mon CV » pour que je puisse l'analyser.");
  } else {
    lines.push(`Je peux t'aider avec :`, "", "- « Trouve-moi les meilleures offres à Nantes »", "- « Quelles entreprises dois-je contacter aujourd'hui ? »", "- « Adapte mon CV à cette offre »", "- « Prépare mon entretien chez … »", "- « Pourquoi mes candidatures ne fonctionnent pas ? »");
  }
  lines.push(DEMO_NOTE);
  return lines.join("\n");
}
