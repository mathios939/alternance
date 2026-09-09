"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { uploadResumeVersion } from "@/features/resume/server/actions";

export function ResumeUpload({ resumeId, compact = false }: { resumeId?: string; compact?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pending, startTransition] = useTransition();

  function send(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Le fichier dépasse 5 Mo.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    if (resumeId) fd.append("resumeId", resumeId);
    startTransition(async () => {
      const r = await uploadResumeVersion(fd);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`CV importé et analysé : ${r.data.score}/100`);
        router.push(`/resume?resume=${r.data.resumeId}`);
        router.refresh();
      }
    });
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) send(f); }}
      className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition-colors", over ? "border-primary bg-primary-soft/40" : "bg-muted/30", compact ? "p-4" : "p-8")}
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">{pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <FileUp className="size-5" aria-hidden />}</span>
      <div>
        <p className="font-medium">{pending ? "Lecture et analyse en cours…" : "Glisse ton CV ici"}</p>
        <p className="text-xs text-muted-foreground">PDF ou texte, 5 Mo maximum. Le texte est extrait puis analysé ; rien n'est inventé.</p>
      </div>
      <input ref={ref} type="file" accept="application/pdf,text/plain" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} aria-label="Choisir un fichier CV" />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={pending}>
        <Upload /> Choisir un fichier
      </Button>
    </div>
  );
}
