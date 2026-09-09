import { Fragment } from "react";
import { cn } from "@/lib/utils";

/** Rendu Markdown léger et sûr (pas de HTML brut) : titres, listes, gras, italique, paragraphes. */
export function LiteMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed", className)}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          const ordered = /^\s*\d+[.)]/.test(lines[0] ?? "");
          const Tag = ordered ? "ol" : "ul";
          return (
            <Tag key={i} className={cn("space-y-1 pl-5", ordered ? "list-decimal" : "list-disc")}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>
              ))}
            </Tag>
          );
        }
        if (/^#{1,3}\s/.test(lines[0] ?? "")) {
          const level = (lines[0]!.match(/^#+/)?.[0].length ?? 2) as 1 | 2 | 3;
          const Tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
          return (
            <Fragment key={i}>
              <Tag className={cn("font-semibold", level === 1 ? "text-lg" : "text-base")}>{inline(lines[0]!.replace(/^#+\s/, ""))}</Tag>
              {lines.length > 1 ? <p className="whitespace-pre-line">{inline(lines.slice(1).join("\n"))}</p> : null}
            </Fragment>
          );
        }
        if (/^---+$/.test(block.trim())) return <hr key={i} className="border-border" />;
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={i} className="text-muted-foreground">{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
