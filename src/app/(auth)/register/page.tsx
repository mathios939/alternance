import type { Metadata } from "next";
import { getEnabledSocialProviders } from "@/lib/env";
import { safeReturnTo } from "@/config/routes";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function RegisterPage(props: PageProps<"/register">) {
  const params = await props.searchParams;
  return <RegisterForm providers={getEnabledSocialProviders()} next={safeReturnTo(params["next"])} />;
}
