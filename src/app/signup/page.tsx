import type { Metadata } from "next";
import { headers } from "next/headers";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Start your free trial — Market Makers FX",
  description:
    "Create your Market Makers FX account — 14 days of full access to the MM System for gold, free.",
};

export default async function SignupPage() {
  // Pre-select the country dropdown from the edge geo header (usually correct →
  // near-zero friction). The user can still change it.
  const defaultCountry = ((await headers()).get("x-vercel-ip-country") ?? "").toUpperCase();
  return (
    <AuthShell>
      <SignupForm defaultCountry={defaultCountry} />
    </AuthShell>
  );
}
