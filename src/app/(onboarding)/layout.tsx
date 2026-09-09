import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="grid-fade pointer-events-none absolute inset-x-0 top-0 h-80" aria-hidden />
      <header className="relative flex items-center justify-between px-6 py-5">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="relative px-4 pb-16">{children}</main>
    </div>
  );
}
