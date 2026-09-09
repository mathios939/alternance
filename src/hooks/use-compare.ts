"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "aos.compare";
const MAX = 4;
const EVENT = "aos:compare";
const EMPTY: string[] = [];

let cachedRaw: string | null = null;
let cachedIds: string[] = EMPTY;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedIds;
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    cachedRaw = raw;
    cachedIds = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX) : EMPTY;
    return cachedIds;
  } catch {
    return EMPTY;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function write(next: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** Liste d'offres à comparer, persistée localement (max 4). */
export function useCompare() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = useCallback((id: string): { added: boolean; full: boolean } => {
    const current = read();
    if (current.includes(id)) {
      write(current.filter((x) => x !== id));
      return { added: false, full: false };
    }
    if (current.length >= MAX) return { added: false, full: true };
    write([...current, id]);
    return { added: true, full: false };
  }, []);
  const clear = useCallback(() => write([]), []);
  return { ids, toggle, clear, has: (id: string) => ids.includes(id), max: MAX };
}
