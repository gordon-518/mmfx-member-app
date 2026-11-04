// Compliance checks for the plain-language layer on the Fundamental Desk.
// MONEY_CLAIM (src/i18n/moneyClaims.ts) flags 收益 and "imbal hasil", which are
// also the standard words for a bond's *yield* — a word these explainers can't
// avoid. Strip the yield compounds first, then scan for real money claims.

import type { Locale } from "@/i18n/config";
import { MONEY_CLAIM } from "@/i18n/moneyClaims";

const NONE = /(?!)/g;

const YIELD_WORDS: Record<Locale, RegExp> = {
  en: NONE,
  "zh-Hans": /实际收益率|收益率/g,
  "zh-Hant": /實際殖利率|實際收益率|殖利率|收益率/g,
  ms: NONE,
  id: /imbal hasil/gi,
};

// Telling the reader to trade. Description ("buyers stepped in") is fine;
// direction to the reader ("you should buy") is not.
const ADVICE: Record<Locale, RegExp> = {
  en: /\b(you should|we recommend|consider (?:buying|selling)|(?:buy|sell|go long|go short) (?:now|here|at))\b/i,
  "zh-Hans": /(建议(?:买|卖|做多|做空)|应该(?:买|卖|做多|做空)|现在(?:买入|卖出))/,
  "zh-Hant": /(建議(?:買|賣|做多|做空)|應該(?:買|賣|做多|做空)|現在(?:買入|賣出))/,
  ms: /\b(anda patut (?:beli|jual)|kami cadangkan|beli sekarang|jual sekarang)\b/i,
  id: /\b(anda sebaiknya (?:beli|jual)|kami sarankan|beli sekarang|jual sekarang)\b/i,
};

/** The first money-claim word in `text`, ignoring yield vocabulary, or null. */
export function moneyClaimIn(text: string, locale: Locale): string | null {
  const scrubbed = text.replace(YIELD_WORDS[locale], " ");
  return scrubbed.match(MONEY_CLAIM[locale])?.[0] ?? null;
}

/** The first trade instruction aimed at the reader, or null. */
export function adviceIn(text: string, locale: Locale): string | null {
  return text.match(ADVICE[locale])?.[0] ?? null;
}
