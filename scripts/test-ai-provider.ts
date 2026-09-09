/**
 * TEST EXTERNE — fournisseur IA réel (Phase 21). Réseau + clé requis.
 *   npm run test:ai-provider
 * Vérifie : configuration, requête simple, streaming, erreur d'authentification (clé invalide),
 * timeout (AbortSignal), quota/usage (tokens), parsing de la réponse. Aucune donnée personnelle envoyée.
 */
import { EXIT, fail, heading, info, missingEnv, ok, runMain, warn } from "./lib/bootstrap";

runMain(async () => {
  const kind = process.env["AI_PROVIDER"] ?? "";
  heading("1. Configuration");
  if (kind !== "anthropic" && kind !== "openai") {
    fail(`AI_PROVIDER=« ${kind || "(vide)"} » : ce test vérifie un fournisseur réel (anthropic ou openai).`);
    info("Renseigne AI_PROVIDER=anthropic et ANTHROPIC_API_KEY (https://console.anthropic.com) ou AI_PROVIDER=openai et OPENAI_API_KEY.");
    return EXIT.NOT_CONFIGURED;
  }
  const missing = missingEnv(kind === "anthropic" ? ["ANTHROPIC_API_KEY"] : ["OPENAI_API_KEY"]);
  if (missing.length) {
    fail(`Variables manquantes : ${missing.join(", ")}`);
    return EXIT.NOT_CONFIGURED;
  }
  const { resolveAIProvider, AIProviderError } = await import("../src/lib/ai");
  const { AnthropicProvider } = await import("../src/lib/ai/providers/anthropic");
  const { OpenAICompatibleProvider } = await import("../src/lib/ai/providers/openai-compatible");
  const { getEnv } = await import("../src/lib/env");
  const env = getEnv();
  const resolved = resolveAIProvider(env, true);
  if (resolved.mode !== "real") {
    fail(`Fournisseur non réel : ${resolved.mode} (${resolved.reason ?? ""})`);
    return EXIT.NOT_CONFIGURED;
  }
  const provider = resolved.provider;
  ok(`Fournisseur ${provider.name}, modèle ${provider.model}`);

  const system = "Tu es un assistant de test. Réponds en français, en une phrase.";
  heading("2. Requête simple");
  try {
    const t0 = Date.now();
    const r = await provider.generate({ system, messages: [{ role: "user", content: "Réponds exactement : OK alternance." }], maxTokens: 50, effort: "low" });
    ok(`« ${r.text.trim().slice(0, 80)} » en ${Date.now() - t0} ms · tokens in/out : ${r.tokensIn ?? "?"}/${r.tokensOut ?? "?"} · fin : ${r.finishReason ?? "?"}`);
    if (!r.text.trim()) fail("Réponse vide");
    if (r.refused) warn("Le fournisseur a signalé un refus sur une requête anodine.");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return EXIT.FAILED;
  }

  heading("3. Streaming");
  try {
    let chunks = 0;
    let text = "";
    let done = false;
    const t0 = Date.now();
    for await (const ev of provider.stream({ system, messages: [{ role: "user", content: "Compte de 1 à 5, séparés par des virgules." }], maxTokens: 60, effort: "low" })) {
      if (ev.type === "delta") {
        chunks++;
        text += ev.text;
      } else done = true;
    }
    (chunks > 0 && done ? ok : fail)(`${chunks} fragment(s), ${text.trim().length} caractères, événement final ${done ? "reçu" : "manquant"} (${Date.now() - t0} ms)`);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return EXIT.FAILED;
  }

  heading("4. Erreur API (clé invalide)");
  const bad = kind === "anthropic" ? new AnthropicProvider("sk-ant-invalid-key-for-test", env.ANTHROPIC_MODEL, "low") : new OpenAICompatibleProvider("sk-invalid-key-for-test", env.OPENAI_MODEL, env.OPENAI_BASE_URL);
  try {
    await bad.generate({ system, messages: [{ role: "user", content: "test" }], maxTokens: 5 });
    fail("Aucune erreur levée avec une clé invalide");
  } catch (error) {
    if (error instanceof AIProviderError) ok(`Erreur typée ${error.code} : ${error.message.slice(0, 100)}`);
    else fail(`Erreur non typée : ${error instanceof Error ? error.message : String(error)}`);
  }

  heading("5. Timeout (annulation après 1 ms)");
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 1);
  try {
    await provider.generate({ system, messages: [{ role: "user", content: "Écris un long texte." }], maxTokens: 400, signal: controller.signal });
    warn("La requête s'est terminée malgré l'annulation (réponse en cache ou signal ignoré).");
  } catch (error) {
    ok(`Annulation gérée : ${error instanceof Error ? error.name : "erreur"}`);
  }

  heading("Résultat");
  ok(`Le fournisseur ${provider.name} fonctionne : requête, streaming, erreurs et annulation.`);
  info("Les quotas dépendent de ton compte fournisseur : surveille les codes RATE_LIMITED dans les logs.");
  return EXIT.OK;
});
