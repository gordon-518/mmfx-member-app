import { requireFull } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { computeAnalytics } from "@/lib/journal/analytics";
import type {
  JournalAccountRow,
  JournalCashFlowRow,
  JournalGoalsRow,
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
  const supabase = await createClient();

  const [{ data: accounts }, { data: trades }, { data: cashFlows }, { data: goals }] =
    await Promise.all([
      supabase
        .from("journal_accounts")
        .select()
        .neq("state", "disconnected")
        .order("created_at", { ascending: true }),
      supabase
        .from("journal_trades")
        .select()
        .order("close_time", { ascending: false, nullsFirst: true })
        .limit(TRADES_CAP),
      supabase.from("journal_cash_flows").select(),
      supabase.from("journal_goals").select().maybeSingle(),
    ]);

  const allTrades = (trades ?? []) as JournalTradeRow[];
  const analytics = computeAnalytics(
    allTrades,
    (cashFlows ?? []) as JournalCashFlowRow[]
  );

  return (
    <AppShell
      email={profile.email}
      accountStatus={profile.account_status}
      tier="Full"
    >
      <JournalDashboard
        accounts={(accounts ?? []) as JournalAccountRow[]}
        trades={allTrades}
        goals={(goals ?? null) as JournalGoalsRow | null}
        analytics={analytics}
        currency={(accounts ?? [])[0]?.currency ?? null}
      />
    </AppShell>
  );
}
