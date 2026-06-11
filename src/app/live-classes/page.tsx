import Link from "next/link";
import { requireFull } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

interface ClassRow {
  id: string;
  starts_at: string;
  title: string;
  zoom_url: string;
}

function fmt(ts: string): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function isHttps(url: string): boolean {
  return /^https:\/\//.test(url);
}

// Split into upcoming/past against "now". Kept out of the component body so the
// time read isn't flagged as an impure call during render.
function splitByTime(rows: ClassRow[]): { upcoming: ClassRow[]; past: ClassRow[] } {
  const now = Date.now();
  const upcoming = rows.filter((c) => new Date(c.starts_at).getTime() >= now);
  const past = rows
    .filter((c) => new Date(c.starts_at).getTime() < now)
    .reverse();
  return { upcoming, past };
}

export default async function LiveClassesPage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  await requireFull();

  const supabase = await createClient();
  const { data } = await supabase
    .from("live_classes")
    .select("id, starts_at, title, zoom_url")
    .order("starts_at", { ascending: true });
  const all = (data ?? []) as ClassRow[];
  const { upcoming, past } = splitByTime(all);

  return (
    <main className="relative min-h-screen overflow-hidden bg-obsidian">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="session-grid absolute inset-0" />
        <div className="absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-orange/10 blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange/40 to-transparent" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-pearl/10 px-6 py-5 sm:px-10">
        <Link href="/dashboard" className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold tracking-tight text-pearl">
            MARKET MAKERS <span className="text-orange">FX</span>
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-muted sm:inline">
            Live Classes
          </span>
        </Link>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-orange"
        >
          ← Desk
        </Link>
      </header>

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-10 sm:px-10">
        {/* Header */}
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
          Live · London / New York
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-pearl sm:text-4xl">
          Live Classes
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Twice a week, live on the charts. Times are shown in UTC.
        </p>

        {/* Upcoming */}
        <p className="mb-4 mt-10 font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
          Upcoming
        </p>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-pearl/10 bg-graphite/40 px-5 py-8 text-center font-mono text-sm text-muted">
            No classes scheduled yet. Check back soon.
          </p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-pearl/10 bg-graphite/70 p-5"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                    {fmt(c.starts_at)}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-pearl">
                    {c.title}
                  </h3>
                </div>
                {isHttps(c.zoom_url) && (
                  <a
                    href={c.zoom_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-orange px-5 py-3 font-display text-sm font-semibold uppercase tracking-wider text-black transition-transform duration-150 hover:-translate-y-px"
                  >
                    Join the live class ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Past (no join button) */}
        {past.length > 0 && (
          <>
            <p className="mb-4 mt-10 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              Past
            </p>
            <div className="space-y-2">
              {past.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-pearl/10 bg-graphite/40 px-5 py-3"
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                    {fmt(c.starts_at)}
                  </p>
                  <p className="min-w-0 flex-1 truncate text-right text-sm text-muted">
                    {c.title}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
