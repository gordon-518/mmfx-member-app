import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Reset password — ${BRAND.name}`,
  description: `Reset your ${BRAND.name} password with a secure code.`,
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
