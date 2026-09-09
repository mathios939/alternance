import type { Metadata } from "next";
import { getEnabledSocialProviders } from "@/lib/env";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

function safeNext(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

export default async function RegisterPage(props: PageProps<"/register">) {
  const params = await props.searchParams;
  return <RegisterForm providers={getEnabledSocialProviders()} next={safeNext(params["next"])} />;
}
