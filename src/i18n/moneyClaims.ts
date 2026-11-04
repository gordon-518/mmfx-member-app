import type { Locale } from "./config";

/**
 * Words that turn copy into a returns claim, per language. Member-facing copy
 * must never promise profit, returns or income — a rule that has to hold in
 * every language, not just English. Tests run promotional namespaces through
 * these; educational content (a lesson about taking partial profits) and risk
 * disclaimers ("no returns are guaranteed") legitimately use the words and are
 * deliberately not scanned.
 */
export const MONEY_CLAIM: Record<Locale, RegExp> = {
  en: /\b(profits?|profitable|profitably|returns?|earns?|earnings|guaranteed?|income|rich)\b/i,
  "zh-Hans": /(盈利|利润|收益|回报|稳赚|保证|致富|暴富|胜率|赚|获利|收入|赢)/,
  "zh-Hant": /(盈利|利潤|收益|回報|穩賺|保證|致富|暴富|勝率|賺|獲利|收入|贏)/,
  ms: /\b(untung|keuntungan|pulangan|pendapatan|dijamin|jaminan|kaya|menang)\b/i,
  id: /\b(untung|keuntungan|profit|imbal hasil|penghasilan|pendapatan|cuan|laba|dijamin|jaminan|kaya)\b/i,
};

/** Every string leaf in a (nested) message object, with its dotted path. */
export function leaves(obj: unknown, path = ""): [string, string][] {
  if (typeof obj === "string") return [[path, obj]];
  if (obj && typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [];
}
