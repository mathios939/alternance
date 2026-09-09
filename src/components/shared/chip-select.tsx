"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string; description?: string; emoji?: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T[] | T | null;
  onChange: (value: T[] | T | null) => void;
  multiple?: boolean;
  columns?: 1 | 2 | 3;
  "aria-label": string;
  size?: "sm" | "md";
};

/** Sélecteur en « puces » accessible (radio ou checkbox selon `multiple`). */
export function ChipSelect<T extends string>({ options, value, onChange, multiple = false, columns = 1, size = "md", ...rest }: Props<T>) {
  const selected = new Set<T>(Array.isArray(value) ? value : value ? [value] : []);
  function toggle(v: T) {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      onChange([...next]);
    } else {
      onChange(selected.has(v) ? null : v);
    }
  }
  return (
    <div role={multiple ? "group" : "radiogroup"} aria-label={rest["aria-label"]} className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
      {options.map((o) => {
        const on = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => toggle(o.value)}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card text-left transition-all hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
              size === "md" ? "px-4 py-3" : "px-3 py-2",
              on && "border-primary bg-primary-soft/60 ring-1 ring-primary/30",
            )}
          >
            {o.emoji ? <span className="text-lg" aria-hidden>{o.emoji}</span> : null}
            <span className="min-w-0 flex-1">
              <span className={cn("block font-medium", size === "sm" && "text-sm")}>{o.label}</span>
              {o.description ? <span className="block text-xs text-muted-foreground">{o.description}</span> : null}
            </span>
            <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-input")} aria-hidden>
              {on ? <Check className="size-3" strokeWidth={3} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
