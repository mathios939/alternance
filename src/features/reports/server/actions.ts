"use server";

import { z } from "zod";
import { ReportReason } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { assertRateLimit } from "@/lib/rate-limit";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/lib/action";

const schema = z
  .object({
    reason: z.enum(ReportReason),
    details: z.string().trim().max(1000).optional(),
    jobId: z.string().optional(),
    companyId: z.string().optional(),
    contactId: z.string().optional(),
  })
  .refine((v) => v.jobId || v.companyId || v.contactId, "Cible manquante");

export type ReportInput = z.input<typeof schema>;

export async function createReport(input: ReportInput): Promise<ActionResult> {
  return runAction("createReport", async () => {
    const session = await getSession();
    const parsed = parseInput(schema, input);
    if (!parsed.ok) return parsed.result;
    await assertRateLimit("report", session?.id ?? "anonymous", { limit: 10, windowMs: 60 * 60_000 });
    const { reason, details, jobId, companyId, contactId } = parsed.data;
    const duplicate = await prisma.report.findFirst({ where: { userId: session?.id ?? null, reason, jobId: jobId ?? null, companyId: companyId ?? null, contactId: contactId ?? null, status: "OPEN" } });
    if (duplicate) return fail("Tu as déjà signalé cet élément. Merci !");
    await prisma.report.create({ data: { userId: session?.id ?? null, reason, details: details || null, jobId: jobId ?? null, companyId: companyId ?? null, contactId: contactId ?? null } });
    return ok(undefined);
  });
}
