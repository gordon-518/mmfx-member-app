import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { ExternalIcon, SignalsIcon, AnalysisIcon } from "@/components/icons";

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
const SIGNAL_STATS = [
  { label: "Calls a day", value: "3–5" },
  { label: "Risk : reward", value: "1 : 2+" },
  { label: "Sessions", value: "London · NY" },
  { label: "Performance recap", value: "Weekly" },
];
// ---------------------------------------------------------------------------

function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

const CHANNELS = [
  {
    key: "performance",
    title: "Weekly Performance",
    desc: "Every week's results posted in full — the track record, in the open.",
    href: PERFORMANCE_URL,
    icon: AnalysisIcon,
  },
  {
    key: "feedback",
    title: "Community & Feedback",
    desc: "Real member feedback and results from people trading the calls.",
    href: FEEDBACK_URL,
    icon: SignalsIcon,
  },
];

export default async function SignalsPage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">Live · XAU/USD</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">The signals desk</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            A few high-conviction gold calls a day — entry, stop and target, written down before the
            click. No filler. When there&apos;s nothing worth taking, we say so.
          </p>
        </div>

        {/* Stats strip */}
        <div className="rise mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SIGNAL_STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-card p-4 shadow-soft">
              <p className="font-display text-xl font-bold tracking-tight text-ink">{s.value}</p>
              <p className="mt-0.5 text-[12px] text-subtle">{s.label}</p>
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
            <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">Live · Telegram</p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink">MMFX Signals Channel</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-subtle">
              The calls post here as they&apos;re taken. Turn notifications on so you don&apos;t miss the window.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all group-hover:bg-[#f24e12]">
            Open the channel <ExternalIcon width={15} height={15} />
          </span>
        </a>

        {/* Other channels */}
        <p className="rise mb-4 mt-10 text-[12px] font-semibold uppercase tracking-wider text-faint">
          More from the desk
        </p>
        <div className="rise grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CHANNELS.map((c) => (
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
                Open on Telegram <ExternalIcon width={13} height={13} />
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
            <h3 className="font-display text-[17px] font-bold tracking-tight text-ink">New to Telegram?</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-subtle">
              Every channel above lives on Telegram. Grab the free app, then tap any link to join.
            </p>
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
          <p className="text-[12px] leading-relaxed text-faint">
            Trading involves risk, including the possible loss of capital. No returns are guaranteed.
            Past performance is not indicative of future results.
          </p>
        </footer>
      </div>
    </AppShell>
  );
}
