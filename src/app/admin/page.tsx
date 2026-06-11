import { createClient } from "@/lib/supabase/server";
import { canGrantRetrial } from "@/lib/trial/admin";
import type { AccountStatus } from "@/lib/trial/status";
import { grantRetrial, updateMember, verifyDeposit } from "./actions";
import {
  addDailyAnalysis,
  addLiveClass,
  deleteDailyAnalysis,
  deleteLiveClass,
} from "./contentActions";

interface AnalysisRow {
  id: string;
  published_on: string;
  title: string;
  gumlet_id: string;
  description: string | null;
  bias: string | null;
  session_tag: string | null;
  is_published: boolean;
  cover_path: string | null;
  report_path: string | null;
}

interface ClassRow {
  id: string;
  starts_at: string;
  title: string;
  zoom_url: string;
}

function fmtDateTime(ts: string): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

// Deliberately plain: a functional table for manual deposit verification and
// re-trial granting. All rules live in the database functions — this page is
// a convenience layer and never the gate.

const STATUSES = [
  "trial_active",
  "trial_expired",
  "member_active",
  "re_trial_active",
  "re_trial_expired",
] as const;

const BROKERS = ["octa", "dupoin", "elev8"] as const;

interface AdminProfileRow {
  id: string;
  email: string;
  account_status: AccountStatus;
  trial_count: number;
  trial_ends_at: string | null;
  downgraded_at: string | null;
  broker: string | null;
  deposit_amount: number | null;
  deposit_verified_at: string | null;
  deposit_verified_by: string | null;
  ib_link_confirmed: boolean;
  is_admin: boolean;
  tradingview_username: string | null;
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

  const { ok, error, target, q, status, broker, content_ok, content_error } =
    await searchParams;
  const notice =
    typeof ok === "string"
      ? ok
      : typeof content_ok === "string"
        ? content_ok
        : null;
  const failure =
    typeof error === "string"
      ? error
      : typeof content_error === "string"
        ? content_error
        : null;
  const targetEmail = typeof target === "string" ? target : null;
  const emailQuery = typeof q === "string" ? q.trim() : "";
  // Allowlist filter params — the <select>s are not a trust boundary.
  const statusFilter =
    typeof status === "string" && (STATUSES as readonly string[]).includes(status)
      ? status
      : "";
  const brokerFilter =
    typeof broker === "string" && (BROKERS as readonly string[]).includes(broker)
      ? broker
      : "";

  let query = supabase
    .from("profiles")
    .select(
      "id, email, account_status, trial_count, trial_ends_at, downgraded_at, broker, deposit_amount, deposit_verified_at, deposit_verified_by, ib_link_confirmed, is_admin, tradingview_username"
    )
    .order("created_at", { ascending: true });

  if (emailQuery) {
    // Escape the chars PostgREST treats as LIKE wildcards.
    query = query.ilike(
      "email",
      `%${emailQuery.replace(/[%_\\]/g, "\\$&")}%`
    );
  }
  if (statusFilter) query = query.eq("account_status", statusFilter);
  if (brokerFilter) query = query.eq("broker", brokerFilter);

  const { data: profiles, error: listError } = await query;

  const rows = (profiles ?? []) as AdminProfileRow[];

