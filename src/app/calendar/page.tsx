import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { getEconomicCalendar } from "@/lib/forexNews";
import { CalendarClient } from "./CalendarClient";

export default async function CalendarPage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();
  const events = await getEconomicCalendar();

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            Markets · The week ahead
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
            Economic Calendar
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            High-impact releases that move forex and gold over the next 7 days — central-bank
            decisions, CPI, jobs and more. Filter to the currencies you trade.
          </p>
        </div>

        {events.length === 0 ? (
          <p className="rise mt-6 rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            No upcoming events to show right now. Check back shortly.
          </p>
        ) : (
          <CalendarClient events={events} />
        )}
      </div>
    </AppShell>
  );
}
