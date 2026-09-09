"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";

export default function GlobalErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4">
      <ErrorState title="Oups, quelque chose s'est mal passé" description={`Une erreur inattendue est survenue${error.digest ? ` (réf. ${error.digest})` : ""}. Tu peux réessayer.`} onRetry={reset} className="w-full" />
    </div>
  );
}
