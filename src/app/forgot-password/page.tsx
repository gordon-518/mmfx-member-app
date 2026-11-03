import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.forgotMetaTitle, description: t.auth.forgotMetaDescription };
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
