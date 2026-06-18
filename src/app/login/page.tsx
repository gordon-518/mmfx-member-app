import type { Metadata } from "next";
import { AuthScreen, type AuthCopy } from "@/components/AuthScreen";

export const metadata: Metadata = {
  title: "Sign in — Market Makers FX",
  description: "Sign in to your Market Makers FX member desk with a secure magic link.",
};

const LOGIN_COPY: AuthCopy = {
  eyebrow: "Member access",
  heading: "Welcome back",
  subtext:
    "Enter your email and we'll send you a secure sign-in link. No password to remember.",
  submitLabel: "Send magic link",
  sentHeading: "Check your inbox",
  sentBodyPre: "We sent a secure sign-in link to ",
  sentBodyPost: ". Click it and you're in — no password needed.",
  footnote: "No password. No card on file. Just your email.",
  altPrompt: "New to Market Makers FX?",
  altLabel: "Start your free trial",
  altHref: "/signup",
};

export default function LoginPage() {
  return <AuthScreen copy={LOGIN_COPY} />;
}
