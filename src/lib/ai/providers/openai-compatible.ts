import { createLogger } from "@/lib/logger";
import { AIProviderError, type AIGenerateOptions, type AIProvider, type AIResult, type AIStreamEvent } from "../types";

const log = createLogger("ai:openai");

type ChatCompletion = { model?: string; choices?: Array<{ message?: { content?: string }; finish_reason?: string }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };

/**
 * Fournisseur compatible avec l'API OpenAI « chat/completions ».
 * Fonctionne avec OpenAI, Mistral, Groq, Ollama… via OPENAI_BASE_URL.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string | undefined,
    readonly model: string,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async request(options: AIGenerateOptions, stream: boolean): Promise<Response> {
    if (!this.apiKey) throw new AIProviderError("OPENAI_API_KEY manquante.", "UNAUTHENTICATED", this.name);
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens ?? 4096,
        stream,
        messages: [{ role: "system", content: options.system }, ...options.messages],
      }),
      // Timeout systématique (120 s) combiné au signal de l'appelant : jamais d'appel bloquant indéfiniment.
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
    }).catch((error: unknown) => {
      if ((error as Error | null)?.name === "AbortError") throw error;
      throw new AIProviderError((error as Error | null)?.name === "TimeoutError" ? "Le service IA n'a pas répondu à temps." : "Le service IA est injoignable.", "UNAVAILABLE", this.name);
    });
    if (res.status === 401) throw new AIProviderError("Clé API invalide.", "UNAUTHENTICATED", this.name);
    if (res.status === 429) throw new AIProviderError("Limite de requêtes IA atteinte.", "RATE_LIMITED", this.name);
    if (!res.ok) {
      log.error("Réponse OpenAI-compatible en erreur", undefined, { status: res.status });
      throw new AIProviderError(`Erreur du service IA (${res.status}).`, res.status >= 500 ? "UNAVAILABLE" : "BAD_REQUEST", this.name);
    }
    return res;
  }

  async generate(options: AIGenerateOptions): Promise<AIResult> {
    const res = await this.request(options, false);
    const data = (await res.json()) as ChatCompletion;
    const choice = data.choices?.[0];
    return {
      text: choice?.message?.content?.trim() ?? "",
      provider: this.name,
      model: data.model ?? this.model,
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
      finishReason: choice?.finish_reason,
    };
  }

  async *stream(options: AIGenerateOptions): AsyncGenerator<AIStreamEvent, void, undefined> {
    const res = await this.request(options, true);
    if (!res.body) throw new AIProviderError("Flux vide.", "UNAVAILABLE", this.name);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let model = this.model;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as { model?: string; choices?: Array<{ delta?: { content?: string } }> };
          if (json.model) model = json.model;
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            text += delta;
            yield { type: "delta", text: delta };
          }
        } catch {
          // ligne partielle ignorée
        }
      }
    }
    yield { type: "done", result: { text: text.trim(), provider: this.name, model } };
  }
}
