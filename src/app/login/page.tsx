import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Sign in — ${BRAND.name}`,
  description: `Sign in to your ${BRAND.name} member desk with your email and password.`,
};

export default function LoginPage() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
