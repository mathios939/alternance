"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FavoriteCollection } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/lib/action";
import { trackActivity } from "@/features/activity/server/track";

const toggleSchema = z
  .object({
    jobId: z.string().min(1).optional(),
    companyId: z.string().min(1).optional(),
    collection: z.enum(FavoriteCollection).optional(),
  })
  .refine((v) => Boolean(v.jobId) !== Boolean(v.companyId), "Précise une offre ou une entreprise");

export type ToggleFavoriteInput = z.input<typeof toggleSchema>;

/** Ajoute ou retire un favori. Retourne l'état final. */
export async function toggleFavorite(input: ToggleFavoriteInput): Promise<ActionResult<{ saved: boolean; collection: FavoriteCollection | null }>> {
  return runAction("toggleFavorite", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(toggleSchema, input);
    if (!parsed.ok) return parsed.result;
    const { jobId, companyId } = parsed.data;
    const collection = parsed.data.collection ?? (companyId ? "COMPANIES" : "TO_APPLY");

    const existing = await prisma.favorite.findFirst({ where: { userId, jobId: jobId ?? null, companyId: companyId ?? null } });
    if (existing) {
      if (parsed.data.collection && existing.collection !== parsed.data.collection) {
        await prisma.favorite.update({ where: { id: existing.id }, data: { collection: parsed.data.collection } });
        revalidatePath("/favorites");
        return ok({ saved: true, collection: parsed.data.collection });
      }
      await prisma.favorite.delete({ where: { id: existing.id } });
      revalidatePath("/favorites");
      return ok({ saved: false, collection: null });
    }
    if (jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, title: true, companyId: true } });
      if (!job) return fail("Offre introuvable.");
      await prisma.favorite.create({ data: { userId, jobId, collection } });
      await trackActivity({ userId, type: "JOB_SAVED", title: `Offre sauvegardée : ${job.title}`, jobId, companyId: job.companyId });
    } else if (companyId) {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
      if (!company) return fail("Entreprise introuvable.");
      await prisma.favorite.create({ data: { userId, companyId, collection } });
      await trackActivity({ userId, type: "JOB_SAVED", title: `Entreprise sauvegardée : ${company.name}`, companyId });
    }
    revalidatePath("/favorites");
    return ok({ saved: true, collection });
  });
}

export async function updateFavoriteNote(favoriteId: string, note: string): Promise<ActionResult> {
  return runAction("updateFavoriteNote", async () => {
    const userId = await requireUserId();
    const fav = await prisma.favorite.findFirst({ where: { id: favoriteId, userId } });
    if (!fav) return fail("Favori introuvable.");
    await prisma.favorite.update({ where: { id: favoriteId }, data: { note: note.slice(0, 500) || null } });
    revalidatePath("/favorites");
    return ok(undefined);
  });
}
