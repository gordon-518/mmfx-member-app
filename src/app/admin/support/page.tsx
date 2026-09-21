import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/AppShell";
import { accountsText, flowsText } from "@/lib/support/settingsForm";
import type { SupportSettings } from "@/lib/support/types";
import { setEnabled, saveSettings, clearChat } from "./actions";

// Admin-only control room for the support agent: the switch, the editable part
// of the fact sheet (prices/tiers/links come from code), the Needs-Amelia
// queue and the activity log. Reads go through RLS (admins only).

export const dynamic = "force-dynamic";

interface ChatRow { contact_id: string; telegram_username: string | null; is_business: boolean; handoff_reason: string | null; updated_at: string }
interface EventRow {
  id: number; contact_id: string; kind: string; topic: string | null; member_text: string | null;
  reply_text: string | null; skip_reason: string | null; latency_ms: number | null;
  created_at: string; delivered_at: string | null;
}

const sgt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Singapore", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const cut = (s: string | null, n = 90) => (s && s.length > n ? `${s.slice(0, n)}…` : s ?? "");
function sgtMidnightIso(): string {
  const now = new Date(Date.now() + 8 * 3600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 8 * 3600_000).toISOString();
}
/** An outgoing message is logged BEFORE it is sent (so the agent recognises
 * its own echo), and delivered_at is set once SendPulse confirms it. A row
 * still unconfirmed minutes later means the run died in between: the member
 * was never answered and nobody was told. Anything younger is just in flight. */
const UNDELIVERED_AFTER_MS = 5 * 60_000;
const undelivered = (e: EventRow) =>
  (e.kind === "reply" || e.kind === "handoff") && !e.delivered_at &&
  Date.now() - Date.parse(e.created_at) > UNDELIVERED_AFTER_MS;

const field = "w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink";
const label = "text-[11px] font-semibold uppercase tracking-wider text-faint";

