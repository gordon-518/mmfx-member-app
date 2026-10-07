// The one place the brand lives. Every tenant of the white-label desk is this
// same code with a different set of NEXT_PUBLIC_BRAND_* env vars; the defaults
// below are Market Makers FX, byte-for-byte what the app hard-coded before this
// module existed, so production reads exactly as it did until an env var is set.
//
// Client-safe: only NEXT_PUBLIC_ vars, read at build time (Next inlines them),
// no secrets, no side effects. Server code and client components import the
// same BRAND object. See docs/superpowers/specs/2026-10-07-white-label-desk-demo-design.md.

import type { FeatureKey } from "@/lib/access/featureKeys";
import { FEATURE_KEYS } from "@/lib/access/featureKeys";

export interface Brand {
  /** Full name: "Market Makers FX". */
  name: string;
  /** Short form for prose and tags: "MMFX". */
  shortName: string;
  /** The wordmark splits into a plain lead and an accent-coloured tail. */
  wordmark: { lead: string; accent: string };
  /** Bare domain, no scheme: "marketmakersfx.net". */
  domain: string;
  supportEmail: string;
  /** The postal line every marketing email must carry. */
  postalLine: string;
  /** The first-person voice of the desk ("Don"). */
  persona: string;
  /** Accent colour trio, mapped onto --color-orange / -accent-soft / -accent-ink. */
  accent: string;
  accentSoft: string;
  accentInk: string;
  /** True on a demo tenant: shows the demo banner and the partner pitch at "/". */
  demo: boolean;
  /** Feature surfaces hidden on this tenant. */
  featuresOff: readonly FeatureKey[];
}

const DEFAULTS: Brand = {
  name: "Market Makers FX",
  shortName: "MMFX",
  wordmark: { lead: "Market Makers", accent: "FX" },
  domain: "marketmakersfx.net",
  supportEmail: "hello@marketmakersfx.net",
  postalLine: "Market Makers FX, Singapore",
  persona: "Don",
  accent: "#ff5a1f",
  accentSoft: "#ffece2",
  accentInk: "#c2410c",
  demo: false,
  featuresOff: [],
};

export type BrandEnv = Partial<Record<
  | "NEXT_PUBLIC_BRAND_NAME"
  | "NEXT_PUBLIC_BRAND_SHORT"
  | "NEXT_PUBLIC_BRAND_WORDMARK"
  | "NEXT_PUBLIC_BRAND_DOMAIN"
  | "NEXT_PUBLIC_BRAND_SUPPORT_EMAIL"
  | "NEXT_PUBLIC_BRAND_POSTAL"
  | "NEXT_PUBLIC_BRAND_PERSONA"
  | "NEXT_PUBLIC_BRAND_ACCENT"
  | "NEXT_PUBLIC_BRAND_ACCENT_SOFT"
  | "NEXT_PUBLIC_BRAND_ACCENT_INK"
  | "NEXT_PUBLIC_BRAND_DEMO"
  | "NEXT_PUBLIC_BRAND_FEATURES_OFF",
  string | undefined
>>;

