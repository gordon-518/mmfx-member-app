import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAnalytics, type JournalAnalytics } from "./analytics";
import type {
  CoachReport,
  CoachStatus,
  JournalCashFlowRow,
  JournalGoalsRow,
  JournalTradeRow,
} from "./types";

// Phase 3 — the AI coach. Turns the computed analytics + behavioural signals +
// the trader's goals and annotated trades into a structured coaching report
// (summary, on-track status, good/bad habits, trade-management tips) via the
// Anthropic API. Follows the raw-fetch, best-effort convention of
// src/lib/growth/narrative.ts.
//
// behavioralSignals + buildReportPrompt are PURE and unit-tested; only
// generateReport touches the network.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Haiku 4.5 — cheap enough to run per-user daily at scale (~$0.005/report),
// and the same tier the growth narrative uses. Bump to a stronger model here
// if you decide coaching depth is worth the per-user cost.
const MODEL = "claude-haiku-4-5";

const RISKY_EMOTIONS = new Set(["revenge", "fomo", "greed", "fear"]);
const OVERTRADING_THRESHOLD = 5;

export interface BehavioralSignals {
  closedCount: number;
  emotionCounts: Record<string, number>;
  /** Share of emotion-tagged trades that carried a risky emotion. */
  riskyEmotionRate: number | null;
  /** Share of trades on symbols outside the trader's stated instruments. */
  offInstrumentRate: number | null;
  avgSizeAfterWin: number | null;
  avgSizeAfterLoss: number | null;
  maxTradesInDay: number;
  /** Days with more than OVERTRADING_THRESHOLD trades. */
  overtradingDays: number;
  annotatedCount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Concrete behaviour signals that ground the AI's habit detection. Pure. */
export function behavioralSignals(
  allTrades: JournalTradeRow[],
  goals: JournalGoalsRow | null
): BehavioralSignals {
  const closed = allTrades
    .filter((t) => t.status === "closed")
    .sort((a, b) => new Date(a.open_time ?? 0).getTime() - new Date(b.open_time ?? 0).getTime());

  const emotionCounts: Record<string, number> = {};
  let risky = 0;
  let withEmotion = 0;
  for (const t of closed) {
    if (t.emotion) {
      emotionCounts[t.emotion] = (emotionCounts[t.emotion] ?? 0) + 1;
      withEmotion += 1;
      if (RISKY_EMOTIONS.has(t.emotion)) risky += 1;
    }
  }

  const instruments = goals?.instruments?.map((i) => i.toUpperCase()) ?? null;
  const offInstrument =
    instruments && instruments.length
      ? closed.filter((t) => !instruments.includes(t.symbol.toUpperCase())).length
      : null;

  // Sizing after a win vs after a loss — reveals revenge sizing.
  const afterWin: number[] = [];
  const afterLoss: number[] = [];
  for (let i = 1; i < closed.length; i++) {
    const prev = closed[i - 1].net_profit;
    if (prev > 0) afterWin.push(closed[i].volume);
    else if (prev < 0) afterLoss.push(closed[i].volume);
  }
  const mean = (a: number[]) =>
    a.length ? round2(a.reduce((s, v) => s + v, 0) / a.length) : null;

  // Trades per UTC day.
  const perDay = new Map<string, number>();
  for (const t of closed) {
    const day = (t.open_time ?? "").slice(0, 10);
    if (day) perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const counts = [...perDay.values()];

  const annotated = closed.filter((t) => t.note || t.emotion || (t.tags && t.tags.length));

  return {
    closedCount: closed.length,
    emotionCounts,
    riskyEmotionRate: withEmotion ? round2(risky / withEmotion) : null,
    offInstrumentRate:
      offInstrument === null ? null : round2(offInstrument / (closed.length || 1)),
    avgSizeAfterWin: mean(afterWin),
    avgSizeAfterLoss: mean(afterLoss),
    maxTradesInDay: counts.length ? Math.max(...counts) : 0,
    overtradingDays: counts.filter((c) => c > OVERTRADING_THRESHOLD).length,
    annotatedCount: annotated.length,
  };
}

function pct(frac: number | null): string {
  return frac == null ? "n/a" : `${Math.round(frac * 100)}%`;
}

export interface ReportContext {
  analytics: JournalAnalytics;
  signals: BehavioralSignals;
  goals: JournalGoalsRow | null;
  sampleTrades: JournalTradeRow[];
}

/** Build the numbers-and-notes prompt fed to the model. Pure. */
export function buildReportPrompt(ctx: ReportContext): string {
  const { analytics: a, signals: s, goals, sampleTrades } = ctx;

  const goalLines = goals
    ? [
        `- Style: ${goals.style ?? "unspecified"}`,
        `- Monthly target: ${goals.monthly_target_pct ?? "n/a"}%`,
        `- Max drawdown tolerance: ${goals.max_drawdown_pct ?? "n/a"}%`,
        `- Risk per trade: ${goals.risk_per_trade_pct ?? "n/a"}%`,
        `- Instruments: ${goals.instruments?.join(", ") || "n/a"}`,
        `- In their words, working on: "${goals.focus_text ?? "not stated"}"`,
      ]
    : ["- The trader has not set goals yet."];

  const topSymbols = a.bySymbol
    .slice(0, 4)
    .map((b) => `${b.symbol} (${b.count} trades, ${Math.round(b.winRate * 100)}% win, net ${b.netProfit})`)
    .join("; ");
  const bySession = a.bySession
    .map((b) => `${b.key}: net ${b.netProfit} over ${b.count}`)
    .join("; ");

  const annotated = sampleTrades
    .filter((t) => t.note || t.emotion)
    .slice(0, 15)
    .map(
      (t) =>
        `  • ${t.symbol} ${t.direction} · net ${t.net_profit}` +
        `${t.emotion ? ` · felt ${t.emotion}` : ""}` +
        `${t.note ? ` · "${t.note}"` : ""}`
    )
    .join("\n");

  return [
    "You are an elite trading coach reviewing one trader's recent performance.",
    "Be direct, specific and grounded ONLY in the data below — never invent numbers or trades.",
    "Lead with what matters most for THIS trader's stated goals. Judge habits against their own plan,",
    "not a generic ideal (a 1:1 scalper and a 1:5 swing trader are judged differently).",
    "",
    "THEIR GOALS:",
    ...goalLines,
    "",
    "PERFORMANCE (closed trades):",
    `- Net P&L: ${a.netProfit} over ${a.closedCount} trades (${a.openCount} still open)`,
    `- Win rate: ${pct(a.winRate)} · profit factor: ${a.profitFactor ?? "n/a"}`,
    `- Realized payoff (avg win / avg loss): ${a.payoffRatio ?? "n/a"} · expectancy/trade: ${a.expectancy ?? "n/a"}`,
    `- Avg win: ${a.avgWin ?? "n/a"} · avg loss: ${a.avgLoss ?? "n/a"} · best: ${a.largestWin} · worst: ${a.largestLoss}`,
    `- Max drawdown: ${a.maxDrawdown}${a.maxDrawdownPct != null ? ` (${pct(a.maxDrawdownPct)})` : ""}`,
    `- Streaks: longest ${a.longestWinStreak}W / ${a.longestLossStreak}L · current ${a.currentStreak}`,
    `- Avg position size: ${a.avgLots ?? "n/a"} lots · max concurrent open: ${a.maxConcurrentOpen} · avg hold: ${a.avgDurationSec ?? "n/a"}s`,
    `- By symbol: ${topSymbols || "n/a"}`,
    `- By session: ${bySession || "n/a"}`,
    "",
    "BEHAVIOURAL SIGNALS:",
    `- Emotions logged: ${JSON.stringify(s.emotionCounts)} · risky-emotion rate: ${pct(s.riskyEmotionRate)}`,
    `- Avg size after a WIN: ${s.avgSizeAfterWin ?? "n/a"} lots · after a LOSS: ${s.avgSizeAfterLoss ?? "n/a"} lots ` +
      `(bigger after losses = revenge sizing)`,
    `- Off-instrument rate (outside stated instruments): ${pct(s.offInstrumentRate)}`,
    `- Busiest day: ${s.maxTradesInDay} trades · overtrading days: ${s.overtradingDays}`,
    "",
    annotated ? `THEIR OWN NOTES ON RECENT TRADES:\n${annotated}` : "No trade notes logged yet.",
    "",
    "Write a coaching report as JSON with: a 3-5 sentence `summary` (lead with the single most",
    "important thing, reference their goals), a `status` of ahead|on_track|behind|at_risk vs their",
    "targets, 2-5 `habits` (mix of good and bad, each grounded in a specific number or note above),",
    "and 2-4 concrete, actionable `tips` on trade management. No preamble.",
  ].join("\n");
}

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["ahead", "on_track", "behind", "at_risk"] },
    habits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["good", "bad"] },
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["kind", "title", "detail"],
        additionalProperties: false,
      },
    },
    tips: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "status", "habits", "tips"],
  additionalProperties: false,
} as const;

