import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.6_0.2_300)] text-primary-foreground shadow-sm",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19 12 5l8 14" />
        <path d="M8.5 14h7" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className, withText = true }: { href?: string; className?: string; withText?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)} aria-label="Alternance OS — accueil">
      <LogoMark />
      {withText ? (
        <span className="text-[15px]">
          Alternance<span className="text-primary">OS</span>
        </span>
      ) : null}
    </Link>
  );
}
