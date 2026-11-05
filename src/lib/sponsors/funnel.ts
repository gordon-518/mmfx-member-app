// The sponsor dashboard's data layer (design 2026-11-05 §2–§4): typed wrappers
// over fn_sponsor_funnel and fn_sponsor_clients, the shaping the tiles and
// tables need, and the two CSV serialisers.
//
// Masking happens in SQL. Nothing in this module can widen what the functions
// return, and nothing here invents a column they do not have.

import { csvField, type FunnelClient } from "@/lib/partners/funnel";

export type { FunnelClient };

/** One row of fn_sponsor_funnel: a (signup week, ad label) pair. label is null
 *  for cohort members who did not arrive through a sponsor-tagged ad. */
export interface SponsorFunnelRow {
  /** ISO date of the Monday the signup week starts. */
  week: string;
  label: string | null;
  signups: number;
  activated: number;
  upgradeViewed: number;
  brokerClicked: number;
  submitted: number;
  funded: number;
  depositTotal: number;
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Shape one raw RPC row. numeric comes back as a string from some drivers. */
export function shapeFunnelRow(raw: Record<string, unknown>): SponsorFunnelRow {
  return {
    week: typeof raw.week === "string" ? raw.week.slice(0, 10) : "",
    label: str(raw.label),
    signups: num(raw.signups),
    activated: num(raw.activated),
    upgradeViewed: num(raw.upgrade_viewed),
    brokerClicked: num(raw.broker_clicked),
    submitted: num(raw.submitted),
    funded: num(raw.funded),
    depositTotal: num(raw.deposit_total),
  };
}

export interface SponsorTotals {
  signups: number;
  /** Signups whose first touch was a sponsor-tagged ad. */
  traced: number;
  activated: number;
  upgradeViewed: number;
  brokerClicked: number;
  submitted: number;
  funded: number;
  depositTotal: number;
  /** Funded as a percentage of signups, one decimal. */
  fundedRate: number;
}

const ZERO = {
  signups: 0,
  traced: 0,
  activated: 0,
  upgradeViewed: 0,
  brokerClicked: 0,
  submitted: 0,
  funded: 0,
  depositTotal: 0,
};

export function totals(rows: SponsorFunnelRow[]): SponsorTotals {
  const t = rows.reduce(
    (acc, r) => ({
      signups: acc.signups + r.signups,
      traced: acc.traced + (r.label === null ? 0 : r.signups),
      activated: acc.activated + r.activated,
      upgradeViewed: acc.upgradeViewed + r.upgradeViewed,
      brokerClicked: acc.brokerClicked + r.brokerClicked,
      submitted: acc.submitted + r.submitted,
      funded: acc.funded + r.funded,
      depositTotal: acc.depositTotal + r.depositTotal,
    }),
    ZERO
  );
  return {
    ...t,
    depositTotal: Math.round(t.depositTotal * 100) / 100,
    fundedRate: t.signups > 0 ? Math.round((t.funded / t.signups) * 1000) / 10 : 0,
  };
}

export interface WeekRow extends SponsorTotals {
  week: string;
}

/** One row per signup week, oldest first, traced and untraced together. */
export function byWeek(rows: SponsorFunnelRow[]): WeekRow[] {
  const weeks = [...new Set(rows.map((r) => r.week))].sort();
  return weeks.map((week) => ({ week, ...totals(rows.filter((r) => r.week === week)) }));
}

export interface AdRow {
  label: string;
  signups: number;
  activated: number;
  funded: number;
  depositTotal: number;
}

/** Traced signups by ad, best-funded first, then by signups. */
export function byAd(rows: SponsorFunnelRow[]): AdRow[] {
  const labels = [...new Set(rows.flatMap((r) => (r.label === null ? [] : [r.label])))];
  return labels
    .map((label) => {
      const rs = rows.filter((r) => r.label === label);
      const sum = (k: "signups" | "activated" | "funded" | "depositTotal") => rs.reduce((a, r) => a + r[k], 0);
      return {
        label,
        signups: sum("signups"),
        activated: sum("activated"),
        funded: sum("funded"),
        depositTotal: Math.round(sum("depositTotal") * 100) / 100,
      };
    })
    .sort((a, b) => b.funded - a.funded || b.signups - a.signups || a.label.localeCompare(b.label));
}

// ---- stages ---------------------------------------------------------------

export const STAGES = ["signed_up", "activated", "upgrade_viewed", "broker_clicked", "submitted", "funded"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  signed_up: "Signed up",
  activated: "Active in the app",
  upgrade_viewed: "Visited the upgrade page",
  broker_clicked: "Clicked the broker link",
  submitted: "Deposit submitted",
  funded: "Funded",
};

export function parseStage(raw: unknown): Stage {
  return (STAGES as readonly unknown[]).includes(raw) ? (raw as Stage) : "signed_up";
}

// ---- clients --------------------------------------------------------------

export interface ClientRow {
  /** ISO date. */
  signedUp: string;
  country: string;
  /** First name + last initial, or null when the person gave no name. */
  display: string | null;
  stage: Stage;
  /** The sponsor's ad that brought them, or null when not traced. */
  adLabel: string | null;
  /** Only once funded with the sponsor's broker. */
  accountNumber: string | null;
  depositTotal: number | null;
}

export function shapeClientRow(raw: Record<string, unknown>): { row: ClientRow; total: number } {
  return {
    total: num(raw.total),
    row: {
      signedUp: typeof raw.signed_up === "string" ? raw.signed_up.slice(0, 10) : "",
      country: typeof raw.country === "string" ? raw.country : "",
      display: str(raw.display),
      stage: parseStage(raw.stage),
      adLabel: str(raw.ad_label),
      accountNumber: str(raw.account_number),
      depositTotal: raw.deposit_total === null || raw.deposit_total === undefined ? null : num(raw.deposit_total),
    },
  };
}

// ---- range and paging -----------------------------------------------------

export const RANGE_PRESETS = ["all", 7, 30, 90] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface SponsorRange {
  since: Date;
  until: Date;
  preset: RangePreset;
}

type Search = Record<string, string | string[] | undefined>;

const DAY = 86_400_000;
/** With no window on file the "whole deal" falls back to 90 days: the page still renders. */
export const FALLBACK_DAYS = 90;

/** `?days=7|30|90` or anything else for the whole deal. */
export function parseSponsorRange(params: Search, dealStart: Date | null, now: Date = new Date()): SponsorRange {
  const n = Number(first(params.days));
  const preset: RangePreset = (RANGE_PRESETS as readonly unknown[]).includes(n) ? (n as RangePreset) : "all";
  if (preset === "all") {
    return { since: dealStart ?? new Date(now.getTime() - FALLBACK_DAYS * DAY), until: now, preset };
  }
  return { since: new Date(now.getTime() - preset * DAY), until: now, preset };
}

export const PER_PAGE = 50;

export function parsePage(raw: string | string[] | undefined): number {
  const n = Number(first(raw));
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

// ---- the RPCs -------------------------------------------------------------

export interface SponsorArgs {
  slug: string;
  since: Date;
  until: Date;
}

/** Call fn_sponsor_funnel. [] on any failure: a sponsor reading zeros at least knows the link works. */
export async function fetchSponsorFunnel(db: FunnelClient, a: SponsorArgs): Promise<SponsorFunnelRow[]> {
  try {
    const { data, error } = await db.rpc("fn_sponsor_funnel", {
      p_slug: a.slug,
      p_since: a.since.toISOString(),
      p_until: a.until.toISOString(),
    });
    if (error) {
      console.error("[sponsors] funnel failed:", error.message);
      return [];
    }
    return Array.isArray(data) ? data.map((r) => shapeFunnelRow(r as Record<string, unknown>)) : [];
  } catch (e) {
    console.error("[sponsors] funnel threw:", e);
    return [];
  }
}

async function clientsRpc(
  db: FunnelClient,
  a: SponsorArgs,
  limit: number,
  offset: number
): Promise<{ rows: ClientRow[]; total: number }> {
  try {
    const { data, error } = await db.rpc("fn_sponsor_clients", {
      p_slug: a.slug,
      p_since: a.since.toISOString(),
      p_until: a.until.toISOString(),
      p_limit: limit,
      p_offset: offset,
    });
    if (error) {
      console.error("[sponsors] clients failed:", error.message);
      return { rows: [], total: 0 };
    }
    const shaped = Array.isArray(data) ? data.map((r) => shapeClientRow(r as Record<string, unknown>)) : [];
    return { rows: shaped.map((s) => s.row), total: shaped[0]?.total ?? 0 };
  } catch (e) {
    console.error("[sponsors] clients threw:", e);
    return { rows: [], total: 0 };
  }
}

export interface ClientsPage {
  rows: ClientRow[];
  total: number;
  page: number;
  pages: number;
}

export async function fetchSponsorClients(db: FunnelClient, a: SponsorArgs & { page: number }): Promise<ClientsPage> {
  const { rows, total } = await clientsRpc(db, a, PER_PAGE, (a.page - 1) * PER_PAGE);
  return { rows, total, page: a.page, pages: Math.max(1, Math.ceil(total / PER_PAGE)) };
}

/** Every row for the CSV, 200 at a time (the SQL cap), up to CSV_ROW_CAP. */
export const CSV_ROW_CAP = 5000;
const CSV_PAGE = 200;

export async function fetchAllSponsorClients(db: FunnelClient, a: SponsorArgs): Promise<ClientRow[]> {
  let out: ClientRow[] = [];
  for (let offset = 0; offset < CSV_ROW_CAP; offset += CSV_PAGE) {
    const { rows } = await clientsRpc(db, a, CSV_PAGE, offset);
    out = [...out, ...rows];
    if (rows.length < CSV_PAGE) break;
  }
  return out.slice(0, CSV_ROW_CAP);
}

// ---- CSV ------------------------------------------------------------------

export const FUNNEL_CSV_COLUMNS = [
  "week",
  "ad",
  "signups",
  "activated",
  "upgrade_viewed",
  "broker_clicked",
  "submitted",
  "funded",
  "deposit_total",
] as const;

export function funnelCsv(rows: SponsorFunnelRow[]): string {
  const lines = [
    FUNNEL_CSV_COLUMNS.join(","),
    ...rows.map((r) =>
      [r.week, r.label ?? "", r.signups, r.activated, r.upgradeViewed, r.brokerClicked, r.submitted, r.funded, r.depositTotal.toFixed(2)]
        .map(csvField)
        .join(",")
    ),
  ];
  // Trailing newline: some importers drop the last row without one.
  return lines.join("\r\n") + "\r\n";
}

export const CLIENTS_CSV_COLUMNS = ["signed_up", "country", "client", "stage", "ad", "account_number", "deposit_total"] as const;

export function clientsCsv(rows: ClientRow[]): string {
  const lines = [
    CLIENTS_CSV_COLUMNS.join(","),
    ...rows.map((r) =>
      [
        r.signedUp,
        r.country,
        r.display ?? "",
        STAGE_LABEL[r.stage],
        r.adLabel ?? "",
        r.accountNumber ?? "",
        r.depositTotal === null ? "" : r.depositTotal.toFixed(2),
      ]
        .map(csvField)
        .join(",")
    ),
  ];
  return lines.join("\r\n") + "\r\n";
}