const str = (v: string | undefined, fallback: string): string => {
  const t = v?.trim();
  return t ? t : fallback;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const colour = (v: string | undefined, fallback: string): string => {
  const t = v?.trim();
  return t && HEX.test(t) ? t.toLowerCase() : fallback;
};

/** "Market Makers|FX" → { lead, accent }. No bar: the whole thing is the lead. */
export function parseWordmark(v: string | undefined, fallback: Brand["wordmark"]): Brand["wordmark"] {
  const t = v?.trim();
  if (!t) return fallback;
  const i = t.indexOf("|");
  if (i < 0) return { lead: t, accent: "" };
  return { lead: t.slice(0, i).trim(), accent: t.slice(i + 1).trim() };
}

/** Comma list → the subset that are real feature keys. Unknown keys are dropped. */
export function parseFeaturesOff(v: string | undefined): FeatureKey[] {
  if (!v) return [];
  const known = new Set<string>(FEATURE_KEYS);
  return [...new Set(v.split(",").map((s) => s.trim()).filter((s) => known.has(s)))] as FeatureKey[];
}

export function brandFromEnv(env: BrandEnv): Brand {
  return {
    name: str(env.NEXT_PUBLIC_BRAND_NAME, DEFAULTS.name),
    shortName: str(env.NEXT_PUBLIC_BRAND_SHORT, DEFAULTS.shortName),
    wordmark: parseWordmark(env.NEXT_PUBLIC_BRAND_WORDMARK, DEFAULTS.wordmark),
    domain: str(env.NEXT_PUBLIC_BRAND_DOMAIN, DEFAULTS.domain).replace(/^https?:\/\//, "").replace(/\/+$/, ""),
    supportEmail: str(env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL, DEFAULTS.supportEmail),
    postalLine: str(env.NEXT_PUBLIC_BRAND_POSTAL, DEFAULTS.postalLine),
    persona: str(env.NEXT_PUBLIC_BRAND_PERSONA, DEFAULTS.persona),
    accent: colour(env.NEXT_PUBLIC_BRAND_ACCENT, DEFAULTS.accent),
    accentSoft: colour(env.NEXT_PUBLIC_BRAND_ACCENT_SOFT, DEFAULTS.accentSoft),
    accentInk: colour(env.NEXT_PUBLIC_BRAND_ACCENT_INK, DEFAULTS.accentInk),
    demo: env.NEXT_PUBLIC_BRAND_DEMO?.trim().toLowerCase() === "true",
    featuresOff: parseFeaturesOff(env.NEXT_PUBLIC_BRAND_FEATURES_OFF),
  };
}

// Each process.env.NEXT_PUBLIC_* must be spelled out literally so Next can
// inline it into the client bundle; a dynamic lookup would be undefined there.
export const BRAND: Brand = brandFromEnv({
  NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME,
  NEXT_PUBLIC_BRAND_SHORT: process.env.NEXT_PUBLIC_BRAND_SHORT,
  NEXT_PUBLIC_BRAND_WORDMARK: process.env.NEXT_PUBLIC_BRAND_WORDMARK,
  NEXT_PUBLIC_BRAND_DOMAIN: process.env.NEXT_PUBLIC_BRAND_DOMAIN,
  NEXT_PUBLIC_BRAND_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL,
  NEXT_PUBLIC_BRAND_POSTAL: process.env.NEXT_PUBLIC_BRAND_POSTAL,
  NEXT_PUBLIC_BRAND_PERSONA: process.env.NEXT_PUBLIC_BRAND_PERSONA,
  NEXT_PUBLIC_BRAND_ACCENT: process.env.NEXT_PUBLIC_BRAND_ACCENT,
  NEXT_PUBLIC_BRAND_ACCENT_SOFT: process.env.NEXT_PUBLIC_BRAND_ACCENT_SOFT,
  NEXT_PUBLIC_BRAND_ACCENT_INK: process.env.NEXT_PUBLIC_BRAND_ACCENT_INK,
  NEXT_PUBLIC_BRAND_DEMO: process.env.NEXT_PUBLIC_BRAND_DEMO,
  NEXT_PUBLIC_BRAND_FEATURES_OFF: process.env.NEXT_PUBLIC_BRAND_FEATURES_OFF,
});

/** "https://marketmakersfx.net" — the public web root of this brand. */
export const BRAND_SITE_URL = `https://${BRAND.domain}`;

/** True when this tenant has switched a feature surface off. */
export function featureOff(key: FeatureKey): boolean {
  return BRAND.featuresOff.includes(key);
}

/** The inline CSS variables the root layout sets when the accent is not MMFX's. */
export function brandCssVars(b: Brand = BRAND): Record<string, string> | undefined {
  if (b.accent === DEFAULTS.accent && b.accentSoft === DEFAULTS.accentSoft && b.accentInk === DEFAULTS.accentInk) {
    return undefined;
  }
  return {
    "--color-orange": b.accent,
    "--color-accent-soft": b.accentSoft,
    "--color-accent-ink": b.accentInk,
  };
}
