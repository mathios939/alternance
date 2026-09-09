import { getEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { AnthropicProvider } from "./providers/anthropic";
import { MockProvider } from "./providers/mock";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { AI_UNAVAILABLE_MESSAGE, UnavailableAIProvider } from "./providers/unavailable";
import type { AIProvider } from "./types";

export * from "./types";
export { AI_UNAVAILABLE_MESSAGE, UnavailableAIProvider } from "./providers/unavailable";
export type { CopilotContext } from "./context-types";

const log = createLogger("ai");
let provider: AIProvider | null = null;

export type AIProviderResolution = { provider: AIProvider; mode: "real" | "mock" | "unavailable"; reason?: string };

/**
 * Sélection du fournisseur IA (Phase 21-22), sans jamais simuler à l'insu de l'utilisateur :
 *   • AI_PROVIDER=anthropic|openai avec clé → fournisseur réel ;
 *   • AI_PROVIDER=anthropic|openai sans clé → INDISPONIBLE (message explicite, quel que soit l'environnement) ;
 *   • AI_PROVIDER=mock → provider de démonstration (réponses construites par règles, toujours signalées) ;
 *   • AI_PROVIDER absent → mock en développement / test, INDISPONIBLE en production.
 */
export function resolveAIProvider(env = getEnv(), explicitlySet = process.env["AI_PROVIDER"] !== undefined && process.env["AI_PROVIDER"] !== ""): AIProviderResolution {
  if (env.AI_PROVIDER === "anthropic") {
    const p = new AnthropicProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL, env.AI_EFFORT);
    return p.isConfigured() ? { provider: p, mode: "real" } : { provider: new UnavailableAIProvider(`${AI_UNAVAILABLE_MESSAGE} (ANTHROPIC_API_KEY manquante)`), mode: "unavailable", reason: "ANTHROPIC_API_KEY manquante" };
  }
  if (env.AI_PROVIDER === "openai") {
    const p = new OpenAICompatibleProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL, env.OPENAI_BASE_URL);
    return p.isConfigured() ? { provider: p, mode: "real" } : { provider: new UnavailableAIProvider(`${AI_UNAVAILABLE_MESSAGE} (OPENAI_API_KEY manquante)`), mode: "unavailable", reason: "OPENAI_API_KEY manquante" };
  }
  if (env.AI_PROVIDER === "mock" && (explicitlySet || env.NODE_ENV !== "production")) {
    return { provider: new MockProvider(), mode: "mock", reason: explicitlySet ? "AI_PROVIDER=mock" : "AI_PROVIDER absent (mode démo hors production)" };
  }
  return { provider: new UnavailableAIProvider(`${AI_UNAVAILABLE_MESSAGE} (AI_PROVIDER absent en production)`), mode: "unavailable", reason: "AI_PROVIDER absent en production" };
}

export function getAIProvider(): AIProvider {
  if (provider) return provider;
  const resolved = resolveAIProvider();
  if (resolved.mode === "mock") log.warn(`Fournisseur IA en mode démo (${resolved.reason}) : réponses construites par règles, signalées comme telles`);
  if (resolved.mode === "unavailable") log.warn(`Fournisseur IA indisponible : ${resolved.reason}`);
  provider = resolved.provider;
  return provider;
}

export function isMockAI(): boolean {
  return getAIProvider().name === "mock";
}

/** true si aucune génération n'est possible (ni réelle ni démo). L'interface doit l'annoncer. */
export function isAIUnavailable(): boolean {
  return getAIProvider().name === "unavailable";
}

/** Réinitialise le cache (tests). */
export function resetAIProvider(): void {
  provider = null;
}
