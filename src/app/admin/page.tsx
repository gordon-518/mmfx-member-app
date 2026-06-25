import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/AppShell";
import { canGrantRetrial } from "@/lib/trial/admin";
import type { AccountStatus } from "@/lib/trial/status";
import {
  grantRetrial,
  runSendpulseSync,
  saveTvSession,
  updateMember,
  verifyDeposit,
} from "./actions";
import { getTVSessionInfo } from "@/lib/tv/client";
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
  "member_expired",
] as const;

const BROKERS = ["octa", "dupoin", "elev8"] as const;

// Shared field/button styles — light, warm-premium, consistent across forms.
const INPUT =
  "rounded-lg border border-line bg-paper px-2 py-1.5 text-ink placeholder:text-faint focus:border-orange/40 focus:outline-none focus:ring-2 focus:ring-orange/15";
const BTN_PRIMARY =
  "cursor-pointer rounded-lg bg-orange px-3 py-1.5 font-semibold text-white transition-colors hover:bg-[#f24e12]";
const BTN_GHOST =
  "cursor-pointer rounded-lg border border-line-strong px-2 py-1 font-medium text-subtle transition-colors hover:border-orange/40 hover:text-accent-ink";

interface AdminProfileRow {
  id: string;
  email: string;
  full_name: string | null;
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
      <main className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-sm text-subtle">Not authorized.</p>
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
      "id, email, full_name, account_status, trial_count, trial_ends_at, downgraded_at, broker, deposit_amount, deposit_verified_at, deposit_verified_by, ib_link_confirmed, is_admin, tradingview_username"
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

  // TradingView session status (for the manual-refresh panel).
  const tvSession = await getTVSessionInfo();

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
    <main className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <Link href="/dashboard">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/stats"
            className="rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-medium text-subtle transition-colors hover:border-orange/40 hover:text-accent-ink"
          >
            Stats →
          </Link>
          <span className="text-[13px] text-subtle">{user.email}</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Admin <span className="text-orange">·</span> Members
        </h1>

        {notice && (
          <p className="mt-4 rounded-xl border border-line bg-accent-soft/50 px-4 py-2.5 text-[13px] font-medium text-accent-ink">
            ✓ {notice}
          </p>
        )}
        {failure && (
          <p className="mt-4 rounded-xl border border-orange/40 bg-accent-soft px-4 py-2.5 text-[13px] font-medium text-accent-ink">
            ✕ {targetEmail ? `${targetEmail}: ` : ""}
            {failure}
          </p>
        )}
        {listError && (
          <p className="mt-4 text-[13px] text-accent-ink">
            Failed to load profiles: {listError.message}
          </p>
        )}

        {/* TradingView session — manual refresh fallback for when the app's
            programmatic login is CAPTCHA-blocked. */}
        <section className="mt-6 rounded-xl border border-line bg-card/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">
              TradingView session
            </h2>
            <span className="text-[12px] text-subtle">
              {tvSession.updatedAt
                ? `Last refreshed ${fmtDateTime(tvSession.updatedAt)}`
                : "No session stored yet"}
            </span>
          </div>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-faint">
            Grants run on a stored session, so the app rarely needs to log in. If
            you get a login/CAPTCHA failure email, paste a fresh cookie from
            tradingview.com (DevTools → Application → Cookies → copy{" "}
            <span className="font-medium text-subtle">sessionid</span> and{" "}
            <span className="font-medium text-subtle">sessionid_sign</span>).
          </p>
          <form
            action={saveTvSession}
            className="mt-3 flex flex-wrap items-end gap-2 text-[13px]"
          >
            <input
              name="sessionid"
              placeholder="sessionid"
              required
              autoComplete="off"
              className={`w-64 ${INPUT}`}
            />
            <input
              name="sessionid_sign"
              placeholder="sessionid_sign"
              required
              autoComplete="off"
              className={`w-64 ${INPUT}`}
            />
            <button type="submit" className={BTN_PRIMARY}>
              Save &amp; test
            </button>
          </form>
        </section>

        {/* SendPulse audience sync — tag contacts by status for segmentation. */}
        <section className="mt-4 rounded-xl border border-line bg-card/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">
                SendPulse audience sync
              </h2>
              <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-faint">
                Tags every contact in the SendPulse signups list with their
                status (member / trial / expired / removed) for segmentation.
                Runs nightly — use this to refresh now.
              </p>
            </div>
            <form action={runSendpulseSync}>
              <button type="submit" className={BTN_PRIMARY}>
                Run sync now
              </button>
            </form>
          </div>
        </section>

