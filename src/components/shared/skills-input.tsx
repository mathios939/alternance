"use client";

import { useMemo, useState } from "react";
import { X, Plus } from "lucide-react";
import { SKILL_CATALOG } from "@/config/skills";
import { normalizeText } from "@/lib/text/normalize";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = { value: string[]; onChange: (skills: string[]) => void; suggestions?: string[]; placeholder?: string; max?: number; id?: string };

export function SkillsInput({ value, onChange, suggestions = [], placeholder = "Ajoute une compétence (React, Excel, SEO…)", max = 40, id }: Props) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const matches = useMemo(() => {
    const q = normalizeText(input);
    if (!q) return [];
    const lower = new Set(value.map((v) => normalizeText(v)));
    return SKILL_CATALOG.filter((s) => !lower.has(normalizeText(s.name)) && (normalizeText(s.name).includes(q) || s.aliases?.some((a) => normalizeText(a).includes(q))))
      .slice(0, 6)
      .map((s) => s.name);
  }, [input, value]);

  function add(skill: string) {
    const clean = skill.trim();
    if (!clean || value.length >= max) return;
    if (value.some((v) => normalizeText(v) === normalizeText(clean))) return;
    onChange([...value, clean]);
    setInput("");
    setActive(-1);
  }
  function remove(skill: string) {
    onChange(value.filter((v) => v !== skill));
  }

  const quick = suggestions.filter((s) => !value.some((v) => normalizeText(v) === normalizeText(s))).slice(0, 8);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id={id}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(active >= 0 && matches[active] ? matches[active] : input);
            } else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
            else if (e.key === "Backspace" && !input && value.length) remove(value[value.length - 1]!);
          }}
          placeholder={placeholder}
          autoComplete="off"
          aria-describedby={`${id ?? "skills"}-help`}
        />
        {open && matches.length > 0 ? (
          <ul role="listbox" className="absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-xl border bg-popover p-1 shadow-lg">
            {matches.map((m, i) => (
              <li key={m} role="option" aria-selected={i === active} onMouseDown={() => add(m)} className={cn("cursor-pointer rounded-md px-3 py-2 text-sm", i === active ? "bg-accent" : "hover:bg-accent")}>
                {m}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p id={`${id ?? "skills"}-help`} className="text-xs text-muted-foreground">Entrée pour ajouter. {value.length}/{max}.</p>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Compétences sélectionnées">
          {value.map((s) => (
            <li key={s}>
              <Badge variant="soft" className="gap-1 py-1 pr-1 pl-2.5 text-sm font-medium">
                {s}
                <button type="button" onClick={() => remove(s)} className="rounded-sm p-0.5 hover:bg-primary/20" aria-label={`Retirer ${s}`}>
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {quick.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-muted-foreground">Suggestions :</span>
          {quick.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary hover:text-primary">
              <Plus className="size-3" aria-hidden /> {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
