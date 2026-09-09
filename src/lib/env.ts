import { z } from "zod";

/**
 * Validation des variables d'environnement serveur.
 * Toutes les clés externes sont optionnelles : l'application doit fonctionner
 * sans aucune clé (mode démo), avec des fallbacks propres.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET doit contenir au moins 16 caractères"),
  BETTER_AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default("common"),
  AI_PROVIDER: z.enum(["anthropic", "openai", "mock"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5"),
  AI_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1"),
  OPENAI_BASE_URL: z.string().optional(),
  TRAVEL_TIME_PROVIDER: z.enum(["none", "osrm", "mapbox"]).default("none"),
  OSRM_BASE_URL: z.string().default("https://router.project-osrm.org"),
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().optional(),
  FRANCE_TRAVAIL_CLIENT_ID: z.string().optional(),
  FRANCE_TRAVAIL_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Alternance OS <no-reply@example.com>"),
  ADMIN_EMAILS: z.string().default(""),
});

export type ServerEnv = z.infer<typeof serverSchema>;

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const raw = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, emptyToUndefined(v)]));
  const parsed = serverSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variables d'environnement invalides :\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function getAdminEmails(): string[] {
  return getEnv()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

/** Fournisseurs sociaux réellement configurés (affichés côté client). */
export function getEnabledSocialProviders(): { google: boolean; microsoft: boolean } {
  const env = getEnv();
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    microsoft: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
  };
}
