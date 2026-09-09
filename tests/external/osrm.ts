/**
 * TEST EXTERNE — OSRM (temps de trajet routé). Réseau requis, aucun secret.
 *
 *   OSRM_BASE_URL=https://votre-instance npm run test:osrm
 *
 * Vérifie uniquement : connexion, calcul d'un trajet simple (Nantes → Saint-Nazaire), validation
 * de la réponse, puis intégration via le provider applicatif. Une seule requête réseau.
 * Sans OSRM_BASE_URL : NOT_CONFIGURED (l'instance publique n'est pas utilisée implicitement).
 */
import { envValue, invalidResponse, notConfigured, runExternalTest } from "./lib/harness";

const FROM = { lat: 47.2184, lng: -1.5536 }; // Nantes
const TO = { lat: 47.2736, lng: -2.2139 }; // Saint-Nazaire

void runExternalTest("OSRM", "osrm", async (ctx) => {
  const baseUrl = envValue("OSRM_BASE_URL")?.replace(/\/$/, "");
  await ctx.step("Configuration", async () => {
    if (!baseUrl) notConfigured("OSRM_BASE_URL absente (variable GitHub ou .env). L'instance publique router.project-osrm.org est un service de démonstration : héberge la tienne.");
    ctx.detail("provider", "osrm");
    ctx.detail("host", new URL(baseUrl).host);
    return `instance ${new URL(baseUrl).host}`;
  });

  const { HeuristicTravelTimeProvider, OsrmTravelTimeProvider } = await import("../../src/lib/geo/travel-time");
  const heuristic = await new HeuristicTravelTimeProvider().estimate(FROM, TO, "driving");
  ctx.detail("heuristicMinutes", heuristic.minutes);

  await ctx.step("Connexion et trajet simple (route/v1/driving)", async () => {
    const url = `${baseUrl}/route/v1/driving/${FROM.lng},${FROM.lat};${TO.lng},${TO.lat}?overview=false`;
    const t0 = Date.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { accept: "application/json" } });
    ctx.detail("latencyMs", Date.now() - t0);
    ctx.detail("httpStatus", res.status);
    if (res.status === 429) throw Object.assign(new Error("Limite de débit OSRM (429)"), { code: "RATE_LIMITED" });
    if (!res.ok) throw Object.assign(new Error(`Réponse HTTP ${res.status}`), { code: res.status >= 500 ? "SERVER" : "BAD_REQUEST" });
    const body = (await res.json().catch(() => null)) as { code?: string; routes?: Array<{ duration?: number; distance?: number }> } | null;
    if (!body || body.code !== "Ok") invalidResponse(`Réponse OSRM inattendue (code ${body?.code ?? "?"})`);
    const route = body.routes?.[0];
    if (!route || typeof route.duration !== "number" || typeof route.distance !== "number" || route.distance <= 0) invalidResponse("Itinéraire absent ou sans durée / distance numériques");
    ctx.detail("routedKm", Math.round(route.distance / 100) / 10);
    ctx.detail("routedMinutes", Math.round(route.duration / 60));
    return `${(route.distance / 1000).toFixed(1)} km par la route, ${Math.round(route.duration / 60)} min (heuristique : ${heuristic.distanceKm.toFixed(1)} km à vol d'oiseau, ${heuristic.minutes} min)`;
  });

  await ctx.step("Intégration via OsrmTravelTimeProvider", async () => {
    const result = await new OsrmTravelTimeProvider(baseUrl!).estimate(FROM, TO, "driving");
    if (!result || result.quality !== "routed") invalidResponse("Le provider applicatif n'a pas renvoyé de trajet routé");
    if (Math.abs(result.minutes - heuristic.minutes) > 30) ctx.warn("Écart important entre heuristique et OSRM : l'heuristique n'est qu'un ordre de grandeur.");
    if (process.env["TRAVEL_TIME_PROVIDER"] !== "osrm") ctx.warn("TRAVEL_TIME_PROVIDER n'est pas « osrm » : l'application affiche des temps estimés.");
    return `qualité « ${result.quality} », ${result.minutes} min`;
  });
});