/**
 * Generate a coaching report via Anthropic. Best-effort: returns null on any
 * failure (missing key, network, bad JSON) so a failed report never breaks the
 * cron run — exactly like growth/narrative.ts.
 */
export async function generateReport(
  ctx: ReportContext
): Promise<{ report: CoachReport; model: string } | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        messages: [{ role: "user", content: buildReportPrompt(ctx) }],
        output_config: { format: { type: "json_schema", schema: REPORT_SCHEMA } },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
    };
    if (data.stop_reason === "refusal") return null;

    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("");
    if (!text) return null;

    const parsed = JSON.parse(text) as CoachReport;
    if (!parsed.summary || !Array.isArray(parsed.habits)) return null;

    // Defensive clamps — schema can't cap array/string length.
    const report: CoachReport = {
      summary: parsed.summary.slice(0, 1500),
      status: (["ahead", "on_track", "behind", "at_risk"].includes(parsed.status)
        ? parsed.status
        : "on_track") as CoachStatus,
      habits: parsed.habits.slice(0, 6).map((h) => ({
        kind: h.kind === "good" ? "good" : "bad",
        title: String(h.title).slice(0, 120),
        detail: String(h.detail).slice(0, 400),
      })),
      tips: (parsed.tips ?? []).slice(0, 5).map((t) => String(t).slice(0, 300)),
    };
    return { report, model: MODEL };
  } catch {
    return null;
  }
}

