import { estimateDrivingMinutes, estimateTransitMinutes, haversineKm, type LatLng } from "@/lib/geo";
import { createLogger } from "@/lib/logger";

const log = createLogger("travel-time");

export type TravelMode = "driving" | "transit" | "cycling";

export type TravelEstimate = {
  minutes: number;
  distanceKm: number;
  mode: TravelMode;
  /** "estimated" = sans API (à vol d'oiseau), "routed" = via un fournisseur d'itinéraire. */
  quality: "estimated" | "routed";
  provider: string;
};

/** Abstraction : tout fournisseur d'itinéraire (OSRM, Mapbox, Google) implémente cette interface. */
export interface TravelTimeProvider {
  readonly name: string;
  estimate(from: LatLng, to: LatLng, mode: TravelMode): Promise<TravelEstimate | null>;
}

/** Fallback sans réseau : distance à vol d'oiseau + vitesse moyenne. Toujours disponible. */
export class HeuristicTravelTimeProvider implements TravelTimeProvider {
  readonly name = "heuristic";
  async estimate(from: LatLng, to: LatLng, mode: TravelMode): Promise<TravelEstimate> {
    const distanceKm = haversineKm(from, to);
    const minutes =
      mode === "transit"
        ? estimateTransitMinutes(distanceKm)
        : mode === "cycling"
          ? Math.round((distanceKm * 1.2) / 15 * 60) + 2
          : estimateDrivingMinutes(distanceKm);
    return { minutes, distanceKm, mode, quality: "estimated", provider: this.name };
  }
}

/** OSRM (open source). Utilise l'instance publique par défaut — à héberger en production. */
export class OsrmTravelTimeProvider implements TravelTimeProvider {
  readonly name = "osrm";
  constructor(private readonly baseUrl: string) {}

  async estimate(from: LatLng, to: LatLng, mode: TravelMode): Promise<TravelEstimate | null> {
    const profile = mode === "cycling" ? "bike" : "car";
    const url = `${this.baseUrl}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    try {
      const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
      if (!res.ok) return null;
      const data = (await res.json()) as { routes?: Array<{ duration: number; distance: number }> };
      const route = data.routes?.[0];
      if (!route) return null;
      const minutes = Math.round(route.duration / 60) * (mode === "transit" ? 1.6 : 1);
      return { minutes, distanceKm: route.distance / 1000, mode, quality: "routed", provider: this.name };
    } catch (error) {
      log.warn("OSRM indisponible, fallback heuristique", { error: String(error) });
      return null;
    }
  }
}

let provider: TravelTimeProvider | null = null;

export function getTravelTimeProvider(): TravelTimeProvider {
  if (provider) return provider;
  const kind = process.env["TRAVEL_TIME_PROVIDER"] ?? "none";
  if (kind === "osrm") {
    provider = new OsrmTravelTimeProvider(process.env["OSRM_BASE_URL"] ?? "https://router.project-osrm.org");
  } else {
    provider = new HeuristicTravelTimeProvider();
  }
  return provider;
}

const heuristic = new HeuristicTravelTimeProvider();

/** Estime un trajet avec le fournisseur configuré, et retombe sur l'heuristique en cas d'échec. */
export async function estimateTravel(from: LatLng, to: LatLng, mode: TravelMode = "driving"): Promise<TravelEstimate> {
  const result = await getTravelTimeProvider().estimate(from, to, mode);
  return result ?? (await heuristic.estimate(from, to, mode));
}
