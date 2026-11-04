import { requireFeature } from "@/lib/access";
import { LockedFeature } from "@/components/LockedFeature";
import { AppShell } from "@/components/AppShell";
import { ExternalIcon, SignalsIcon, AnalysisIcon } from "@/components/icons";
import { RiskNotice } from "@/components/RiskNotice";
import { getLocale, getT } from "@/i18n/server";
import type { Messages } from "@/i18n/messages/types";

// ---------------------------------------------------------------------------
// Telegram destinations. VIP is live; the three below are PLACEHOLDERS — Gordon
// sends the invite links and they get swapped in (same pattern as the broker
// link on /upgrade). The "#" links render but go nowhere until replaced.
const SIGNALS_URL = "https://t.me/+y_Pry2NERes5MDg9"; // the main signals channel (Gordon, 2026-06-15)
const PERFORMANCE_URL = "https://t.me/mmfx_academy/2825"; // weekly performance post (public channel)
const FEEDBACK_URL = "https://t.me/mmfx_academy/8"; // member feedback post (public channel)
// Official Telegram app stores.
const TELEGRAM_IOS = "https://apps.apple.com/app/telegram-messenger/id686449807";
const TELEGRAM_ANDROID = "https://play.google.com/store/apps/details?id=org.telegram.messenger";

// Operational facts (not return promises) — Gordon confirms/edits. Real
// performance lives in the weekly-performance channel linked below.
function signalStats(s: Messages["signals"]) {
  return [
    { label: s.statCalls, value: "3–5" },
    { label: s.statRr, value: "1 : 2+" },
    { label: s.statSessions, value: s.statSessionsValue },
    { label: s.statRecap, value: s.statRecapValue },
  ];
}
// ---------------------------------------------------------------------------

function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

function channels(s: Messages["signals"]) {
  return [
    { key: "performance", title: s.performanceTitle, desc: s.performanceBody, href: PERFORMANCE_URL, icon: AnalysisIcon },
    { key: "feedback", title: s.feedbackTitle, desc: s.feedbackBody, href: FEEDBACK_URL, icon: SignalsIcon },
  ];
}

export default async function SignalsPage() {
  // Gate (conversion-fix 2.2): signed-out -> /login; locked -> preview.
  const gate = await requireFeature("signals");
  if (gate.locked) return <LockedFeature feature="signals" gate={gate} />;
  const profile = gate.profile;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const s = t.signals;

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} memberTier={gate.viewer.tier} isAdmin={profile.is_admin}>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{s.eyebrow}</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">{s.title}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">{s.subtitle}</p>
          {locale !== "en" && <p className="mt-1.5 text-[12.5px] text-faint">{s.contentNote}</p>}
        </div>

        {/* Stats strip */}
        <div className="rise mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {signalStats(s).map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line bg-card p-4 shadow-soft">
              <p className="font-display text-xl font-bold tracking-tight text-ink">{stat.value}</p>
              <p className="mt-0.5 text-[12px] text-subtle">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* The signals channel — primary */}
        <a
          href={SIGNALS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rise group mt-8 flex flex-col gap-5 overflow-hidden rounded-2xl border border-orange/25 bg-gradient-to-br from-[#FFF1E9] to-card p-6 shadow-soft transition-all hover:shadow-soft-lg sm:flex-row sm:items-center sm:p-7"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange text-white shadow-soft">
            <SignalsIcon width={26} height={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{s.channelEyebrow}</p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink">{s.channelTitle}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-subtle">{s.channelBody}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all group-hover:bg-[#f24e12]">
            {s.openChannel} <ExternalIcon width={15} height={15} />
          </span>
        </a>

        {/* Other channels */}
        <p className="rise mb-4 mt-10 text-[12px] font-semibold uppercase tracking-wider text-faint">
          {s.more}
        </p>
        <div className="rise grid grid-cols-1 gap-4 sm:grid-cols-2">
          {channels(s).map((c) => (
            <a
              key={c.key}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-2xl border border-line bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:shadow-soft-lg"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                <c.icon width={20} height={20} />
              </span>
              <h3 className="mt-4 font-display text-[16px] font-bold tracking-tight text-ink">{c.title}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-subtle">{c.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-orange transition-colors group-hover:text-accent-ink">
                {s.openTelegram} <ExternalIcon width={13} height={13} />
              </span>
            </a>
          ))}
        </div>

        {/* Get Telegram */}
        <div className="rise mt-10 flex flex-col gap-5 rounded-2xl border border-line bg-accent-soft/25 p-6 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-soft">
            <TelegramIcon size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[17px] font-bold tracking-tight text-ink">{s.newTitle}</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-subtle">{s.newBody}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5">
            <a
              href={TELEGRAM_IOS}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-card px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink"
            >
              <TelegramIcon size={15} /> App Store
            </a>
            <a
              href={TELEGRAM_ANDROID}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-card px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink"
            >
              <TelegramIcon size={15} /> Google Play
            </a>
          </div>
        </div>

        {/* Compliance footer */}
        <footer className="mt-10 border-t border-line pt-6">
          <RiskNotice pastPerformance className="text-[12px] leading-relaxed text-faint" />
        </footer>
      </div>
    </AppShell>
  );
}
