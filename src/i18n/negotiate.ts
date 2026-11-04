import { DEFAULT_LOCALE, type Locale } from "./config";

// First visit, no cookie yet: read the browser's Accept-Language and pick the
// closest language we speak. Hand-rolled rather than pulling in negotiator +
// intl-localematcher for five languages — the only genuinely subtle part is
// Chinese, where the region (or script subtag) decides the script.

const TRADITIONAL_REGIONS = new Set(["tw", "hk", "mo"]);

/** One Accept-Language tag -> our locale, or null when we don't speak it. */
export function localeForTag(tag: string): Locale | null {
  const parts = tag.trim().toLowerCase().split("-");
  const lang = parts[0];
  if (lang === "en") return "en";
  if (lang === "ms") return "ms";
  // "in" is the pre-1989 code for Indonesian that some Android builds still send.
  if (lang === "id" || lang === "in") return "id";
  if (lang === "zh") {
    if (parts.includes("hant")) return "zh-Hant";
    if (parts.includes("hans")) return "zh-Hans";
    // zh-TW / zh-HK / zh-MO read Traditional; zh, zh-CN, zh-SG, zh-MY read Simplified.
    return parts.slice(1).some((p) => TRADITIONAL_REGIONS.has(p)) ? "zh-Hant" : "zh-Hans";
  }
  return null;
}

/** "zh-TW,zh;q=0.9,en;q=0.8" -> "zh-Hant". Highest q wins; ties keep header order. */
export function negotiateLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((entry, index) => {
      const [tag, ...params] = entry.trim().split(";");
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { tag, q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((e) => e.tag && e.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of ranked) {
    const hit = localeForTag(tag);
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}
