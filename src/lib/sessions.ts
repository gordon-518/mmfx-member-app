// The trading session a Daily Analysis is tagged with. The admin form takes
// free text, so the same session arrives as "London Session", "London" and
// "london"; this reads them as one, so they group together and translate.

import type { Messages } from "@/i18n/messages/types";

export type SessionKey = keyof Messages["dailyAnalysis"]["sessions"];

export function sessionKey(tag: string | null | undefined): SessionKey | null {
  if (!tag) return null;
  const s = tag.toLowerCase().replace(/\bsession\b/g, "").replace(/[^a-z]+/g, " ").trim();
  if (/^pre ?(ny|new york)$/.test(s)) return "preNewYork";
  if (s === "ny" || s === "new york") return "newYork";
  if (s === "london") return "london";
  if (s === "asia" || s === "asian") return "asian";
  return null;
}

/** The session in the reader's language; a tag we don't recognise shows as written. */
export function sessionLabel(tag: string | null | undefined, labels: Messages["dailyAnalysis"]["sessions"]): string | null {
  if (!tag) return null;
  const key = sessionKey(tag);
  return key ? labels[key] : tag.trim();
}
