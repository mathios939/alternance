"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "aos.compare";
const MAX = 4;
const EVENT = "aos:compare";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Liste d'offres à comparer, persistée localement (max 4). */
export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(read());
    const onChange = () => setIds(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const write = useCallback((next: string[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
    } catch {}
    setIds(next.slice(0, MAX));
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const toggle = useCallback(
    (id: string): { added: boolean; full: boolean } => {
      const current = read();
      if (current.includes(id)) {
        write(current.filter((x) => x !== id));
        return { added: false, full: false };
      }
      if (current.length >= MAX) return { added: false, full: true };
      write([...current, id]);
      return { added: true, full: false };
    },
    [write],
  );
  const clear = useCallback(() => write([]), [write]);
  return { ids, toggle, clear, has: (id: string) => ids.includes(id), max: MAX };
}
