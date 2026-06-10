import { createClient } from "@/lib/supabase/server";
import { canGrantRetrial } from "@/lib/trial/admin";
import type { AccountStatus } from "@/lib/trial/status";
import { grantRetrial, verifyDeposit } from "./actions";

// Deliberately plain: a functional table for manual deposit verification and
// re-trial granting. All rules live in the database functions — this page is
// a convenience layer and never the gate.

interface AdminProfileRow {
  id: string;
  email: string;
  account_status: AccountStatus;
  trial_count: number;
  trial_ends_at: string;
  downgraded_at: string | null;
  broker: string | null;
  deposit_amount: number | null;
  deposit_verified_at: string | null;
  deposit_verified_by: string | null;
  ib_link_confirmed: boolean;
  is_admin: boolean;
}

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toISOString().slice(0, 10);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate: signed in AND admin, else render nothing sensitive — no data is
  // fetched on this path. (DB-side, RLS + function checks hold regardless.)
  let isAdmin = false;
  if (user) {
    const { data } = await supabase.rpc("is_admin");
    isAdmin = data === true;
  }

  if (!user || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-obsidian">
        <p className="font-mono text-sm text-muted">Not authorized.</p>
      </main>
    );
  }

  const { ok, error, target } = await searchParams;
  const notice = typeof ok === "string" ? ok : null;
  const failure = typeof error === "string" ? error : null;
  const targetEmail = typeof target === "string" ? target : null;

  const { data: profiles, error: listError } = await supabase
    .from("profiles")
    .select(
      "id, email, account_status, trial_count, trial_ends_at, downgraded_at, broker, deposit_amount, deposit_verified_at, deposit_verified_by, ib_link_confirmed, is_admin"
    )
    .order("created_at", { ascending: true });

  const rows = (profiles ?? []) as AdminProfileRow[];

  return (
    <main className="min-h-screen bg-obsidian px-6 py-10 text-pearl">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-xl font-bold">
          MMFX <span className="text-orange">Admin</span> — Members
        </h1>
        <span className="font-mono text-xs text-muted">{user.email}</span>
      </header>

      {notice && (
        <p className="mb-4 border border-pearl/20 bg-graphite/70 px-3 py-2 font-mono text-xs text-pearl">
          ✓ {notice}
        </p>
      )}
      {failure && (
        <p className="mb-4 border border-orange/60 bg-graphite/70 px-3 py-2 font-mono text-xs text-orange">
          ✕ {targetEmail ? `${targetEmail}: ` : ""}
          {failure}
        </p>
      )}
      {listError && (
        <p className="mb-4 font-mono text-xs text-orange">
          Failed to load profiles: {listError.message}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-pearl/20 text-left uppercase tracking-wider text-muted">
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Trials</th>
              <th className="px-2 py-2">Trial ends</th>
              <th className="px-2 py-2">Downgraded</th>
              <th className="px-2 py-2">Deposit</th>
              <th className="px-2 py-2">Mark deposit</th>
              <th className="px-2 py-2">Re-trial</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const retrialOk = canGrantRetrial(p);
              return (
                <tr key={p.id} className="border-b border-pearl/10 align-top">
                  <td className="px-2 py-3">
                    {p.email}
                    {p.is_admin && (
                      <span className="ml-1 text-orange">(admin)</span>
                    )}
                  </td>
                  <td className="px-2 py-3">{p.account_status}</td>
                  <td className="px-2 py-3">{p.trial_count}</td>
                  <td className="px-2 py-3">{fmt(p.trial_ends_at)}</td>
                  <td className="px-2 py-3">{fmt(p.downgraded_at)}</td>
                  <td className="px-2 py-3">
                    {p.deposit_verified_at
                      ? `$${p.deposit_amount} · ${p.broker} · IB ${
                          p.ib_link_confirmed ? "yes" : "no"
                        } · ${p.deposit_verified_by}`
                      : "—"}
                  </td>
                  <td className="px-2 py-3">
                    {p.account_status === "member_active" ? (
                      <span className="text-muted">member</span>
                    ) : (
                      <form action={verifyDeposit} className="flex flex-wrap items-center gap-1.5">
                        <input type="hidden" name="target_user_id" value={p.id} />
                        <input type="hidden" name="target_email" value={p.email} />
                        <select
                          name="broker"
                          required
                          defaultValue=""
                          className="border border-pearl/20 bg-graphite px-1.5 py-1"
                        >
                          <option value="" disabled>
                            broker
                          </option>
                          <option value="octa">octa</option>
                          <option value="dupoin">dupoin</option>
                        </select>
                        <input
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="amount"
                          className="w-20 border border-pearl/20 bg-graphite px-1.5 py-1"
                        />
                        <label className="flex items-center gap-1 text-muted">
                          <input name="ib_confirmed" type="checkbox" /> IB
                        </label>
                        <button
                          type="submit"
                          className="border border-orange/60 px-2 py-1 text-orange hover:bg-orange hover:text-black"
                        >
                          Verify
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {retrialOk ? (
                      <form action={grantRetrial}>
                        <input type="hidden" name="target_user_id" value={p.id} />
                        <input type="hidden" name="target_email" value={p.email} />
                        <button
                          type="submit"
                          className="border border-pearl/30 px-2 py-1 hover:border-orange hover:text-orange"
                        >
                          Grant re-trial
                        </button>
                      </form>
                    ) : (
                      <span className="text-muted">
                        {p.account_status === "trial_expired"
                          ? "not eligible"
                          : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-muted">
                  No profiles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