// --- DB orchestration (used by the on-demand generate route) ----------------

const TRADES_CAP = 1000;

/** Max click-to-generate coaching reports per user per day. */
export const DAILY_REPORT_CAP = 5;

/** Gather everything the coach needs for one user. Null if nothing to report. */
export async function loadReportContext(
  db: SupabaseClient,
  userId: string
): Promise<ReportContext | null> {
  const { data: accounts } = await db
    .from("journal_accounts")
    .select("id")
    .eq("user_id", userId);
  const accountIds = (accounts ?? []).map((a) => a.id as string);

  const [{ data: trades }, { data: cashFlows }, { data: goals }] = await Promise.all([
    db
      .from("journal_trades")
      .select()
      .eq("user_id", userId)
      .order("close_time", { ascending: false, nullsFirst: true })
      .limit(TRADES_CAP),
    accountIds.length
      ? db.from("journal_cash_flows").select().in("account_id", accountIds)
      : Promise.resolve({ data: [] as JournalCashFlowRow[] }),
    db.from("journal_goals").select().eq("user_id", userId).maybeSingle(),
  ]);

  const allTrades = (trades ?? []) as JournalTradeRow[];
  if (!allTrades.some((t) => t.status === "closed")) return null;

  const analytics = computeAnalytics(
    allTrades,
    (cashFlows ?? []) as JournalCashFlowRow[]
  );
  return {
    analytics,
    signals: behavioralSignals(allTrades, (goals ?? null) as JournalGoalsRow | null),
    goals: (goals ?? null) as JournalGoalsRow | null,
    sampleTrades: allTrades,
  };
}

