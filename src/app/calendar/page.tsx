import Link from "next/link";
import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import {
  getEconomicCalendar,
  getWeekRange,
  clampWeek,
  WEEK_MIN,
  WEEK_MAX,
} from "@/lib/forexNews";
import { CalendarClient } from "./CalendarClient";

// "23 – 29 Jun 2026" (UTC, deterministic for SSR)
function weekLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "Etc/UTC" };
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const s = start.toLocaleDateString("en-GB", sameMonth ? { day: "numeric", timeZone: "Etc/UTC" } : opts);
  const e = end.toLocaleDateString("en-GB", { ...opts, year: "numeric" });
  return `${s} – ${e}`;
}

function relLabel(offset: number): string | null {
  if (offset === 0) return "This week";
  if (offset === -1) return "Last week";
  if (offset === 1) return "Next week";
  return null;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();

  const { week } = await searchParams;
  const offset = clampWeek(typeof week === "string" ? parseInt(week, 10) : 0);
  const events = await getEconomicCalendar(offset);
  const { start, end } = getWeekRange(offset);

  const prev = offset > WEEK_MIN ? offset - 1 : null;
  const next = offset < WEEK_MAX ? offset + 1 : null;
  const rel = relLabel(offset);

  const navBtn =
    "rounded-xl border border-line-strong bg-card px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink";
  const navBtnOff =
    "rounded-xl border border-line bg-paper px-3.5 py-2 text-[13px] font-semibold text-faint cursor-not-allowed";

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            Markets · Economic releases
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
            Economic Calendar
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            High-impact releases that move forex and gold — central-bank decisions, CPI, jobs
            and more. Step through the weeks and filter to the currencies you trade.
          </p>
        </div>

        {/* Week navigator */}
        <div className="rise mt-6 flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 shadow-soft sm:px-4">
          {prev !== null ? (
            <Link href={`/calendar?week=${prev}`} className={navBtn} aria-label="Previous week">
              ← <span className="hidden sm:inline">Prev</span>
            </Link>
          ) : (
            <span className={navBtnOff} aria-disabled="true">← <span className="hidden sm:inline">Prev</span></span>
          )}

          <div className="text-center">
            <div className="font-display text-[15px] font-bold tracking-tight text-ink sm:text-[16px]">
              {weekLabel(start, end)}
            </div>
            {rel && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-orange">{rel}</div>
            )}
          </div>

          {next !== null ? (
            <Link href={`/calendar?week=${next}`} className={navBtn} aria-label="Next week">
              <span className="hidden sm:inline">Next</span> →
            </Link>
          ) : (
            <span className={navBtnOff} aria-disabled="true"><span className="hidden sm:inline">Next</span> →</span>
          )}
        </div>

        {events.length === 0 ? (
          <p className="rise mt-5 rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            No high-impact events scheduled for this week. Use ← / → to check another week.
          </p>
        ) : (
          <CalendarClient events={events} />
        )}
      </div>
    </AppShell>
  );
}
