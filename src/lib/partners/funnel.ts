// The partner dashboard's data layer (design 2026-09-25 §2.5–2.6): a typed
// wrapper over fn_partner_funnel, the shaping the two tables and the tiles
// need, and the CSV serialiser.
//
// Everything here is counts. The RPC returns no email, no name, no broker and
// no rate, and nothing in this module can invent one.

/** One row of fn_partner_funnel: a (signup week, ad label) pair. */
export interface FunnelRow {
  /** ISO date of the Monday the signup week starts. */
  week: string;
  /** The ad-name half of the cid, as it was written in Ads Manager. */
  label: string;
  signups: number;
  activated: number;
  funded: number;
  depositTotal: number;
  firstTouchSignups: number;
  firstTouchFunded: number;
}

export type PartnerRule = "last_paid_7d" | "first";

export const RULES: readonly PartnerRule[] = ["last_paid_7d", "first"] as const;

export const RULE_LABEL: Record<PartnerRule, string> = {
  last_paid_7d: "Last paid touch (7 days)",
  first: "First touch",
};

export function parseRule(raw: unknown): PartnerRule {
  return raw === "first" ? "first" : "last_paid_7d";
}

/** The range presets the header offers, in days. */
export const RANGE_DAYS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];

export interface Range {
  since: Date;
  until: Date;
  /** The preset this range came from, or null when it is a custom range. */
  days: RangeDays | null;
}

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw.trim().length <= 10 ? `${raw.trim()}T00:00:00Z` : raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Read the range off the query string: `?days=7|30|90`, or a custom
 * `?since=&until=`. Anything unparseable falls back to the 30-day preset
 * rather than erroring — a partner mistyping a date should see the default
 * dashboard, not a stack trace.
 */
export function parseRange(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date()
): Range {
  const since = parseDate(first(params.since));
  const until = parseDate(first(params.until));
  if (since && until && until > since) return { since, until, days: null };

  const raw = Number(first(params.days));
  const days = (RANGE_DAYS as readonly number[]).includes(raw) ? (raw as RangeDays) : 30;
  return { since: new Date(now.getTime() - days * 86_400_000), until: now, days };
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** The slice of a Supabase client the RPC needs. */
export interface FunnelClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Shape one raw RPC row. numeric comes back as a string from some drivers. */
export function shapeRow(raw: Record<string, unknown>): FunnelRow {
  return {
    week: String(raw.week ?? ""),
    label: String(raw.label ?? ""),
    signups: num(raw.signups),
    activated: num(raw.activated),
    funded: num(raw.funded),
    depositTotal: num(raw.deposit_total),
    firstTouchSignups: num(raw.first_touch_signups),
    firstTouchFunded: num(raw.first_touch_funded),
  };
}

export interface FetchFunnelArgs {
  slug: string;
  since: Date;
  until: Date;
  rule: PartnerRule;
}

/**
 * Call fn_partner_funnel. Returns [] on any failure: the dashboard renders
 * "no data in this range" rather than an error page, because a partner
 * reading zeros at least knows the link works.
 */
export async function fetchFunnel(db: FunnelClient, a: FetchFunnelArgs): Promise<FunnelRow[]> {
  try {
    const { data, error } = await db.rpc("fn_partner_funnel", {
      p_slug: a.slug,
      p_since: a.since.toISOString(),
      p_until: a.until.toISOString(),
      p_rule: a.rule,
    });
    if (error) {
      console.error("[partners] funnel failed:", error.message);
      return [];
    }
    return Array.isArray(data) ? data.map((r) => shapeRow(r as Record<string, unknown>)) : [];
  } catch (e) {
    console.error("[partners] funnel threw:", e);
    return [];
  }
}

export interface Totals {
  signups: number;
  activated: number;
  funded: number;
  depositTotal: number;
  firstTouchSignups: number;
  firstTouchFunded: number;
  /** Funded as a percentage of signups, rounded to one decimal. */
  fundedRate: number;
}

export function totals(rows: FunnelRow[]): Totals {
  const t = rows.reduce(
    (acc, r) => ({
      signups: acc.signups + r.signups,
      activated: acc.activated + r.activated,
      funded: acc.funded + r.funded,
      depositTotal: acc.depositTotal + r.depositTotal,
      firstTouchSignups: acc.firstTouchSignups + r.firstTouchSignups,
      firstTouchFunded: acc.firstTouchFunded + r.firstTouchFunded,
    }),
    { signups: 0, activated: 0, funded: 0, depositTotal: 0, firstTouchSignups: 0, firstTouchFunded: 0 }
  );
  return {
    ...t,
    depositTotal: Math.round(t.depositTotal * 100) / 100,
    fundedRate: t.signups > 0 ? Math.round((t.funded / t.signups) * 1000) / 10 : 0,
  };
}

export interface LabelRow extends Totals {
  label: string;
  /** Signups per week, oldest first — the sparkline's values. */
  weekly: number[];
}

/** One row per ad, sorted by funded desc then signups desc (§2.6). */
export function byLabel(rows: FunnelRow[]): LabelRow[] {
  const weeks = [...new Set(rows.map((r) => r.week))].sort();
  const groups = new Map<string, FunnelRow[]>();
  for (const r of rows) {
    const g = groups.get(r.label);
    if (g) g.push(r);
    else groups.set(r.label, [r]);
  }

  return [...groups.entries()]
    .map(([label, rs]) => {
      const byWeekSignups = new Map(rs.map((r) => [r.week, r.signups]));
      return {
        label,
        ...totals(rs),
        weekly: weeks.map((w) => byWeekSignups.get(w) ?? 0),
      };
    })
    .sort((a, b) => b.funded - a.funded || b.signups - a.signups || a.label.localeCompare(b.label));
}

export interface WeekRow extends Totals {
  week: string;
}

/** One row per signup week, oldest first. */
export function byWeek(rows: FunnelRow[]): WeekRow[] {
  const groups = new Map<string, FunnelRow[]>();
  for (const r of rows) {
    const g = groups.get(r.week);
    if (g) g.push(r);
    else groups.set(r.week, [r]);
  }
  return [...groups.entries()]
    .map(([week, rs]) => ({ week, ...totals(rs) }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export const CSV_COLUMNS = [
  "week",
  "label",
  "signups",
  "activated",
  "funded",
  "deposit_total",
  "first_touch_signups",
  "first_touch_funded",
] as const;

/**
 * One CSV field.
 *
 * Two separate jobs. RFC 4180 quoting handles commas, quotes and newlines in
 * an ad name. The leading apostrophe handles the other thing an ad name can
 * be: a spreadsheet reads a cell starting with = + - @ as a FORMULA, so an ad
 * called "=cmd|…" would execute on open. Prefixing breaks that and is visible
 * in the cell, which is the honest trade.
 */
export function csvField(value: string | number): string {
  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: FunnelRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.week,
        r.label,
        r.signups,
        r.activated,
        r.funded,
        r.depositTotal.toFixed(2),
        r.firstTouchSignups,
        r.firstTouchFunded,
      ]
        .map(csvField)
        .join(",")
    );
  }
  // Trailing newline: some importers drop the last row without one.
  return lines.join("\r\n") + "\r\n";
}

/** `2026-09-21` → `21 Sep`. UTC throughout — the weeks come from the database. */
export function fmtWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
