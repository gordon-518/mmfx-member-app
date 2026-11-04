import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.loginMetaTitle, description: t.auth.loginMetaDescription };
}

export default function LoginPage() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
