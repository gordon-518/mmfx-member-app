// Pure normalization of a broker IB export (already read into row objects) into
// a deduped list of canonical MT5 logins. The xlsx→rows read happens in the API
// route (SheetJS); this stays pure and unit-tested against the real formats.

export interface BrokerParseConfig {
  /** Sheet name (used by the route when reading the workbook; not needed here). */
  sheet?: string;
  /** Column holding the account id(s). */
  column: string;
  /** Prefixes stripped in order to reach the numeric MT5 login (e.g. Octa_, TA). */
  strip: string[];
  /** Whether one cell can hold multiple comma-separated accounts. */
  split: boolean;
  /** Column holding the account balance, if the export carries it (Dupoin only). */
  balanceColumn?: string;
}

/** One raw token → canonical digits-only login, or null if it isn't one. */
export function normalizeLogin(token: string, strip: string[]): string | null {
  let s = String(token).trim();
  if (!s) return null;
  for (const prefix of strip) {
    if (s.startsWith(prefix)) s = s.slice(prefix.length);
  }
  return /^\d+$/.test(s) ? s : null;
}

export interface ParseResult {
  logins: string[];
  skipped: number;
}

/** Rows (column→value objects) + config → deduped canonical logins. */
export function parseIbRows(
  rows: Record<string, unknown>[],
  cfg: BrokerParseConfig
): ParseResult {
  const seen = new Set<string>();
  const logins: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    const cell = row[cfg.column];
    if (cell === null || cell === undefined || String(cell).trim() === "")
      continue;
    const tokens = cfg.split ? String(cell).split(",") : [String(cell)];
    for (const t of tokens) {
      if (t.trim() === "") continue;
      const login = normalizeLogin(t, cfg.strip);
      if (login === null) {
        skipped += 1;
        continue;
      }
      if (!seen.has(login)) {
        seen.add(login);
        logins.push(login);
      }
    }
  }
  return { logins, skipped };
}

/**
 * login → balance map from an export that carries a balance column (Dupoin).
 * Empty when the config has no balanceColumn (e.g. Octa). Only for
 * single-account-per-row exports (split brokers don't carry per-account balance).
 */
export function parseIbBalances(
  rows: Record<string, unknown>[],
  cfg: BrokerParseConfig
): Map<string, number> {
  const out = new Map<string, number>();
  if (!cfg.balanceColumn) return out;
  for (const row of rows) {
    const login = normalizeLogin(String(row[cfg.column] ?? ""), cfg.strip);
    if (!login) continue;
    const raw = row[cfg.balanceColumn];
    if (raw === null || raw === undefined || String(raw).trim() === "") continue;
    const balance = Number(raw);
    if (Number.isNaN(balance)) continue;
    out.set(login, balance);
  }
  return out;
}