  // Admin-managed content (admin sees all rows via the is_admin policy).
  const { data: analysisData } = await supabase
    .from("daily_analysis")
    .select(
      "id, published_on, title, gumlet_id, description, bias, session_tag, is_published, cover_path, report_path"
    )
    .order("published_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  const analysisRows = (analysisData ?? []) as AnalysisRow[];

  const { data: classData } = await supabase
    .from("live_classes")
    .select("id, starts_at, title, zoom_url")
    .order("starts_at", { ascending: true })
    .limit(50);
  const classRows = (classData ?? []) as ClassRow[];

  // Threaded through action forms so a verify/grant keeps the current view.
  const hiddenFilters = (
    <>
      {emailQuery && <input type="hidden" name="filter_q" value={emailQuery} />}
      {statusFilter && (
        <input type="hidden" name="filter_status" value={statusFilter} />
      )}
      {brokerFilter && (
        <input type="hidden" name="filter_broker" value={brokerFilter} />
      )}
    </>
  );

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

      {/* Search + filters (GET — state lives in the URL) */}
      <form
        method="get"
        action="/admin"
        className="mb-5 flex flex-wrap items-center gap-2 font-mono text-xs"
      >
        <input
          type="search"
          name="q"
          defaultValue={emailQuery}
          placeholder="search email…"
          className="w-56 border border-pearl/20 bg-graphite px-2 py-1.5 placeholder:text-muted/60"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="border border-pearl/20 bg-graphite px-2 py-1.5"
        >
          <option value="">status: all</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="broker"
          defaultValue={brokerFilter}
          className="border border-pearl/20 bg-graphite px-2 py-1.5"
        >
          <option value="">broker: all</option>
          {BROKERS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border border-orange/60 px-3 py-1.5 text-orange hover:bg-orange hover:text-black"
        >
          Search
        </button>
        {(emailQuery || statusFilter || brokerFilter) && (
          <a href="/admin" className="px-2 py-1.5 text-muted hover:text-pearl">
            clear
          </a>
        )}
        <span className="ml-auto text-muted">
          {rows.length} result{rows.length === 1 ? "" : "s"}
        </span>
      </form>

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
              <th className="px-2 py-2">TradingView</th>
              <th className="px-2 py-2">Mark deposit</th>
              <th className="px-2 py-2">Re-trial</th>
              <th className="px-2 py-2">Edit</th>
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
                    {p.tradingview_username ? (
                      <span className="text-pearl">{p.tradingview_username}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {p.account_status === "member_active" ? (
                      <span className="text-muted">member</span>
                    ) : (
                      <form action={verifyDeposit} className="flex flex-wrap items-center gap-1.5">
                        <input type="hidden" name="target_user_id" value={p.id} />
                        <input type="hidden" name="target_email" value={p.email} />
                        {hiddenFilters}
                        <select
                          name="broker"
                          required
                          defaultValue=""
                          className="border border-pearl/20 bg-graphite px-1.5 py-1"
                        >
                          <option value="" disabled>
                            broker
                          </option>
                          {BROKERS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                        <input
                          name="amount"
                          type="number"
                          step="0.01"
                          min="500"
                          defaultValue="500"
                          required
                          placeholder="min 500"
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
                        {hiddenFilters}
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
                  <td className="px-2 py-3">
                    {/* Manual override editor — bypasses the deposit/re-trial
                        business rules by design. Empty fields = unchanged. */}
                    <details>
                      <summary className="cursor-pointer text-muted hover:text-orange">
                        edit
                      </summary>
                      <form
                        action={updateMember}
                        className="mt-2 flex w-44 flex-col gap-1.5 border border-pearl/15 bg-graphite/70 p-2"
                      >
                        <input type="hidden" name="target_user_id" value={p.id} />
                        <input type="hidden" name="target_email" value={p.email} />
                        {hiddenFilters}
                        <label className="text-muted">
                          status
                          <select
                            name="status"
                            defaultValue=""
                            className="mt-0.5 w-full border border-pearl/20 bg-graphite px-1.5 py-1"
                          >
                            <option value="">(unchanged)</option>
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-muted">
                          broker
                          <select
                            name="broker"
                            defaultValue=""
                            className="mt-0.5 w-full border border-pearl/20 bg-graphite px-1.5 py-1"
                          >
                            <option value="">(unchanged)</option>
                            {BROKERS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-muted">
                          trial ends
                          <input
                            type="date"
                            name="trial_ends_at"
                            className="mt-0.5 w-full border border-pearl/20 bg-graphite px-1.5 py-1"
                          />
                        </label>
                        <label className="text-muted">
                          trial count
                          <select
                            name="trial_count"
                            defaultValue=""
                            className="mt-0.5 w-full border border-pearl/20 bg-graphite px-1.5 py-1"
                          >
                            <option value="">(unchanged)</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                          </select>
                        </label>
                        <button
                          type="submit"
                          className="mt-1 border border-orange/60 px-2 py-1 text-orange hover:bg-orange hover:text-black"
                        >
                          Save
                        </button>
                      </form>
                    </details>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-2 py-6 text-muted">
                  No profiles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Daily Analysis — admin add / list / delete                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-12">
        <h2 className="mb-4 font-display text-lg font-bold">
          Daily <span className="text-orange">Analysis</span>
        </h2>
        <form
          action={addDailyAnalysis}
          className="mb-5 flex flex-wrap items-end gap-2 font-mono text-xs"
        >
          <label className="flex flex-col gap-1 text-muted">
            published on
            <input type="date" name="published_on" className="border border-pearl/20 bg-graphite px-2 py-1.5 text-pearl" />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            title
            <input name="title" required placeholder="title" className="w-56 border border-pearl/20 bg-graphite px-2 py-1.5 text-pearl placeholder:text-muted/50" />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            gumlet id / url
            <input name="gumlet_id" required placeholder="gumlet id or embed url" className="w-48 border border-pearl/20 bg-graphite px-2 py-1.5 text-pearl placeholder:text-muted/50" />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            session
            <input name="session_tag" defaultValue="London" placeholder="London" className="w-28 border border-pearl/20 bg-graphite px-2 py-1.5 text-pearl placeholder:text-muted/50" />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            bias
            <select name="bias" defaultValue="" className="border border-pearl/20 bg-graphite px-2 py-1.5 text-pearl">
              <option value="">none</option>
              <option value="bullish">bullish</option>
              <option value="bearish">bearish</option>
              <option value="neutral">neutral</option>
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-muted">
            description
            <input name="description" placeholder="optional description" className="min-w-48 border border-pearl/20 bg-graphite px-2 py-1.5 text-pearl placeholder:text-muted/50" />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            cover (png/jpg)
            <input type="file" name="cover" accept="image/png,image/jpeg" className="w-44 text-[10px] text-muted file:mr-2 file:border file:border-pearl/20 file:bg-graphite file:px-2 file:py-1 file:text-pearl" />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            report (pdf)
            <input type="file" name="report" accept="application/pdf" className="w-44 text-[10px] text-muted file:mr-2 file:border file:border-pearl/20 file:bg-graphite file:px-2 file:py-1 file:text-pearl" />
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" name="is_published" defaultChecked /> published
          </label>
          <button type="submit" className="border border-orange/60 px-3 py-1.5 text-orange hover:bg-orange hover:text-black">
            Add
          </button>
        </form>
        <div className="space-y-1.5 font-mono text-xs">
          {analysisRows.length === 0 && <p className="text-muted">No analysis entries.</p>}
          {analysisRows.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-pearl/10 py-2">
              <span className="w-24 shrink-0 text-muted">{a.published_on}</span>
              {!a.is_published && <span className="shrink-0 text-muted/60">[draft]</span>}
              {a.session_tag && <span className="shrink-0 text-muted/70">{a.session_tag}</span>}
              {a.bias && <span className="shrink-0 text-orange">{a.bias}</span>}
              <span className="flex-1 truncate text-pearl">{a.title}</span>
              <span className="shrink-0 text-muted/60">
                {a.cover_path ? "🖼" : "—"} {a.report_path ? "📄" : "—"}
              </span>
              <form action={deleteDailyAnalysis}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="border border-pearl/20 px-2 py-1 text-muted hover:border-orange/60 hover:text-orange">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Live Classes — admin add / list / delete                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-12">
        <h2 className="mb-4 font-display text-lg font-bold">
          Live <span className="text-orange">Classes</span>
        </h2>
        <form
          action={addLiveClass}
          className="mb-5 flex flex-wrap items-end gap-2 font-mono text-xs"
        >
          <label className="flex flex-col gap-1 text-muted">
            starts at
            <input type="datetime-local" name="starts_at" required className="border border-pearl/20 bg-graphite px-2 py-1.5 text-pearl" />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            title
            <input name="title" required placeholder="title" className="w-56 border border-pearl/20 bg-graphite px-2 py-1.5 text-pearl placeholder:text-muted/50" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-muted">
            zoom url
            <input name="zoom_url" required type="url" placeholder="https://zoom.us/j/…" className="min-w-64 border border-pearl/20 bg-graphite px-2 py-1.5 text-pearl placeholder:text-muted/50" />
          </label>
          <button type="submit" className="border border-orange/60 px-3 py-1.5 text-orange hover:bg-orange hover:text-black">
            Add
          </button>
        </form>
        <div className="space-y-1.5 font-mono text-xs">
          {classRows.length === 0 && <p className="text-muted">No live classes.</p>}
          {classRows.map((cl) => (
            <div key={cl.id} className="flex items-center gap-3 border-b border-pearl/10 py-2">
              <span className="w-40 shrink-0 text-muted">{fmtDateTime(cl.starts_at)}</span>
              <span className="flex-1 truncate text-pearl">{cl.title}</span>
              <a
                href={cl.zoom_url}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-xs shrink-0 truncate text-muted/70 underline decoration-pearl/20 hover:text-orange"
              >
                {cl.zoom_url}
              </a>
              <form action={deleteLiveClass}>
                <input type="hidden" name="id" value={cl.id} />
                <button type="submit" className="border border-pearl/20 px-2 py-1 text-muted hover:border-orange/60 hover:text-orange">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
