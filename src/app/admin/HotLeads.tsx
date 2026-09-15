// Hot leads (conversion-fix 5.5): activated users (TradingView connected +
// Daily Analysis viewed) with 3+ active days who viewed /upgrade but never
// submitted a deposit. A working list for manual WhatsApp follow-up; the data
// comes from the admin-only fn_admin_hot_leads().

export interface HotLead {
  user_id: string;
  email: string;
  full_name: string | null;
  country: string | null;
  account_status: string;
  signup_at: string;
  active_days: number;
  upgrade_views: number;
  last_seen: string | null;
}

function day(ts: string | null): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : "—";
}

export function HotLeads({ leads }: { leads: HotLead[] }) {
  return (
    <section className="mt-4 rounded-xl border border-line bg-card/60 p-4">
      <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">
        Hot leads <span className="text-orange">·</span> {leads.length}
      </h2>
      <p className="mt-1 text-[12px] text-subtle">
        Connected TradingView, watched Daily Analysis, active on 3+ days and viewed the upgrade page, but no
        deposit submitted yet. Most recent first.
      </p>
      {leads.length === 0 ? (
        <p className="mt-2 text-[13px] text-subtle">No one matches yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wide text-faint">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Member</th>
                <th className="px-2 py-1.5 font-semibold">Status</th>
                <th className="px-2 py-1.5 font-semibold">Country</th>
                <th className="px-2 py-1.5 font-semibold">Active days</th>
                <th className="px-2 py-1.5 font-semibold">Upgrade views</th>
                <th className="px-2 py-1.5 font-semibold">Signed up</th>
                <th className="px-2 py-1.5 font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.user_id} className="border-t border-line">
                  <td className="px-2 py-1.5 text-ink">
                    {l.email}
                    {l.full_name ? <span className="text-subtle"> · {l.full_name}</span> : null}
                  </td>
                  <td className="px-2 py-1.5 text-subtle">{l.account_status}</td>
                  <td className="px-2 py-1.5 text-subtle">{l.country ?? "—"}</td>
                  <td className="px-2 py-1.5 font-semibold text-ink">{l.active_days}</td>
                  <td className="px-2 py-1.5 text-ink">{l.upgrade_views}</td>
                  <td className="px-2 py-1.5 text-subtle">{day(l.signup_at)}</td>
                  <td className="px-2 py-1.5 text-subtle">{day(l.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
