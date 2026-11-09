import Link from "next/link";
import { requireFeature } from "@/lib/access";
import { LockedFeature } from "@/components/LockedFeature";
import { AppShell } from "@/components/AppShell";
import {
  getEconomicCalendar,
  getWeekRange,
  clampWeek,
  WEEK_MIN,
  WEEK_MAX,
} from "@/lib/forexNews";
import { CalendarClient } from "./CalendarClient";
import { getLocale, getT } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { VslTour } from "@/components/VslPlayer";

// "23 – 29 Jun 2026" in the reader's language (UTC, formatted on the server).
function weekLabel(start: Date, end: Date, intl: string): string {
  const fmt = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "Etc/UTC" });
  return fmt.formatRange(start, end);
}

function relLabel(offset: number, c: Messages["calendar"]): string | null {
  if (offset === 0) return c.thisWeek;
  if (offset === -1) return c.lastWeek;
  if (offset === 1) return c.nextWeek;
  return null;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Gate (conversion-fix 2.2): signed-out -> /login; locked -> preview.
  const gate = await requireFeature("calendar");
  if (gate.locked) return <LockedFeature feature="calendar" gate={gate} />;
  const profile = gate.profile;

  const { week } = await searchParams;
  const offset = clampWeek(typeof week === "string" ? parseInt(week, 10) : 0);
  const events = await getEconomicCalendar(offset);
  const { start, end } = getWeekRange(offset);

  const prev = offset > WEEK_MIN ? offset - 1 : null;
  const next = offset < WEEK_MAX ? offset + 1 : null;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const c = t.calendar;
  const rel = relLabel(offset, c);

  const navBtn =
    "rounded-xl border border-line-strong bg-card px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink";
  const navBtnOff =
    "rounded-xl border border-line bg-paper px-3.5 py-2 text-[13px] font-semibold text-faint cursor-not-allowed";

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} memberTier={gate.viewer.tier} isAdmin={profile.is_admin}>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{c.eyebrow}</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">{c.title}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">{c.subtitle}</p>
          {locale !== "en" && <p className="mt-1.5 text-[12.5px] text-faint">{c.contentNote}</p>}
          <VslTour videos={[{ video: "news" }]} />
        </div>

        {/* Week navigator */}
        <div className="rise mt-6 flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 shadow-soft sm:px-4">
          {prev !== null ? (
            <Link href={`/calendar?week=${prev}`} className={navBtn} aria-label={c.prevAria}>
              ← <span className="hidden sm:inline">{c.prev}</span>
            </Link>
          ) : (
            <span className={navBtnOff} aria-disabled="true">← <span className="hidden sm:inline">{c.prev}</span></span>
          )}

          <div className="text-center">
            <div className="font-display text-[15px] font-bold tracking-tight text-ink sm:text-[16px]">
              {weekLabel(start, end, INTL_LOCALE[locale])}
            </div>
            {rel && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-orange">{rel}</div>
            )}
          </div>

          {next !== null ? (
            <Link href={`/calendar?week=${next}`} className={navBtn} aria-label={c.nextAria}>
              <span className="hidden sm:inline">{c.next}</span> →
            </Link>
          ) : (
            <span className={navBtnOff} aria-disabled="true"><span className="hidden sm:inline">{c.next}</span> →</span>
          )}
        </div>

        {events.length === 0 ? (
          <p className="rise mt-5 rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            {c.emptyWeek}
          </p>
        ) : (
          <CalendarClient events={events} />
        )}
      </div>
    </AppShell>
  );
}
