import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "primary" | "success" | "warning" | "info";
  className?: string;
};

const TONES = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-foreground dark:text-warning",
  info: "bg-info-soft text-info",
};

export function StatCard({ label, value, hint, icon: Icon, href, tone = "primary", className }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <div className={cn("flex size-10 items-center justify-center rounded-xl", TONES[tone])}>
          <Icon className="size-5" aria-hidden />
        </div>
        {href ? (
          <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        ) : null}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 text-sm font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </>
  );
  const classes = cn("surface group block p-5", href && "surface-hover", className);
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