export default async function SupportAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!user || isAdmin !== true) {
    return <main className="p-10 text-[14px] text-subtle">Not authorized.</main>;
  }

  const [{ data: s }, { data: queue }, { data: events }] = await Promise.all([
    supabase.from("support_settings").select("*").eq("id", 1).maybeSingle(),
    // The queue reads support_chats, not handoff events: the error path sets
    // state = needs_amelia while logging kind = "error", so an event-based
    // queue would miss exactly the chats that broke.
    supabase.from("support_chats").select("contact_id, telegram_username, is_business, handoff_reason, updated_at")
      .eq("state", "needs_amelia").order("updated_at", { ascending: false }).limit(50),
    supabase.from("support_events").select("id, contact_id, kind, topic, member_text, reply_text, skip_reason, latency_ms, created_at, delivered_at")
      .order("created_at", { ascending: false }).limit(150),
  ]);
  const settings = s as SupportSettings | null;
  const log = (events ?? []) as EventRow[];
  const today = log.filter((e) => e.created_at >= sgtMidnightIso());
  const count = (k: string) => today.filter((e) => e.kind === k).length;
  const notDelivered = log.filter(undelivered).length;
  const lat = today.filter((e) => e.kind === "reply" && e.latency_ms != null).map((e) => e.latency_ms!).sort((a, b) => a - b);
  const median = lat.length ? `${Math.round(lat[Math.floor(lat.length / 2)] / 1000)}s` : "—";

  return (
    <main className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <Link href="/dashboard"><Wordmark /></Link>
        <Link href="/admin" className="text-[13px] font-semibold text-subtle hover:text-ink">← Admin</Link>
      </header>
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className={label}>Support agent</p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              {settings?.enabled ? "On: answering members" : "Off: nothing is sent"}
            </h1>
          </div>
          <form action={setEnabled}>
            <input type="hidden" name="enabled" value={settings?.enabled ? "false" : "true"} />
            <button className={`rounded-xl px-5 py-2.5 text-[14px] font-semibold ${settings?.enabled ? "border border-line-strong bg-card text-ink" : "bg-orange text-white"}`}>
              {settings?.enabled ? "Turn off" : "Turn on"}
            </button>
          </form>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[["Replies today", count("reply")], ["Handed to Amelia", count("handoff")], ["Skipped", count("skip")], ["Median reply time", median], ["Not delivered", notDelivered]].map(([k, v]) => (
            <div key={String(k)} className="rounded-2xl border border-line bg-card p-4">
              <p className={label}>{k}</p>
              <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${k === "Not delivered" && Number(v) > 0 ? "text-orange" : "text-ink"}`}>{v}</p>
            </div>
          ))}
        </section>
        {notDelivered > 0 && (
          <p className="-mt-4 text-[13px] text-subtle">
            {notDelivered} outgoing message{notDelivered === 1 ? "" : "s"} {notDelivered === 1 ? "was" : "were"} logged but never confirmed by SendPulse —
            those members may not have been answered. They are tagged in the log below.
          </p>
        )}

        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-bold text-ink">Needs Amelia ({queue?.length ?? 0})</h2>
          <ul className="mt-3 divide-y divide-line">
            {((queue ?? []) as ChatRow[]).map((c) => (
              <li key={c.contact_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13.5px]">
                <span className="text-ink">
                  {c.telegram_username ? `@${c.telegram_username}` : c.contact_id}
                  {c.is_business && <span className="ml-2 text-[11px] text-faint">@MM_3000 chat</span>}
                  <span className="block text-subtle">{c.handoff_reason} · {sgt(c.updated_at)}</span>
                </span>
                <form action={clearChat}>
                  <input type="hidden" name="contact_id" value={c.contact_id} />
                  <button className="rounded-lg border border-line-strong px-3 py-1.5 text-[12.5px] font-semibold text-ink">Done: back to the agent</button>
                </form>
              </li>
            ))}
            {!queue?.length && <li className="py-3 text-[13.5px] text-subtle">Nothing waiting.</li>}
          </ul>
        </section>

        {settings && (
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-display text-lg font-bold text-ink">Fact sheet: the editable part</h2>
            <p className="mt-1 text-[13px] text-subtle">Prices, tiers, features, the IB number and links come from the app&apos;s code, so they can&apos;t drift.</p>
            <form action={saveSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1"><span className={label}>Octa/Elev8 bonus code</span><input name="bonus_code" defaultValue={settings.bonus_code} className={field} /></label>
              <label className="grid gap-1"><span className={label}>Code valid until</span><input name="bonus_code_expires" type="date" defaultValue={settings.bonus_code_expires} className={field} /></label>
              <label className="grid gap-1"><span className={label}>Office hours (human replies)</span><input name="office_hours" defaultValue={settings.office_hours} className={field} /></label>
              <label className="grid gap-1"><span className={label}>Trade cadence</span><input name="trade_cadence" defaultValue={settings.trade_cadence} className={field} /></label>
              <label className="grid gap-1 sm:col-span-2"><span className={label}>Official accounts, one per line: handle | label</span>
                <textarea name="official_accounts" rows={3} defaultValue={accountsText(settings.official_accounts)} className={field} /></label>
              <label className="grid gap-1 sm:col-span-2"><span className={label}>Approved flows, one per line: label | link or flow:ID | when to use</span>
                <textarea name="approved_flows" rows={3} defaultValue={flowsText(settings.approved_flows)} className={field} /></label>
              <label className="grid gap-1 sm:col-span-2"><span className={label}>Notes the agent may use</span>
                <textarea name="notes" rows={3} defaultValue={settings.notes} className={field} /></label>
              <div className="sm:col-span-2"><button className="rounded-xl bg-orange px-5 py-2.5 text-[14px] font-semibold text-white">Save fact sheet</button></div>
            </form>
          </section>
        )}

        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-bold text-ink">Activity</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className={label}><tr><th className="py-2">Time (SGT)</th><th>What</th><th>Topic</th><th>Member</th><th>Sent / reason</th></tr></thead>
              <tbody className="divide-y divide-line">
                {log.filter((e) => e.kind !== "incoming").map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-subtle">{sgt(e.created_at)}</td>
                    <td className="pr-3 font-semibold text-ink">
                      {e.kind}
                      {undelivered(e) && <span className="ml-2 rounded bg-orange/10 px-1.5 py-0.5 text-[11px] font-semibold text-orange">not delivered</span>}
                    </td>
                    <td className="pr-3 text-subtle">{e.topic ?? ""}</td>
                    <td className="pr-3 text-ink">{cut(e.member_text)}</td>
                    <td className="text-subtle">
                      {cut(e.reply_text, 120)}
                      {/* skip_reason also carries "(write failed: …)" notes from a
                          handoff whose tag/pause/openChat/ping didn't land. */}
                      {e.skip_reason && <span className="block text-faint">{cut(e.skip_reason, 120)}</span>}
                    </td>
                  </tr>
                ))}
                {!log.filter((e) => e.kind !== "incoming").length && (
                  <tr><td colSpan={5} className="py-3 text-subtle">Nothing yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
