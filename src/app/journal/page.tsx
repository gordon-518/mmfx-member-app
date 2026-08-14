import { redirect } from "next/navigation";
import { requireFull } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { computeAnalytics } from "@/lib/journal/analytics";
import { detectLeaks } from "@/lib/journal/leaks";
import { accountHealth } from "@/lib/journal/health";
import { evaluateRules } from "@/lib/journal/rules";
import {
  decideInterventions,
  type InterventionSignals,
} from "@/lib/journal/interventions";
import { computeGameState } from "@/lib/journal/gamification";
import { DAILY_REPORT_CAP } from "@/lib/journal/coach";
import type {
  JournalAccountRow,
  JournalCashFlowRow,
  JournalGoalsRow,
  JournalReportRow,
  JournalRulesConfig,
  JournalTradeRow,
} from "@/lib/journal/types";
import { JournalDashboard } from "./JournalDashboard";

// AI Trading Journal — Phase 2 dashboard. Server component: gate, fetch own
// rows (RLS-scoped), compute the full analytics set (pure), render the client
// dashboard. Analytics run over the most recent closed trades (cap below);
// when history grows past that, we move the aggregates into SQL.

const TRADES_CAP = 1000;

export default async function JournalPage() {
  const profile = await requireFull();
  // Members-only benefit (admins allowed for support). Trials → upgrade.
  if (profile.account_status !== "member_active" && !profile.is_admin) {
    redirect("/upgrade");
  }
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("journal_accounts")
    .select()
    .neq("state", "disconnected")
    .order("created_at", { ascending: true });

  // Scope every trade-derived query to the CURRENTLY-CONNECTED accounts.
  // Disconnect is a soft delete that keeps history (the journal_trades /
  // journal_cash_flows rows remain), so without this filter a disconnected
  // account's trades keep feeding leaks/coach/performance/rules after the trader
  // switches to a different account. The sentinel id keeps the query well-typed
  // and empty when nothing is connected.
  const accountIds = (accounts ?? []).map((a) => a.id as string);
  const scopeIds = accountIds.length
    ? accountIds
    : ["00000000-0000-0000-0000-000000000000"];

  const [
    { data: trades },
    { data: cashFlows },
    { data: goals },
    { data: rulesRow },
    { data: report },
  ] = await Promise.all([
    supabase
      .from("journal_trades")
      .select()
      .in("account_id", scopeIds)
      .order("close_time", { ascending: false, nullsFirst: true })
      .limit(TRADES_CAP),
    supabase.from("journal_cash_flows").select().in("account_id", scopeIds),
    supabase.from("journal_goals").select().maybeSingle(),
    supabase.from("journal_rules").select().maybeSingle(),
    supabase
      .from("journal_reports")
      .select()
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // The coach report is per-user (not per-account), so after switching to a new
  // account an earlier report is stale. Surface it only if it was generated at
  // or after the newest connected account — otherwise fall back to the Generate
  // prompt. (Quota below still uses the raw report so switching accounts cannot
  // mint fresh daily generations.)
  const newestAccountAt = (accounts ?? []).reduce<string | null>(
    (max, a) =>
      max == null || (a.created_at as string) > max ? (a.created_at as string) : max,
    null
  );
  const freshReport =
    report && (!newestAccountAt || (report.created_at as string) >= newestAccountAt)
      ? report
      : null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const usedToday =
    report && report.report_date === todayStr ? report.gen_count : 0;
  const reportsRemaining = Math.max(0, DAILY_REPORT_CAP - usedToday);

  const allTrades = (trades ?? []) as JournalTradeRow[];
  const cf = (cashFlows ?? []) as JournalCashFlowRow[];
  // Total balance across connected accounts — the fallback basis for drawdown %
  // when there are no BALANCE cash flows (credit/demo/prop accounts).
  const accountBalance =
    (accounts ?? []).reduce((s, acc) => s + (acc.balance ?? 0), 0) || null;
  const analytics = computeAnalytics(allTrades, cf, { currentBalance: accountBalance });

  // Survival Engine (Layer 1): leaks over the last 90d, health over full history.
  const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const trades90 = allTrades.filter(
    (t) => t.status === "closed" && t.close_time && t.close_time >= ninetyAgo
  );
  const leaks = detectLeaks(
    trades90,
    (goals ?? null) as JournalGoalsRow | null,
    computeAnalytics(trades90, cf, { currentBalance: accountBalance })
  );
  const health = accountHealth(
    allTrades,
    analytics,
    (goals ?? null) as JournalGoalsRow | null,
    leaks.leaks.length
  );

  // Survival Engine (Layer 2): discipline rules over the last 30d.
  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const rulesConfig = (rulesRow?.config ?? {}) as JournalRulesConfig;
  const rules = evaluateRules(
    allTrades.filter(
      (t) => t.status === "closed" && t.close_time && t.close_time >= thirtyAgo
    ),
    rulesConfig,
    (goals ?? null) as JournalGoalsRow | null,
    analytics.startingBalance
  );

  // Survival Engine (Layer 3): proactive interventions (banner surface).
  const closedAll = allTrades.filter((t) => t.status === "closed" && t.close_time);
  const lastTradeAt = closedAll.reduce<string | null>(
    (max, t) =>
      max == null || (t.close_time as string) > max ? (t.close_time as string) : max,
    null
  );
  const interventionSignals: InterventionSignals = {
    health,
    leaks,
    rules,
    lastTradeAt,
    hasClosedTrades: closedAll.length > 0,
  };
  const interventions = decideInterventions(
    interventionSignals,
    new Date().toISOString()
  );

  // Game state (score/streak/XP/level) + this-month P&L for the hero.
  const game = computeGameState({
    analytics,
    rulesConfig,
    goals: (goals ?? null) as JournalGoalsRow | null,
    trades: allTrades,
    now: new Date().toISOString(),
  });
  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthClosed = allTrades.filter(
    (t) =>
      t.status === "closed" &&
      t.close_time &&
      (t.close_time as string).slice(0, 7) === monthKey
  );
  const monthNet = monthClosed.reduce((s, t) => s + t.net_profit, 0);
  // First name only; fall back to no name (just "Good evening") rather than
  // showing a raw email address.
  const profileName = profile.full_name?.trim()
    ? profile.full_name.trim().split(" ")[0]
    : null;

  return (
    <AppShell
      email={profile.email}
      accountStatus={profile.account_status}
      tier="Full"
      isAdmin
    >
      <JournalDashboard
        accounts={(accounts ?? []) as JournalAccountRow[]}
        trades={allTrades}
        cashFlows={cf}
        goals={(goals ?? null) as JournalGoalsRow | null}
        analytics={analytics}
        leaks={leaks}
        health={health}
        rules={rules}
        rulesConfig={rulesConfig}
        interventions={interventions}
        game={game}
        monthNet={monthNet}
        monthCount={monthClosed.length}
        profileName={profileName}
        report={(freshReport ?? null) as JournalReportRow | null}
        reportsRemaining={reportsRemaining}
        reportCap={DAILY_REPORT_CAP}
        currency={(accounts ?? [])[0]?.currency ?? null}
        accountBalance={accountBalance}
      />
    </AppShell>
  );
}
