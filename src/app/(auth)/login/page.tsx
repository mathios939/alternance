import type { Metadata } from "next";
import { getEnabledSocialProviders } from "@/lib/env";
import { siteConfig } from "@/config/site";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

function safeNext(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  return <LoginForm providers={getEnabledSocialProviders()} next={safeNext(params["next"])} demoEmail={siteConfig.isDemoMode ? "demo@alternance.demo" : undefined} />;
}
