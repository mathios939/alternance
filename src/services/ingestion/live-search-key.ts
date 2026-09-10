import { CITIES, findCity } from "@/config/cities";
import { findDepartmentByCode } from "@/config/departments";
import { normalizeText } from "@/lib/text/normalize";

/** Clé de recherche live (module pur, sans base). */
export type LiveSearchTarget = {
  key: string;
  city?: string;
  inseeCode?: string;
  radiusKm?: number;
  department?: string;
  departmentName?: string;
  keywords?: string;
  label: string;
};

/**
 * Clé normalisée d'une recherche rafraîchissable : ville connue (+ rayon) ou département, mots-clés
 * optionnels. `null` quand la recherche n'a pas de zone exploitable (recherche nationale par mots-clés
 * : trop large pour une requête live utile).
 */
export function liveSearchTarget(filters: {
  q?: string;
  city?: string;
  radius?: number;
  department?: string;
}): LiveSearchTarget | null {
  const keywords = normalizeText(filters.q ?? "").slice(0, 60) || undefined;
  const city = filters.city ? findCity(filters.city) : undefined;
  if (city?.inseeCode) {
    const radiusKm = filters.radius ?? 15;
    return {
      key: `city:${city.inseeCode}:${radiusKm}${keywords ? `:${keywords}` : ""}`,
      city: city.name,
      inseeCode: city.inseeCode,
      radiusKm,
      department: city.departmentCode,
      departmentName: city.department,
      keywords,
      label: `${city.name} (${radiusKm} km)${keywords ? ` · ${keywords}` : ""}`,
    };
  }
  const dep = filters.department ? findDepartmentByCode(filters.department) : undefined;
  if (dep)
    return {
      key: `dep:${dep.code}${keywords ? `:${keywords}` : ""}`,
      department: dep.code,
      departmentName: dep.name,
      keywords,
      label: `${dep.name}${keywords ? ` · ${keywords}` : ""}`,
    };
  return null;
}

/** Reconstruit une cible à partir de sa clé (« city:44109:30:developpeur » ou « dep:44:cyber »). */
export function parseLiveKey(key: string): LiveSearchTarget | null {
  const parts = key.split(":");
  if (parts[0] === "city" && parts[1]) {
    const city = CITIES.find((c) => c.inseeCode === parts[1]);
    const radius = Number(parts[2]);
    const keywords = parts.slice(3).join(":") || undefined;
    if (!city) return null;
    return liveSearchTarget({
      city: city.name,
      radius: Number.isFinite(radius) ? radius : undefined,
      q: keywords,
    });
  }
  if (parts[0] === "dep" && parts[1])
    return liveSearchTarget({ department: parts[1], q: parts.slice(2).join(":") || undefined });
  return null;
}
