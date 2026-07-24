import { redirect } from "next/navigation";
import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { serviceClient } from "@/lib/journal/api";
import { loadBrokers } from "@/lib/journal/ibBrokers";
import { loadMemberAudit, LOW_BALANCE_THRESHOLD } from "@/lib/journal/ibMemberAudit";
import { IbAdmin } from "./IbAdmin";

export default async function JournalIbPage() {
  const profile = await requireFull();
  if (!profile.is_admin) redirect("/dashboard");

  const svc = serviceClient();
  const brokers = await loadBrokers(svc);
  const { data: flagged } = await svc
    .from("journal_accounts")
    .select(
      "id, mt5_login, broker_id, broker_server, balance, currency, last_synced_at"
    )
    .eq("ib_review", "flagged");

  const memberAudit = await loadMemberAudit(svc);

  return (
    <AppShell
      email={profile.email}
      accountStatus={profile.account_status}
      tier="Full"
      isAdmin
    >
      <IbAdmin
        brokers={brokers.map((b) => ({
          id: b.id,
          name: b.display_name,
          mode: b.enforcement_mode,
          updatedAt: b.allowlist_updated_at,
        }))}
        flagged={flagged ?? []}
        memberAudit={memberAudit}
        lowBalanceThreshold={LOW_BALANCE_THRESHOLD}
      />
    </AppShell>
  );
}
