import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/AppShell";

// Trial-abuse visibility: clusters of accounts that share a device fingerprint,
// signup IP, or TradingView username — i.e. likely the same person spinning up
// fresh 14-day trials. Soft signals for manual review (expire via /admin), not
// auto-blocking. Admin-gated.

interface Row {
  id: string;
  email: string;
  account_status: string;
  created_at: string;
  signup_fingerprint: string | null;
  signup_ip: string | null;
  tradingview_username: string | null;
}

type Signal = "device" | "IP" | "TradingView";

interface Cluster {
  signal: Signal;
  value: string;
  accounts: Row[];
}

function clustersFor(rows: Row[], signal: Signal, key: keyof Row): Cluster[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const v = (r[key] as string | null)?.trim();
    if (!v) continue;
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v)!.push(r);
  }
  return [...groups.entries()]
    .filter(([, accts]) => accts.length > 1) // shared by 2+ accounts = suspicious
    .map(([value, accounts]) => ({ signal, value, accounts }));
}

export default async function AbusePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const { data } = await supabase
    .from("profiles")
    .select("id, email, account_status, created_at, signup_fingerprint, signup_ip, tradingview_username")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const clusters = [
    ...clustersFor(rows, "device", "signup_fingerprint"),
    ...clustersFor(rows, "IP", "signup_ip"),
    ...clustersFor(rows, "TradingView", "tradingview_username"),
  ].sort((a, b) => b.accounts.length - a.accounts.length);

  const flaggedAccounts = new Set(clusters.flatMap((c) => c.accounts.map((a) => a.id)));

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <Link href="/dashboard"><Wordmark /></Link>
        <Link href="/admin" className="text-[13px] font-medium text-subtle hover:text-accent-ink">
          ← Members
        </Link>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Trial abuse <span className="text-orange">·</span> signals
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-subtle">
          Accounts sharing a <strong>device</strong>, <strong>IP</strong>, or{" "}
          <strong>TradingView username</strong> — likely the same person on repeat
          trials. These are soft signals; review and expire abusers from{" "}
          <Link href="/admin" className="text-orange hover:text-accent-ink">Members</Link>.
        </p>
        <p className="mt-3 text-[13px] text-faint">
          {clusters.length} cluster{clusters.length === 1 ? "" : "s"} ·{" "}
          {flaggedAccounts.size} account{flaggedAccounts.size === 1 ? "" : "s"} flagged ·{" "}
          {rows.length} total
        </p>

        {clusters.length === 0 ? (
          <div className="mt-8 rounded-xl border border-line bg-card/60 p-6 text-center text-[14px] text-subtle">
            No overlaps yet — no shared devices, IPs, or TradingView usernames across accounts. ✅
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {clusters.map((c, i) => (
              <section key={i} className="rounded-xl border border-orange/30 bg-accent-soft/30 p-4">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="rounded-full bg-orange px-2.5 py-0.5 font-semibold uppercase tracking-wide text-white">
                    {c.signal}
                  </span>
                  <span className="font-mono text-subtle break-all">{c.value}</span>
                  <span className="text-faint">· {c.accounts.length} accounts</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {c.accounts.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-1.5 text-[13px]">
                      <span className="font-medium text-ink break-all">{a.email}</span>
                      <span className="flex items-center gap-3 text-faint">
                        <span>{a.account_status}</span>
                        <span>{new Date(a.created_at).toISOString().slice(0, 10)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
