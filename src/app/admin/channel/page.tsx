import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/AppShell";

// Admin-gated Telegram channel performance dashboard. Answers one question:
// which CTA copy actually earns clicks? Everything is derived from the posts
// the bot has already sent — impressions (times posted), clicks (via the /go
// redirect) and reactions (via the Telegram webhook).
//
// Aggregate engagement only; no subscriber data of any kind is collected.

export const dynamic = "force-dynamic";

interface LibraryRow {
  id: string;
  kind: string;
  body: string;
  status: string;
  source: string;
  weight: number;
  times_posted: number;
  last_posted_at: string | null;
  button_set: { text: string; slug: string }[] | null;
}
interface EngagementRow {
  item_id: string;
  impressions: number;
  clicks: number;
  reactions: number;
}
interface PostRow {
  id: string;
  kind: string;
  status: string;
  body: string;
  clicks: number;
  reactions: number;
  telegram_message_id: number | null;
  created_at: string;
  source_id: string | null;
}

/** First line of the post, stripped of house markdown — used as its label. */
function headline(body: string): string {
  const first = body.split("\n").find((l) => l.trim()) ?? "";
  return first.replace(/⚜️/g, "").replace(/\*\*/g, "").replace(/__/g, "").trim();
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {sub ? <p className="text-[11px] text-subtle">{sub}</p> : null}
    </div>
  );
}

/** Horizontal bar, scaled against the best performer in its column. */
function Bar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2;
  return (
    <div className="h-1.5 w-full rounded-full bg-line/60">
      <div className="h-1.5 rounded-full bg-accent" style={{ width: `${w}%` }} />
    </div>
  );
}

