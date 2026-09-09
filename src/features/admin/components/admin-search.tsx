"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function AdminSearch({ placeholder, basePath }: { placeholder: string; basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <form onSubmit={(e) => { e.preventDefault(); const q = String(new FormData(e.currentTarget).get("q") ?? ""); router.push(q ? `${basePath}?q=${encodeURIComponent(q)}` : basePath); }} className="relative max-w-md" role="search">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input name="q" defaultValue={params.get("q") ?? ""} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
    </form>
  );
}
