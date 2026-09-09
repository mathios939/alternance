"use client";

import { useEffect, useId, useState } from "react";
import { MapPin } from "lucide-react";
import { searchCities, type City } from "@/config/cities";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = { value: string; onChange: (value: string, city?: City) => void; placeholder?: string; id?: string; className?: string; "aria-invalid"?: boolean };

export function CityAutocomplete({ value, onChange, placeholder = "Ville", id, className, ...rest }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [suggestions, setSuggestions] = useState<City[]>([]);
  useEffect(() => setSuggestions(searchCities(value, 7)), [value]);
  return (
    <div className={cn("relative", className)}>
      <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        id={id}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
          else if (e.key === "Enter" && active >= 0 && suggestions[active]) { e.preventDefault(); onChange(suggestions[active].name, suggestions[active]); setOpen(false); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className="pl-9"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        {...rest}
      />
      {open && suggestions.length > 0 ? (
        <ul id={listId} role="listbox" className="absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-xl border bg-popover p-1 shadow-lg">
          {suggestions.map((c, i) => (
            <li key={c.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseDown={() => { onChange(c.name, c); setOpen(false); }} className={cn("flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm", i === active ? "bg-accent" : "hover:bg-accent")}>
              <span>{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.department}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