export default async function ChannelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const [{ data: libData }, { data: engData }, { data: postData }] = await Promise.all([
    supabase
      .from("content_library")
      .select("id, kind, body, status, source, weight, times_posted, last_posted_at, button_set"),
    supabase.from("library_engagement").select("item_id, impressions, clicks, reactions"),
    supabase
      .from("channel_posts")
      .select("id, kind, status, body, clicks, reactions, telegram_message_id, created_at, source_id")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const library = (libData ?? []) as LibraryRow[];
  const engagement = (engData ?? []) as EngagementRow[];
  const recent = (postData ?? []) as PostRow[];

  const engById = new Map(engagement.map((e) => [e.item_id, e]));

  // One row per library item, joined to its engagement.
  const rows = library
    .filter((l) => l.status === "approved")
    .map((l) => {
      const e = engById.get(l.id);
      const impressions = e?.impressions ?? 0;
      const clicks = e?.clicks ?? 0;
      const reactions = e?.reactions ?? 0;
      return {
        ...l,
        impressions,
        clicks,
        reactions,
        slug: l.button_set?.[0]?.slug ?? "—",
        // Clicks per impression is the honest measure of whether the copy works.
        ctr: impressions > 0 ? clicks / impressions : 0,
        engagement: impressions > 0 ? (clicks + reactions) / impressions : 0,
      };
    });

  const posted = rows.filter((r) => r.impressions > 0);
  const totals = {
    posts: rows.length,
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    reactions: rows.reduce((s, r) => s + r.reactions, 0),
  };
  const overallCtr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;

  // Best-performing copy first; unposted items sink to the bottom.
  const ranked = [...rows].sort((a, b) => b.engagement - a.engagement || b.impressions - a.impressions);
  const maxEng = Math.max(0, ...ranked.map((r) => r.engagement));

  // Which FEATURE earns attention, independent of individual copy.
  const byFeature = new Map<string, { impressions: number; clicks: number; reactions: number; posts: number; weight: number }>();
  for (const r of rows) {
    const cur = byFeature.get(r.slug) ?? { impressions: 0, clicks: 0, reactions: 0, posts: 0, weight: r.weight };
    cur.impressions += r.impressions;
    cur.clicks += r.clicks;
    cur.reactions += r.reactions;
    cur.posts += 1;
    cur.weight = Math.max(cur.weight, r.weight);
    byFeature.set(r.slug, cur);
  }
  const features = [...byFeature.entries()]
    .map(([slug, v]) => ({ slug, ...v, ctr: v.impressions > 0 ? v.clicks / v.impressions : 0 }))
    .sort((a, b) => b.ctr - a.ctr || b.impressions - a.impressions);
  const maxFeatCtr = Math.max(0, ...features.map((f) => f.ctr));

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <Link href="/admin">
          <Wordmark />
        </Link>
        <nav className="flex gap-4 text-xs text-subtle">
          <Link href="/admin" className="hover:text-ink">Admin</Link>
          <Link href="/stats" className="hover:text-ink">Growth</Link>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <h1 className="text-xl font-semibold">Channel performance</h1>
        <p className="mt-1 text-sm text-subtle">
          Which CTA copy actually earns clicks. Impressions = times the bot posted it; clicks come
          from the tracked button; reactions from Telegram.
        </p>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Approved posts" value={String(totals.posts)} sub={`${posted.length} have run`} />
          <Stat label="Impressions" value={String(totals.impressions)} sub="times posted" />
          <Stat label="Clicks" value={String(totals.clicks)} sub={`${pct(overallCtr)} click rate`} />
          <Stat label="Reactions" value={String(totals.reactions)} />
        </section>

        {totals.impressions < 12 ? (
          <p className="mt-4 rounded-lg border border-line bg-card/40 px-4 py-3 text-xs text-subtle">
            Early days — with {totals.impressions} impressions so far, treat this ranking as noise.
            It becomes meaningful once most posts have run several times.
          </p>
        ) : null}

        {/* ---------------- which copy works ---------------- */}
        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-subtle">
          Copy leaderboard
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-card/60 text-[11px] uppercase tracking-wide text-faint">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Hook</th>
                <th className="px-3 py-2 text-left font-medium">Feature</th>
                <th className="px-3 py-2 text-right font-medium">Posted</th>
                <th className="px-3 py-2 text-right font-medium">Clicks</th>
                <th className="px-3 py-2 text-right font-medium">React</th>
                <th className="px-3 py-2 text-right font-medium">Click rate</th>
                <th className="px-3 py-2 text-left font-medium">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.id} className="border-t border-line/70">
                  <td className="max-w-[280px] truncate px-3 py-2" title={headline(r.body)}>
                    {headline(r.body)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-line/50 px-1.5 py-0.5 text-[11px] text-subtle">
                      {r.slug}
                    </span>
                    <span className="ml-1 text-[10px] text-faint">w{r.weight}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.impressions}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.clicks}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.reactions}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.impressions > 0 ? pct(r.ctr) : "—"}
                  </td>
                  <td className="w-[140px] px-3 py-2">
                    <Bar value={r.engagement} max={maxEng} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---------------- which feature works ---------------- */}
        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-subtle">
          By feature
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-card/60 text-[11px] uppercase tracking-wide text-faint">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Feature</th>
                <th className="px-3 py-2 text-right font-medium">Weight</th>
                <th className="px-3 py-2 text-right font-medium">Posts</th>
                <th className="px-3 py-2 text-right font-medium">Impressions</th>
                <th className="px-3 py-2 text-right font-medium">Clicks</th>
                <th className="px-3 py-2 text-right font-medium">Click rate</th>
                <th className="px-3 py-2 text-left font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.slug} className="border-t border-line/70">
                  <td className="px-3 py-2">{f.slug}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.weight}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.posts}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.impressions}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.clicks}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f.impressions > 0 ? pct(f.ctr) : "—"}
                  </td>
                  <td className="w-[120px] px-3 py-2">
                    <Bar value={f.ctr} max={maxFeatCtr} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---------------- what went out lately ---------------- */}
        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-subtle">
          Recent posts
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-card/60 text-[11px] uppercase tracking-wide text-faint">
              <tr>
                <th className="px-3 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-left font-medium">Post</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Clicks</th>
                <th className="px-3 py-2 text-right font-medium">React</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} className="border-t border-line/70">
                  <td className="whitespace-nowrap px-3 py-2 text-subtle">{fmtWhen(p.created_at)}</td>
                  <td className="max-w-[260px] truncate px-3 py-2" title={headline(p.body)}>
                    {headline(p.body)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-subtle">{p.kind}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.clicks}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.reactions}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        p.status === "posted"
                          ? "text-[11px] text-subtle"
                          : "text-[11px] font-medium text-accent"
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-[11px] text-faint">
          The rotation already uses this data: posts with a higher engagement rate are selected more
          often, and consistently weak ones are retired automatically.
        </p>
      </div>
    </main>
  );
}