        {/* Search + filters (GET — state lives in the URL) */}
        <form
          method="get"
          action="/admin"
          className="mb-5 mt-6 flex flex-wrap items-center gap-2 text-[13px]"
        >
          <input
            type="search"
            name="q"
            defaultValue={emailQuery}
            placeholder="search email…"
            className={`w-56 ${INPUT}`}
          />
          <select name="status" defaultValue={statusFilter} className={INPUT}>
            <option value="">status: all</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select name="broker" defaultValue={brokerFilter} className={INPUT}>
            <option value="">broker: all</option>
            {BROKERS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button type="submit" className={BTN_PRIMARY}>
            Search
          </button>
          {(emailQuery || statusFilter || brokerFilter) && (
            <a href="/admin" className="px-2 py-1.5 text-subtle hover:text-ink">
              clear
            </a>
          )}
          <span className="ml-auto text-subtle">
            {rows.length} result{rows.length === 1 ? "" : "s"}
          </span>
        </form>

        <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-soft">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Trials</th>
                <th className="px-3 py-2.5">Trial ends</th>
                <th className="px-3 py-2.5">Downgraded</th>
                <th className="px-3 py-2.5">Deposit</th>
                <th className="px-3 py-2.5">TradingView</th>
                <th className="px-3 py-2.5">Mark deposit</th>
                <th className="px-3 py-2.5">Re-trial</th>
                <th className="px-3 py-2.5">Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const retrialOk = canGrantRetrial(p);
                return (
                  <tr key={p.id} className="border-b border-line align-top last:border-b-0">
                    <td className="px-3 py-3 font-medium text-ink">{p.full_name || "—"}</td>
                    <td className="px-3 py-3">
                      {p.email}
                      {p.is_admin && (
                        <span className="ml-1 font-semibold text-orange">(admin)</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{p.account_status}</td>
                    <td className="px-3 py-3">{p.trial_count}</td>
                    <td className="px-3 py-3">{fmt(p.trial_ends_at)}</td>
                    <td className="px-3 py-3">{fmt(p.downgraded_at)}</td>
                    <td className="px-3 py-3">
                      {p.deposit_verified_at
                        ? `$${p.deposit_amount} · ${p.broker} · IB ${
                            p.ib_link_confirmed ? "yes" : "no"
                          } · ${p.deposit_verified_by}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      {p.tradingview_username ? (
                        <span className="text-ink">{p.tradingview_username}</span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {p.account_status === "member_active" ? (
                        <span className="text-faint">member</span>
                      ) : (
                        <form action={verifyDeposit} className="flex flex-wrap items-center gap-1.5">
                          <input type="hidden" name="target_user_id" value={p.id} />
                          <input type="hidden" name="target_email" value={p.email} />
                          {hiddenFilters}
                          <select name="broker" required defaultValue="" className={INPUT}>
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
                            className={`w-20 ${INPUT}`}
                          />
                          <label className="flex items-center gap-1 text-subtle">
                            <input name="ib_confirmed" type="checkbox" className="accent-orange" /> IB
                          </label>
                          <button type="submit" className={BTN_PRIMARY}>
                            Verify
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {retrialOk ? (
                        <form action={grantRetrial}>
                          <input type="hidden" name="target_user_id" value={p.id} />
                          <input type="hidden" name="target_email" value={p.email} />
                          {hiddenFilters}
                          <button type="submit" className={BTN_GHOST}>
                            Grant re-trial
                          </button>
                        </form>
                      ) : (
                        <span className="text-faint">
                          {p.account_status === "trial_expired"
                            ? "not eligible"
                            : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {/* Manual override editor — bypasses the deposit/re-trial
                          business rules by design. Empty fields = unchanged. */}
                      <details>
                        <summary className="cursor-pointer text-subtle hover:text-accent-ink">
                          edit
                        </summary>
                        <form
                          action={updateMember}
                          className="mt-2 flex w-44 flex-col gap-1.5 rounded-xl border border-line bg-paper p-3"
                        >
                          <input type="hidden" name="target_user_id" value={p.id} />
                          <input type="hidden" name="target_email" value={p.email} />
                          {hiddenFilters}
                          <label className="text-subtle">
                            status
                            <select name="status" defaultValue="" className={`mt-0.5 w-full ${INPUT}`}>
                              <option value="">(unchanged)</option>
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-subtle">
                            broker
                            <select name="broker" defaultValue="" className={`mt-0.5 w-full ${INPUT}`}>
                              <option value="">(unchanged)</option>
                              {BROKERS.map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-subtle">
                            trial ends
                            <input type="date" name="trial_ends_at" className={`mt-0.5 w-full ${INPUT}`} />
                          </label>
                          <label className="text-subtle">
                            trial count
                            <select name="trial_count" defaultValue="" className={`mt-0.5 w-full ${INPUT}`}>
                              <option value="">(unchanged)</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                            </select>
                          </label>
                          <button type="submit" className={`mt-1 ${BTN_PRIMARY}`}>
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
                  <td colSpan={10} className="px-3 py-6 text-subtle">
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
          <h2 className="mb-4 font-display text-lg font-bold tracking-tight text-ink">
            Daily <span className="text-orange">Analysis</span>
          </h2>
          <form
            action={addDailyAnalysis}
            className="mb-5 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-card p-4 text-[13px] shadow-soft"
          >
            <label className="flex flex-col gap-1 text-subtle">
              published on
              <input type="date" name="published_on" className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-subtle">
              title
              <input name="title" required placeholder="title" className={`w-56 ${INPUT}`} />
            </label>
            <label className="flex flex-col gap-1 text-subtle">
              gumlet id / url
              <input name="gumlet_id" required placeholder="gumlet id or embed url" className={`w-48 ${INPUT}`} />
            </label>
            <label className="flex flex-col gap-1 text-subtle">
              session
              <input name="session_tag" defaultValue="London" placeholder="London" className={`w-28 ${INPUT}`} />
            </label>
            <label className="flex flex-col gap-1 text-subtle">
              bias
              <select name="bias" defaultValue="" className={INPUT}>
                <option value="">none</option>
                <option value="bullish">bullish</option>
                <option value="bearish">bearish</option>
                <option value="neutral">neutral</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-subtle">
              description
              <input name="description" placeholder="optional description" className={`min-w-48 ${INPUT}`} />
            </label>
            <label className="flex flex-col gap-1 text-subtle">
              cover (png/jpg)
              <input type="file" name="cover" accept="image/png,image/jpeg" className="w-44 text-[11px] text-subtle file:mr-2 file:rounded-md file:border file:border-line file:bg-paper file:px-2 file:py-1 file:text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-subtle">
              report (pdf)
              <input type="file" name="report" accept="application/pdf" className="w-44 text-[11px] text-subtle file:mr-2 file:rounded-md file:border file:border-line file:bg-paper file:px-2 file:py-1 file:text-ink" />
            </label>
            <label className="flex items-center gap-1.5 text-subtle">
              <input type="checkbox" name="is_published" defaultChecked className="accent-orange" /> published
            </label>
            <button type="submit" className={BTN_PRIMARY}>
              Add
            </button>
          </form>
          <div className="space-y-1.5 text-[13px]">
            {analysisRows.length === 0 && <p className="text-subtle">No analysis entries.</p>}
            {analysisRows.map((a) => (
              <div key={a.id} className="flex items-center gap-3 border-b border-line py-2">
                <span className="w-24 shrink-0 text-subtle">{a.published_on}</span>
                {!a.is_published && <span className="shrink-0 text-faint">[draft]</span>}
                {a.session_tag && <span className="shrink-0 text-subtle">{a.session_tag}</span>}
                {a.bias && <span className="shrink-0 font-medium text-orange">{a.bias}</span>}
                <span className="flex-1 truncate text-ink">{a.title}</span>
                <span className="shrink-0 text-faint">
                  {a.cover_path ? "🖼" : "—"} {a.report_path ? "📄" : "—"}
                </span>
                <form action={deleteDailyAnalysis}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className={BTN_GHOST}>
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
        <section className="mt-12 pb-8">
          <h2 className="mb-4 font-display text-lg font-bold tracking-tight text-ink">
            Live <span className="text-orange">Classes</span>
          </h2>
          <form
            action={addLiveClass}
            className="mb-5 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-card p-4 text-[13px] shadow-soft"
          >
            <label className="flex flex-col gap-1 text-subtle">
              starts at
              <input type="datetime-local" name="starts_at" required className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-subtle">
              title
              <input name="title" required placeholder="title" className={`w-56 ${INPUT}`} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-subtle">
              zoom url
              <input name="zoom_url" required type="url" placeholder="https://zoom.us/j/…" className={`min-w-64 ${INPUT}`} />
            </label>
            <button type="submit" className={BTN_PRIMARY}>
              Add
            </button>
          </form>
          <div className="space-y-1.5 text-[13px]">
            {classRows.length === 0 && <p className="text-subtle">No live classes.</p>}
            {classRows.map((cl) => (
              <div key={cl.id} className="flex items-center gap-3 border-b border-line py-2">
                <span className="w-40 shrink-0 text-subtle">{fmtDateTime(cl.starts_at)}</span>
                <span className="flex-1 truncate text-ink">{cl.title}</span>
                <a
                  href={cl.zoom_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-xs shrink-0 truncate text-subtle underline decoration-line-strong hover:text-accent-ink"
                >
                  {cl.zoom_url}
                </a>
                <form action={deleteLiveClass}>
                  <input type="hidden" name="id" value={cl.id} />
                  <button type="submit" className={BTN_GHOST}>
                    Delete
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
