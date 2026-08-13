// Shared display formatters for the journal UI — one implementation so every
// component agrees.

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

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
  return `${(sec / 86400).toFixed(1)}d`;
}
