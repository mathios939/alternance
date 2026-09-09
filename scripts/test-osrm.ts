/**
 * TEST EXTERNE — OSRM (temps de trajet routé, sans secret, réseau requis).
 *   npm run test:osrm
 * Distingue explicitement distance à vol d'oiseau (heuristique) et temps de trajet routé (OSRM).
 * L'instance publique router.project-osrm.org est un service de démonstration sans garantie :
 * en production, héberger sa propre instance (OSRM_BASE_URL).
 */
import { EXIT, fail, heading, info, ok, runMain, warn } from "./lib/bootstrap";

runMain(async () => {
  const { HeuristicTravelTimeProvider, OsrmTravelTimeProvider } = await import("../src/lib/geo/travel-time");
  const from = { lat: 47.2184, lng: -1.5536 }; // Nantes
  const to = { lat: 47.2736, lng: -2.2139 }; // Saint-Nazaire
  heading("1. Heuristique (toujours disponible, vol d'oiseau + vitesse moyenne)");
  const h = await new HeuristicTravelTimeProvider().estimate(from, to, "driving");
  ok(`${h.distanceKm.toFixed(1)} km à vol d'oiseau → ≈ ${h.minutes} min (qualité « estimated »)`);

  heading(`2. OSRM (${process.env["OSRM_BASE_URL"] ?? "https://router.project-osrm.org"})`);
  const osrm = new OsrmTravelTimeProvider(process.env["OSRM_BASE_URL"] ?? "https://router.project-osrm.org");
  const t0 = Date.now();
  const r = await osrm.estimate(from, to, "driving");
  if (!r) {
    fail(`OSRM injoignable ou sans itinéraire (${Date.now() - t0} ms) : le produit retombe sur l'heuristique et l'indique (« estimé »).`);
    info("Causes fréquentes : réseau bloqué, instance publique saturée. Héberge une instance et renseigne OSRM_BASE_URL.");
    return EXIT.FAILED;
  }
  ok(`${r.distanceKm.toFixed(1)} km par la route → ${r.minutes} min (qualité « routed », ${Date.now() - t0} ms)`);
  if (Math.abs(r.minutes - h.minutes) > 30) warn("Écart important entre heuristique et OSRM : l'heuristique n'est qu'un ordre de grandeur.");
  if (process.env["TRAVEL_TIME_PROVIDER"] !== "osrm") warn("TRAVEL_TIME_PROVIDER n'est pas « osrm » : l'application utilise l'heuristique.");
  return EXIT.OK;
});
