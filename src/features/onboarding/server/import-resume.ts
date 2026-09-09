"use server";

import { requireUserId } from "@/lib/auth/session";
import { assertRateLimit } from "@/lib/rate-limit";
import { fail, ok, runAction, type ActionResult } from "@/lib/action";
import { findCity } from "@/config/cities";
import { parseResumeText } from "@/features/resume/lib/parse";
import { extractResumeText, RESUME_MAX_BYTES, sniffResumeType } from "@/features/resume/server/extract";
import { saveResumeFile } from "@/features/resume/server/actions";

export type ResumePrefill = {
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  educationLevel: string | null;
  educationTitle: string | null;
  skills: string[];
  resumeId: string;
  wordCount: number;
};

/** Importe un CV (PDF/texte), l'enregistre et renvoie des valeurs de préremplissage. Jamais d'invention : seulement ce qui est lu. */
export async function importResumeForOnboarding(formData: FormData): Promise<ActionResult<ResumePrefill>> {
  return runAction("importResumeForOnboarding", async () => {
    const userId = await requireUserId();
    await assertRateLimit("resume-upload", userId, { limit: 10, windowMs: 10 * 60_000 });
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("Aucun fichier reçu.");
    if (file.size === 0) return fail("Le fichier est vide.");
    if (file.size > RESUME_MAX_BYTES) return fail("Le fichier dépasse 5 Mo.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffResumeType(bytes);
    if (!type) return fail("Format non pris en charge : envoie un PDF (ou un fichier texte).");
    const text = await extractResumeText(bytes, type);
    if (text.trim().length < 50) return fail("Impossible de lire du texte dans ce fichier. Est-ce un PDF scanné en image ?");
    const parsed = parseResumeText(text);
    const saved = await saveResumeFile({ userId, fileName: file.name, mimeType: type, bytes, text, title: "CV importé" });
    const city = parsed.city ? findCity(parsed.city) : undefined;
    return ok({
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      city: city?.name ?? parsed.city,
      phone: parsed.phone,
      linkedinUrl: parsed.linkedinUrl,
      educationLevel: parsed.detectedLevel,
      educationTitle: parsed.detectedDegree,
      skills: parsed.skills.filter((s) => s.category !== "SOFT").map((s) => s.name).slice(0, 20),
      resumeId: saved.resumeId,
      wordCount: parsed.wordCount,
    });
  });
}
