import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  action?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
};

export function SectionHeading({
  title,
  description,
  href,
  hrefLabel = "Tout voir",
  action,
  className,
  as: Tag = "h2",
}: SectionHeadingProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        <Tag className="text-lg font-semibold tracking-tight">{title}</Tag>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ??
        (href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {hrefLabel} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null)}
    </div>
  );
}
