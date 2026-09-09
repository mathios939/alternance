"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NuqsAdapter>
        <TooltipProvider>{children}</TooltipProvider>
      </NuqsAdapter>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ classNames: { toast: "rounded-xl! border! shadow-lg!" } }}
      />
    </ThemeProvider>
  );
}
