import { requireFull } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { headlineStats } from "@/lib/journal/metrics";
import type {
  JournalAccountRow,
  JournalGoalsRow,
  JournalTradeRow,
} from "@/lib/journal/types";
import { JournalDashboard } from "./JournalDashboard";

// AI Trading Journal — Phase 1 dashboard. Server component: gate, fetch own
// rows (RLS-scoped), derive headline stats, render the client dashboard.
//
// Phase 1 computes stats over the most recent closed trades (cap below);
// Phase 2 moves aggregates into SQL when the analytics engine lands.

const TRADES_CAP = 500;

export default async function JournalPage() {
  const profile = await requireFull();
  const supabase = await createClient();

  const [{ data: accounts }, { data: closedTrades }, { data: openTrades }, { data: goals }] =
    await Promise.all([
      supabase
        .from("journal_accounts")
        .select()
        .neq("state", "disconnected")
        .order("created_at", { ascending: true }),
      supabase
        .from("journal_trades")
        .select()
        .eq("status", "closed")
        .order("close_time", { ascending: false })
        .limit(TRADES_CAP),
      supabase
        .from("journal_trades")
        .select()
        .eq("status", "open")
        .order("open_time", { ascending: false })
        .limit(50),
      supabase.from("journal_goals").select().maybeSingle(),
    ]);

  const stats = headlineStats((closedTrades ?? []) as JournalTradeRow[]);

  return (
    <AppShell
      email={profile.email}
      accountStatus={profile.account_status}
      tier="Full"
    >
      <JournalDashboard
        accounts={(accounts ?? []) as JournalAccountRow[]}
        closedTrades={(closedTrades ?? []) as JournalTradeRow[]}
        openTrades={(openTrades ?? []) as JournalTradeRow[]}
        goals={(goals ?? null) as JournalGoalsRow | null}
        stats={stats}
      />
    </AppShell>
  );
}
