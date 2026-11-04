// The languages the member app speaks (Gordon, 4 Nov).
//
// Pure and edge-safe: the proxy, server components and client components all
// import this. The locale is chosen per member and kept in a cookie (plus
// user_metadata, so it follows the account between devices) rather than in
// the URL. Next's own guide suggests /[lang]/ sub-paths, but that buys search
// visibility this app doesn't want (it is signed-in and noindexed) at the cost
// of rewriting every route, link, redirect and Telegram /go destination.

export const LOCALES = ["en", "zh-Hans", "zh-Hant", "ms", "id"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "mmfx_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Each language named in itself, so a reader finds theirs without reading English. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  ms: "Bahasa Melayu",
  id: "Bahasa Indonesia",
};

/**
 * The tag Intl formats dates and numbers with. English keeps en-GB because the
 * app has always written dates day-first ("22 Oct"), and the members are in
 * Asia, not the US.
 */
/** A short tag for tight headers; the picker itself still lists full names. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  "zh-Hans": "简",
  "zh-Hant": "繁",
  ms: "BM",
  id: "ID",
};

export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
  ms: "ms-MY",
  id: "id-ID",
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
