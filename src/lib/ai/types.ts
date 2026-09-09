/**
 * Couche d'abstraction IA.
 * L'application ne dépend jamais directement d'un fournisseur : elle parle à AIProvider.
 */
export type AIChatMessage = { role: "user" | "assistant"; content: string };

export type AIGenerateOptions = {
  system: string;
  messages: AIChatMessage[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  /** Métadonnées structurées, ignorées par les vrais fournisseurs, utilisées par le provider mock. */
  meta?: { kind?: string; context?: unknown; userInput?: string };
  signal?: AbortSignal;
};

export type AIResult = {
  text: string;
  provider: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  finishReason?: string;
  /** true si le fournisseur a refusé la requête (classifieur de sécurité). */
  refused?: boolean;
};

export type AIStreamEvent = { type: "delta"; text: string } | { type: "done"; result: AIResult };

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** Indique si le fournisseur est réellement utilisable (clé présente…). */
  isConfigured(): boolean;
  generate(options: AIGenerateOptions): Promise<AIResult>;
  stream(options: AIGenerateOptions): AsyncGenerator<AIStreamEvent, void, undefined>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHENTICATED" | "RATE_LIMITED" | "UNAVAILABLE" | "BAD_REQUEST" | "UNKNOWN",
    public readonly provider: string,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
