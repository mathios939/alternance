"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * FAVORIS SANS COMPTE : offres et entreprises sauvegardées dans ce navigateur uniquement (localStorage).
 * À la création du compte, l'utilisateur peut les importer dans ses favoris (importGuestFavorites).
 */
export const GUEST_FAVORITES_STORAGE_KEY = "aos.guest-favorites";
const EVENT = "aos:guest-favorites";
const MAX_PER_KIND = 100;

export type GuestFavorites = { jobs: string[]; companies: string[] };
const EMPTY: GuestFavorites = { jobs: [], companies: [] };

let cachedRaw: string | null = null;
let cached: GuestFavorites = EMPTY;

function sanitize(value: unknown): GuestFavorites {
  const obj = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof GuestFavorites, unknown>>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 64).slice(0, MAX_PER_KIND) : []);
  return { jobs: list(obj.jobs), companies: list(obj.companies) };
}

export function readGuestFavorites(): GuestFavorites {
  try {
    const raw = localStorage.getItem(GUEST_FAVORITES_STORAGE_KEY);
    if (raw === cachedRaw) return cached;
    cachedRaw = raw;
    cached = raw ? sanitize(JSON.parse(raw)) : EMPTY;
    return cached;
  } catch {
    return EMPTY;
  }
}

function write(next: GuestFavorites) {
  try {
    if (next.jobs.length === 0 && next.companies.length === 0) localStorage.removeItem(GUEST_FAVORITES_STORAGE_KEY);
    else localStorage.setItem(GUEST_FAVORITES_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function clearGuestFavorites(): void {
  write(EMPTY);
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function toggle(kind: keyof GuestFavorites, id: string): { saved: boolean } {
  const current = readGuestFavorites();
  const list = current[kind];
  if (list.includes(id)) {
    write({ ...current, [kind]: list.filter((x) => x !== id) });
    return { saved: false };
  }
  write({ ...current, [kind]: [id, ...list].slice(0, MAX_PER_KIND) });
  return { saved: true };
}

export function useGuestFavorites() {
  const favorites = useSyncExternalStore(subscribe, readGuestFavorites, () => EMPTY);
  const toggleJob = useCallback((id: string) => toggle("jobs", id), []);
  const toggleCompany = useCallback((id: string) => toggle("companies", id), []);
  const clear = useCallback(() => clearGuestFavorites(), []);
  return {
    jobs: favorites.jobs,
    companies: favorites.companies,
    count: favorites.jobs.length + favorites.companies.length,
    hasJob: (id: string) => favorites.jobs.includes(id),
    hasCompany: (id: string) => favorites.companies.includes(id),
    toggleJob,
    toggleCompany,
    clear,
  };
}
