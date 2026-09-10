"use client";

import { useCallback, useSyncExternalStore } from "react";
import { GUEST_PROFILE_COOKIE, GUEST_PROFILE_MAX_AGE_SECONDS, GUEST_PROFILE_STORAGE_KEY, decodeCookieValue, parseGuestProfile, serializeGuestProfile, type GuestProfile } from "./profile";

const EVENT = "aos:guest-profile";

let cachedRaw: string | null = null;
let cachedProfile: GuestProfile | null = null;

function readCookie(): string | null {
  const prefix = `${GUEST_PROFILE_COOKIE}=`;
  const entry = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  return entry ? decodeCookieValue(entry.slice(prefix.length)) : null;
}

/** Lecture côté navigateur : cookie d'abord (source lue par le serveur), localStorage en secours. */
export function readGuestProfile(): GuestProfile | null {
  try {
    let raw = readCookie();
    if (!raw) raw = localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
    if (raw === cachedRaw) return cachedProfile;
    cachedRaw = raw;
    cachedProfile = parseGuestProfile(raw);
    return cachedProfile;
  } catch {
    return null;
  }
}

function writeCookie(value: string | null) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = value === null ? `${GUEST_PROFILE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}` : `${GUEST_PROFILE_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${GUEST_PROFILE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function saveGuestProfile(profile: GuestProfile): void {
  const raw = serializeGuestProfile(profile);
  try {
    writeCookie(raw);
    localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, raw);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function clearGuestProfile(): void {
  try {
    writeCookie(null);
    localStorage.removeItem(GUEST_PROFILE_STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Profil visiteur réactif (null tant que rien n'a été saisi, et toujours null côté serveur). */
export function useGuestProfile() {
  const profile = useSyncExternalStore(subscribe, readGuestProfile, () => null);
  const save = useCallback((next: GuestProfile) => saveGuestProfile(next), []);
  const clear = useCallback(() => clearGuestProfile(), []);
  return { profile, save, clear };
}
