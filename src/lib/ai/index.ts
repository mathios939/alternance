import { getEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { AnthropicProvider } from "./providers/anthropic";
import { MockProvider } from "./providers/mock";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import type { AIProvider } from "./types";

export * from "./types";
export type { CopilotContext } from "./context-types";

const log = createLogger("ai");
let provider: AIProvider | null = null;

/**
 * Sélectionne le fournisseur IA d'après AI_PROVIDER.
 * Sans clé valide, bascule sur le provider mock (jamais d'erreur bloquante).
 */
export function getAIProvider(): AIProvider {
  if (provider) return provider;
  const env = getEnv();
  let chosen: AIProvider;
  if (env.AI_PROVIDER === "anthropic") chosen = new AnthropicProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL, env.AI_EFFORT);
  else if (env.AI_PROVIDER === "openai") chosen = new OpenAICompatibleProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL, env.OPENAI_BASE_URL);
  else chosen = new MockProvider();
  if (!chosen.isConfigured()) {
    log.warn(`Fournisseur IA « ${chosen.name} » non configuré : bascule en mode démo (mock)`);
    chosen = new MockProvider();
  }
  provider = chosen;
  return provider;
}

export function isMockAI(): boolean {
  return getAIProvider().name === "mock";
}
