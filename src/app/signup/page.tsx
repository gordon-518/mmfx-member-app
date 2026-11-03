import type { Metadata } from "next";
import { getLocale, getT } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import { localisedCountries } from "@/i18n/regions";
import { COUNTRIES } from "@/lib/countries";
import { fmt } from "@/i18n/format";
import { TRIAL_DAYS } from "@/lib/trial/days";
import { headers } from "next/headers";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.signupMetaTitle, description: fmt(t.auth.signupMetaDescription, { n: TRIAL_DAYS }) };
}

export default async function SignupPage() {
  // Pre-select the country dropdown from the edge geo header (usually correct →
  // near-zero friction). The user can still change it.
  const defaultCountry = ((await headers()).get("x-vercel-ip-country") ?? "").toUpperCase();
  // Named and sorted HERE, once, and passed down. Node and the browser ship
  // different Unicode collation data, so sorting the same Chinese names in
  // both places produced two different orders — a hydration mismatch.
  const countries = localisedCountries(COUNTRIES, INTL_LOCALE[await getLocale()]);
  return (
    <AuthShell>
      <SignupForm defaultCountry={defaultCountry} countries={countries} />
    </AuthShell>
  );
}
