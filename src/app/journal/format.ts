// Shared display formatters for the journal UI — one implementation so every
// component agrees. Amounts keep one number format in every language (the
// currency code follows the number); dates and durations follow the reader's.

import { fmt } from "@/i18n/format";
import { en } from "@/i18n/messages/en";
import type { Messages } from "@/i18n/messages/types";

export function money(n: number | null | undefined, currency?: string | null): string {
  if (n == null) return "—";
  const s = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? "−" : ""}${s}${currency ? ` ${currency}` : ""}`;
}

// Mirrors money() (2 decimals, currency-code suffix, no hardcoded symbol) but
// always shows an explicit +/− sign. A hardcoded "$" here was wrong for non-USD
// accounts and made one dashboard show three different money formats.
export function signedMoney(n: number, currency?: string | null): string {
  const s = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? "−" : "+"}${s}${currency ? ` ${currency}` : ""}`;
}

export function pct(frac: number | null | undefined): string {
  return frac == null ? "—" : `${(frac * 100).toFixed(1)}%`;
}

// Profit factor is null both when there are no trades AND when there are wins
// but no losing trades (division by zero) — the latter is effectively infinite,
// not "no data". Distinguish them for display.
export function profitFactorLabel(a: {
  profitFactor: number | null;
  grossWin: number;
}): string {
  if (a.profitFactor != null) return a.profitFactor.toFixed(2);
  return a.grossWin > 0 ? "∞" : "—";
}

/** "04 Nov, 14:30" in the reader's language (intl is an INTL_LOCALE value). */
export function fmtTime(iso: string | null, intl = "en-GB"): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(intl, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "04 Nov" in the reader's language. */
export function fmtDay(iso: string | null, intl = "en-GB"): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(intl, { day: "2-digit", month: "short" });
}

export function fmtDuration(
  sec: number | null,
  u: Messages["journal"]["durations"] = en.journal.durations
): string {
  if (sec == null) return "—";
  if (sec < 3600) return fmt(u.m, { n: Math.round(sec / 60) });
  if (sec < 86400) return fmt(u.h, { n: (sec / 3600).toFixed(1) });
  return fmt(u.d, { n: (sec / 86400).toFixed(1) });
}

// Split off the first sentence so the coach can lead with a punchy verdict and
// tuck the rest behind a tap. A sentence ends at ".", "!" or "?" before a
// space, or at a Chinese full stop ("。", "！", "？"), which has no space after it.
export function splitFirst(text: string): [string, string] {
  const m = text.match(/^([\s\S]*?(?:[.!?](?=\s)|[。！？]))\s*([\s\S]+)$/);
  return m ? [m[1], m[2]] : [text, ""];
}
