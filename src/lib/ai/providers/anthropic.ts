import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@/lib/logger";
import { AIProviderError, type AIGenerateOptions, type AIProvider, type AIResult, type AIStreamEvent } from "../types";

const log = createLogger("ai:anthropic");

function mapError(error: unknown): AIProviderError {
  if (error instanceof Anthropic.AuthenticationError) return new AIProviderError("Clé API Anthropic invalide.", "UNAUTHENTICATED", "anthropic");
  if (error instanceof Anthropic.RateLimitError) return new AIProviderError("Limite de requêtes IA atteinte, réessaie dans un instant.", "RATE_LIMITED", "anthropic");
  if (error instanceof Anthropic.BadRequestError) return new AIProviderError(`Requête IA invalide : ${error.message}`, "BAD_REQUEST", "anthropic");
  if (error instanceof Anthropic.APIConnectionError) return new AIProviderError("Le service IA est injoignable.", "UNAVAILABLE", "anthropic");
  if (error instanceof Anthropic.APIError) return new AIProviderError(`Erreur du service IA (${error.status}).`, error.status && error.status >= 500 ? "UNAVAILABLE" : "UNKNOWN", "anthropic");
  return new AIProviderError("Erreur IA inattendue.", "UNKNOWN", "anthropic");
}

/** Fournisseur Anthropic (Claude) via le SDK officiel. */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;

  constructor(
    private readonly apiKey: string | undefined,
    readonly model: string,
    private readonly effort: "low" | "medium" | "high" = "medium",
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private getClient(): Anthropic {
    if (!this.apiKey) throw new AIProviderError("ANTHROPIC_API_KEY manquante.", "UNAUTHENTICATED", this.name);
    this.client ??= new Anthropic({ apiKey: this.apiKey, maxRetries: 2, timeout: 120_000 });
    return this.client;
  }

  private params(options: AIGenerateOptions) {
    return {
      model: this.model,
      max_tokens: options.maxTokens ?? 4096,
      system: options.system,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      output_config: { effort: options.effort ?? this.effort },
    };
  }

  async generate(options: AIGenerateOptions): Promise<AIResult> {
    try {
      const response = await this.getClient().messages.create(this.params(options), { signal: options.signal });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        text,
        provider: this.name,
        model: response.model,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
        finishReason: response.stop_reason ?? undefined,
        refused: response.stop_reason === "refusal",
      };
    } catch (error) {
      log.error("Génération Anthropic échouée", error);
      throw mapError(error);
    }
  }

  async *stream(options: AIGenerateOptions): AsyncGenerator<AIStreamEvent, void, undefined> {
    try {
      const stream = this.getClient().messages.stream(this.params(options), { signal: options.signal });
      let text = "";
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          text += event.delta.text;
          yield { type: "delta", text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      yield {
        type: "done",
        result: {
          text: text.trim(),
          provider: this.name,
          model: final.model,
          tokensIn: final.usage.input_tokens,
          tokensOut: final.usage.output_tokens,
          finishReason: final.stop_reason ?? undefined,
          refused: final.stop_reason === "refusal",
        },
      };
    } catch (error) {
      log.error("Streaming Anthropic échoué", error);
      throw mapError(error);
    }
  }
}
