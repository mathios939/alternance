import type { AIGenerateOptions, AIProvider, AIResult, AIStreamEvent } from "../types";
import { AIProviderError } from "../types";

export const AI_UNAVAILABLE_MESSAGE = "Fonctionnalité IA indisponible : provider non configuré.";

/**
 * Fournisseur « indisponible » (Phase 22) : utilisé quand aucune configuration réelle n'existe.
 * Il ne produit jamais de texte et n'imite jamais un modèle : chaque appel échoue avec un message clair.
 */
export class UnavailableAIProvider implements AIProvider {
  readonly name = "unavailable";
  readonly model = "none";

  constructor(private readonly reason: string = AI_UNAVAILABLE_MESSAGE) {}

  isConfigured(): boolean {
    return false;
  }

  async generate(_options: AIGenerateOptions): Promise<AIResult> {
    throw new AIProviderError(this.reason, "UNAVAILABLE", this.name);
  }

  async *stream(_options: AIGenerateOptions): AsyncGenerator<AIStreamEvent, void, undefined> {
    throw new AIProviderError(this.reason, "UNAVAILABLE", this.name);
  }
}
