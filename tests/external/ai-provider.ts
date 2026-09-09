/**
 * TEST EXTERNE — fournisseur IA réel (Anthropic ou API compatible OpenAI). Réseau + clé requis.
 *
 *   AI_PROVIDER=anthropic ANTHROPIC_API_KEY=… npm run test:ai-provider
 *   AI_PROVIDER=openai    OPENAI_API_KEY=…    npm run test:ai-provider
 *
 * Volontairement minuscule (deux requêtes de ~20 jetons) : requête simple, streaming,
 * clé invalide (erreur typée, sans coût), annulation par AbortSignal (sans réseau).
 * Aucune donnée utilisateur. Le MockProvider n'est jamais utilisé ici.
 */
import { envValue, invalidResponse, notConfigured, runExternalTest } from "./lib/harness";

const SYSTEM = "Tu es un assistant de test automatisé. Réponds en français, en moins de dix mots.";

void runExternalTest("Fournisseur IA", "ai-provider", async (ctx) => {
  const anthropicKey = envValue("ANTHROPIC_API_KEY");
  const openaiKey = envValue("OPENAI_API_KEY");
  const kind = envValue("AI_PROVIDER") ?? (anthropicKey ? "anthropic" : openaiKey ? "openai" : undefined);

  await ctx.step("Configuration", async () => {
    if (kind !== "anthropic" && kind !== "openai") notConfigured(`AI_PROVIDER=« ${kind ?? ""} » : ce test exige un fournisseur réel (anthropic ou openai), jamais le mock.`);
    if (kind === "anthropic" && !anthropicKey) notConfigured("ANTHROPIC_API_KEY absente (https://console.anthropic.com)");
    if (kind === "openai" && !openaiKey) notConfigured("OPENAI_API_KEY absente");
    return `${kind} (clé présente, valeur masquée)`;
  });

  const { AnthropicProvider } = await import("../../src/lib/ai/providers/anthropic");
  const { OpenAICompatibleProvider } = await import("../../src/lib/ai/providers/openai-compatible");
  const { AIProviderError } = await import("../../src/lib/ai/types");
  const model = kind === "anthropic" ? (envValue("ANTHROPIC_MODEL") ?? "claude-opus-5") : (envValue("OPENAI_MODEL") ?? "gpt-4.1");
  const provider = kind === "anthropic" ? new AnthropicProvider(anthropicKey, model, "low") : new OpenAICompatibleProvider(openaiKey, model, envValue("OPENAI_BASE_URL"));
  ctx.detail("provider", provider.name);
  ctx.detail("model", model);

  await ctx.step("Requête simple (≤ 24 jetons)", async () => {
    const t0 = Date.now();
    const r = await provider.generate({ system: SYSTEM, messages: [{ role: "user", content: "Réponds exactement : OK alternance." }], maxTokens: 24, effort: "low", signal: AbortSignal.timeout(60_000) });
    ctx.detail("latencyMs", Date.now() - t0);
    ctx.detail("tokensIn", r.tokensIn ?? null);
    ctx.detail("tokensOut", r.tokensOut ?? null);
    if (!r.text.trim()) invalidResponse("Réponse vide du fournisseur");
    if (r.refused) ctx.warn("Le fournisseur a signalé un refus sur une requête anodine.");
    return `« ${r.text.trim().slice(0, 60)} » · fin : ${r.finishReason ?? "?"}`;
  });

  await ctx.step("Streaming (≤ 24 jetons)", async () => {
    let chunks = 0;
    let text = "";
    let done = false;
    const t0 = Date.now();
    for await (const ev of provider.stream({ system: SYSTEM, messages: [{ role: "user", content: "Compte de 1 à 3, séparés par des virgules." }], maxTokens: 24, effort: "low", signal: AbortSignal.timeout(60_000) })) {
      if (ev.type === "delta") {
        chunks++;
        text += ev.text;
      } else done = true;
    }
    ctx.detail("streamChunks", chunks);
    if (chunks === 0 || !done) invalidResponse(`Flux incomplet : ${chunks} fragment(s), événement final ${done ? "reçu" : "manquant"}`);
    return `${chunks} fragment(s), ${text.trim().length} caractères, ${Date.now() - t0} ms`;
  });

  await ctx.step("Erreur d'authentification (clé invalide, sans coût)", async () => {
    const bad = kind === "anthropic" ? new AnthropicProvider("sk-ant-invalid-key-for-test", model, "low") : new OpenAICompatibleProvider("sk-invalid-key-for-test", model, envValue("OPENAI_BASE_URL"));
    try {
      await bad.generate({ system: SYSTEM, messages: [{ role: "user", content: "test" }], maxTokens: 5, signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      if (error instanceof AIProviderError && error.code === "UNAUTHENTICATED") return `erreur typée ${error.code}`;
      if (error instanceof AIProviderError) return `erreur typée ${error.code} (attendu UNAUTHENTICATED)`;
      throw Object.assign(new Error(`Erreur non typée : ${error instanceof Error ? error.message : String(error)}`), { code: "PARSE" });
    }
    invalidResponse("Aucune erreur levée avec une clé invalide");
  });

  await ctx.step("Annulation (AbortSignal déjà annulé, aucun appel réseau)", async () => {
    const controller = new AbortController();
    controller.abort();
    try {
      await provider.generate({ system: SYSTEM, messages: [{ role: "user", content: "test" }], maxTokens: 5, signal: controller.signal });
    } catch (error) {
      return `annulation propagée (${error instanceof Error ? error.name : "erreur"})`;
    }
    ctx.warn("La requête s'est terminée malgré un signal annulé : le fournisseur ignore AbortSignal.");
  });
});
