import Link from "next/link";
import { onboardingProgress, deskPitchFor, type OnboardingState } from "@/lib/onboarding";

// The five-step onboarding checklist (conversion-fix Phase 4). "full" is the
// /welcome page (4.1); "card" is the dashboard card that shows until every
// step is done (4.2). Presentational only: progress comes from
// fn_my_onboarding() via the page. No server-only imports, so the client
// dashboard can render it too.

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-orange transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function OnboardingChecklist({
  state,
  archetype,
  variant = "full",
}: {
  state: OnboardingState;
  archetype?: string | null;
  variant?: "full" | "card";
}) {
  const p = onboardingProgress(state);

  if (variant === "card") {
    if (p.complete || !p.next) return null;
    const next = p.next;
    return (
      <section className="rounded-2xl border border-orange/25 bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            Getting started · {p.doneCount}/{p.total}
          </p>
          <Link href="/welcome" className="text-[12.5px] font-semibold text-subtle transition-colors hover:text-ink">
            All five steps →
          </Link>
        </div>
        <div className="mt-2.5">
          <Bar pct={p.pct} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Day {next.day} · {next.stage}
            </p>
            <p className="mt-0.5 font-display text-[17px] font-bold tracking-tight text-ink">{next.title}</p>
            <p className="mt-0.5 text-[13px] text-subtle">
              {next.key === "desk" ? deskPitchFor(archetype) : next.blurb}
            </p>
          </div>
          <Link
            href={next.href}
            className="shrink-0 rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition-colors hover:bg-[#f24e12]"
          >
            Start
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="text-[13px] font-semibold uppercase tracking-wider text-orange">Start here</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Your first five days
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-subtle">
        One step a day. Each one sets up the next, and together they get the whole desk working for you.
      </p>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex-1">
          <Bar pct={p.pct} />
        </div>
        <span className="text-[13px] font-semibold text-ink">
          {p.doneCount}/{p.total} done
        </span>
      </div>

      <ol className="mt-6 space-y-3">
        {p.steps.map((s) => {
          const isNext = p.next?.key === s.key;
          return (
            <li
              key={s.key}
              className={`flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5 ${
                isNext ? "border-orange/40 ring-2 ring-orange/10" : "border-line"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  s.done ? "bg-orange text-white" : "border border-line-strong text-faint"
                }`}
              >
                {s.done ? <Check /> : s.day}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Day {s.day} · {s.stage}
                </p>
                <p className={`mt-0.5 font-display text-[16px] font-bold tracking-tight ${s.done ? "text-subtle line-through decoration-line-strong" : "text-ink"}`}>
                  {s.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-subtle">
                  {s.key === "desk" ? deskPitchFor(archetype) : s.blurb}
                </p>
              </div>
              {s.done ? (
                <span className="shrink-0 text-[12px] font-semibold text-faint">Done</span>
              ) : (
                <Link
                  href={s.href}
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                    isNext
                      ? "bg-orange text-white shadow-soft hover:bg-[#f24e12]"
                      : "border border-line-strong text-subtle hover:border-orange/40 hover:text-accent-ink"
                  }`}
                >
                  {isNext ? "Start" : "Open"}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {p.complete && (
        <p className="mt-4 rounded-2xl border border-orange/25 bg-accent-soft/40 px-5 py-3.5 text-[14px] text-ink">
          All five done. The roadmap below is the order to use everything else in.
        </p>
      )}
    </section>
  );
}
