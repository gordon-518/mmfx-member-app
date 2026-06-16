import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { ExternalIcon } from "@/components/icons";
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
  const profile = await requireFull();

  const supabase = await createClient();
  const { data } = await supabase
    .from("live_classes")
    .select("id, starts_at, title, zoom_url")
    .order("starts_at", { ascending: true });
  const all = (data ?? []) as ClassRow[];
  const { upcoming, past } = splitByTime(all);

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            Live · London / New York
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
            Live Classes
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            Twice a week, live on the charts. Times are shown in UTC.
          </p>
        </div>

        {/* Upcoming */}
        <p className="rise mb-4 mt-9 text-[12px] font-semibold uppercase tracking-wider text-orange">
          Upcoming
        </p>
        {upcoming.length === 0 ? (
          <p className="rise rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            No classes scheduled yet. Check back soon.
          </p>
        ) : (
          <div className="rise space-y-3">
            {upcoming.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card p-5 shadow-soft"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-subtle">
                    {fmt(c.starts_at)}
                  </p>
                  <h3 className="mt-1 font-display text-[18px] font-bold tracking-tight text-ink">
                    {c.title}
                  </h3>
                </div>
                {isHttps(c.zoom_url) && (
                  <a
                    href={c.zoom_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
                  >
                    Join the live class <ExternalIcon width={15} height={15} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Past (no join button) */}
        {past.length > 0 && (
          <>
            <p className="mb-4 mt-10 text-[12px] font-semibold uppercase tracking-wider text-faint">
              Past
            </p>
            <div className="space-y-2">
              {past.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-line bg-card/50 px-5 py-3"
                >
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">
                    {fmt(c.starts_at)}
                  </p>
                  <p className="min-w-0 flex-1 truncate text-right text-[14px] text-subtle">
                    {c.title}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
