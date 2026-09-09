import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { getAdminEmails, getEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth");
const env = getEnv();
const adminEmails = getAdminEmails();

const socialProviders: NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]> = {};

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}
if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
  socialProviders.microsoft = {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    tenantId: env.MICROSOFT_TENANT_ID,
  };
}

export const auth = betterAuth({
  appName: "Alternance OS",
  baseURL: env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  socialProviders,
  user: {
    additionalFields: {
      role: { type: "string", required: false, input: false },
      plan: { type: "string", required: false, input: false },
      onboardingCompletedAt: { type: "date", required: false, input: false },
      termsAcceptedAt: { type: "date", required: false, input: false },
      privacyAcceptedAt: { type: "date", required: false, input: false },
    },
    deleteUser: { enabled: true },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 40,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  advanced: {
    database: { generateId: false },
    cookiePrefix: "aos",
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email.toLowerCase();
          const role = adminEmails.includes(email) ? "ADMIN" : "USER";
          const now = new Date();
          return { data: { ...user, email, role, termsAcceptedAt: now, privacyAcceptedAt: now } };
        },
        after: async (user) => {
          log.info("Nouvel utilisateur", { userId: user.id });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
