import type { Metadata } from "next";
import { getEnabledSocialProviders } from "@/lib/env";
import { safeReturnTo } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  return <LoginForm providers={getEnabledSocialProviders()} next={safeReturnTo(params["next"])} demoEmail={siteConfig.isDemoMode ? "demo@alternance.demo" : undefined} />;
}
