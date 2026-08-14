import { redirect } from "next/navigation";
import { requireFull } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import type { JournalGoalsRow } from "@/lib/journal/types";
import { serviceClient } from "@/lib/journal/api";
import { loadBrokers } from "@/lib/journal/ibBrokers";
import { ConnectWizard } from "./ConnectWizard";

// /journal/connect — two-step wizard: ① MT5 credentials → ② goals.
// ?step=goals deep-links straight to the goals step (used by the dashboard's
// "Edit goals" link).

export default async function JournalConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const profile = await requireFull();
  if (profile.account_status !== "member_active" && !profile.is_admin) {
    redirect("/upgrade");
  }
  const { step } = await searchParams;

  const supabase = await createClient();
  const { data: goals } = await supabase
    .from("journal_goals")
    .select()
    .maybeSingle();

  const brokers = await loadBrokers(serviceClient());

  return (
    <AppShell
      email={profile.email}
      accountStatus={profile.account_status}
      tier="Full"
      isAdmin
    >
      <ConnectWizard
        initialStep={step === "goals" ? "goals" : "credentials"}
        initialGoals={(goals ?? null) as JournalGoalsRow | null}
        tradingAccountNumber={profile.trading_account_number}
        brokers={brokers.map((b) => ({ id: b.id, name: b.display_name }))}
      />
    </AppShell>
  );
}
