import type { Metadata } from "next";
import { AuthScreen, type AuthCopy } from "@/components/AuthScreen";

export const metadata: Metadata = {
  title: "Start your free trial — Market Makers FX",
  description:
    "Create your Market Makers FX account — 14 days of full access to the MM System for gold, free. No password, no card.",
};

const SIGNUP_COPY: AuthCopy = {
  eyebrow: "14-day free trial",
  heading: "Start your free trial",
  subtext:
    "Enter your email and we'll send a secure link to open your desk. No password, no card — full access for 14 days.",
  submitLabel: "Start free trial",
  sentHeading: "Check your inbox",
  sentBodyPre: "We sent a secure activation link to ",
  sentBodyPost: ". Click it to open your desk — your 14 days start the moment you're in, no password needed.",
  footnote: "No password. No card on file. Free for 14 days.",
  altPrompt: "Already a member?",
  altLabel: "Sign in",
  altHref: "/login",
};

export default function SignupPage() {
  return <AuthScreen copy={SIGNUP_COPY} collectName />;
}
