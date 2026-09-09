export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

/** Distance à vol d'oiseau (formule de Haversine), en kilomètres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Boîte englobante approximative pour pré-filtrer en SQL avant le calcul exact. */
export function boundingBox(center: LatLng, radiusKm: number): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** Estimation grossière du temps de trajet en voiture (sans API) : ~ 35 km/h en ville, route sinueuse x1.3. */
export function estimateDrivingMinutes(distanceKm: number): number {
  const roadKm = distanceKm * 1.3;
  const speed = roadKm < 15 ? 30 : roadKm < 50 ? 55 : 80;
  return Math.round((roadKm / speed) * 60) + 3;
}

export function estimateTransitMinutes(distanceKm: number): number {
  return Math.round(estimateDrivingMinutes(distanceKm) * 1.6 + 8);
}

export function hasCoordinates<T extends { latitude?: number | null; longitude?: number | null }>(
  entity: T,
): entity is T & { latitude: number; longitude: number } {
  return typeof entity.latitude === "number" && typeof entity.longitude === "number";
}

export function toLatLng(entity: { latitude?: number | null; longitude?: number | null }): LatLng | null {
  return hasCoordinates(entity) ? { lat: entity.latitude, lng: entity.longitude } : null;
}
