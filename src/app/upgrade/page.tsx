import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAccess } from "@/lib/access";
import { Wordmark } from "@/components/AppShell";

// ---------------------------------------------------------------------------
// Broker IB funnel — GEO-ROUTED. Each visitor sees only their region's path;
// there is intentionally no broker picker. See memory `mmfx-broker-funnel`.
//   • Malaysia / Indonesia  → Octa / Elev8 (they can serve MY/ID)
//   • United States / UK    → contact us (brokers can't serve them)
//   • Everyone else (+ unknown) → Dupoin (best partner terms, worldwide)
const OCTA_SIGNUP = "https://clickto.trade/bT8tAZDKvQY?ib=47807426";
const DUPOIN_SIGNUP = "https://dupoin.me/ett5od077";
const OCTA_CHANGE_IB = "https://my.octabroker.com/change-partner-request/";
const ELEV8_CHANGE_IB = "https://my.elev8.com/change-partner-request/";
const IB_NUMBER = "47807426";
const SWITCH_REASON = "They are assisting me in my trading with signals and analysis.";
const WHATSAPP_URL =
  "https://wa.me/6588035858?text=Hi%20MMFX%2C%20requesting%20upgrade.%20Broker%3A%20%5BOcta%2FDupoin%5D%20Account%23%3A%20%5Bnumber%5D%20Tier%3A%20%5BTeam%20MM%2FMentorship%5D";
const TELEGRAM_URL = "https://t.me/m/QBXboWUEMWRl";
const TELEGRAM_SWITCH = "https://t.me/MM_3000";
// ---------------------------------------------------------------------------

type Region = "octa" | "dupoin" | "contact";
function regionFor(country: string): Region {
  if (country === "MY" || country === "ID") return "octa";
  if (country === "US" || country === "GB") return "contact";
  return "dupoin"; // rest of world + unknown
}

const PRIMARY_BTN =
  "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange px-8 py-4 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg sm:w-auto";
const SECONDARY_BTN =
  "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong bg-card px-5 py-3 text-[14px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink sm:w-auto";

// Copy on this page is APPROVED VERBATIM (day5 brief). Do not rewrite, soften,
// or add profit/return language. The risk footer stays. Only the broker CTA
// block below the reassurance line is region-aware mechanism, not pitch copy.

const LOCKED_ITEMS = [
  "Your TradingView indicators",
  "The backtestable strategies",
  "The MM System, Decision Tree, If-Then, and Cheat Sheet",
  "The full video curriculum",
  "Two live classes a week",
  "The daily signals",
  "Know Your Style and the Fundamental Analysis desk",
];

/** Expandable "switch your IB" steps for existing Octa / Elev8 clients. */
function OctaSwitch() {
  return (
    <details className="group mt-8 overflow-hidden rounded-2xl border border-line bg-card text-left">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 text-[14px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span>Already trade with Octa or Elev8? Switch your IB to us instead</span>
        <span aria-hidden className="shrink-0 text-faint transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-4 border-t border-line px-6 py-5 text-[15px] leading-relaxed text-subtle">
        <p>Keep your existing account — just move your introducing broker to us. It switches over within about an hour.</p>
        <ol className="space-y-4">
          <li>
            <span className="font-medium text-ink">1. Open the change-partner form</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={OCTA_CHANGE_IB} target="_blank" rel="noopener noreferrer" className={SECONDARY_BTN}>Octa form ↗</a>
              <a href={ELEV8_CHANGE_IB} target="_blank" rel="noopener noreferrer" className={SECONDARY_BTN}>Elev8 form ↗</a>
            </div>
          </li>
          <li>
            <span className="font-medium text-ink">2. Enter our IB number</span>
            <div className="mt-2 select-all rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[15px] text-ink">{IB_NUMBER}</div>
          </li>
          <li>
            <span className="font-medium text-ink">3. Reason for switching</span>
            <div className="mt-2 rounded-lg border border-line bg-paper px-3 py-2 text-[14px] text-ink">“{SWITCH_REASON}”</div>
          </li>
          <li>
            <span className="font-medium text-ink">4. Hold at least $500</span>{" "}in the account so access can be restored.
          </li>
          <li>
            <span className="font-medium text-ink">5. Send us your details</span>{" "}on Telegram so we can add you — full name, Telegram username, trading account number, account balance, country, and TradingView username.
            <div className="mt-2">
              <a href={TELEGRAM_SWITCH} target="_blank" rel="noopener noreferrer" className={SECONDARY_BTN}>Message @MM_3000 ↗</a>
            </div>
          </li>
        </ol>
      </div>
    </details>
  );
}

/** Expandable "switch your IB" steps for existing Dupoin clients (manual). */
function DupoinSwitch() {
  return (
    <details className="group mt-8 overflow-hidden rounded-2xl border border-line bg-card text-left">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 text-[14px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span>Already trade with Dupoin? Switch your IB to us instead</span>
        <span aria-hidden className="shrink-0 text-faint transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-4 border-t border-line px-6 py-5 text-[15px] leading-relaxed text-subtle">
        <p>Keep your existing account — we&apos;ll move your introducing broker to us. We process this one by hand with Dupoin.</p>
        <ol className="space-y-4">
          <li>
            <span className="font-medium text-ink">1. Hold at least $500</span>{" "}in the account so access can be restored.
          </li>
          <li>
            <span className="font-medium text-ink">2. Find your Dupoin UID</span>{" "}— it&apos;s shown next to your name in your Dupoin profile.
          </li>
          <li>
            <span className="font-medium text-ink">3. Send us your Full Name and Dupoin UID</span>{" "}on Telegram and we&apos;ll process the switch with Dupoin.
            <div className="mt-2">
              <a href={TELEGRAM_SWITCH} target="_blank" rel="noopener noreferrer" className={SECONDARY_BTN}>Message @MM_3000 ↗</a>
            </div>
          </li>
        </ol>
      </div>
    </details>
  );
}

/** Broker CTA for MY/ID (Octa/Elev8) and the rest of the world (Dupoin). */
function BrokerCTA({ region }: { region: "octa" | "dupoin" }) {
  const signup = region === "octa" ? OCTA_SIGNUP : DUPOIN_SIGNUP;
  return (
    <div className="text-center">
      <a href={signup} target="_blank" rel="noopener noreferrer" className={PRIMARY_BTN}>
        Open your account — restore full access <span aria-hidden>→</span>
      </a>
      <p className="mt-4 text-[15px] leading-relaxed text-subtle">
        Deposit $500 with your broker, send your confirmation, and your access is switched back on.
      </p>
      {region === "octa" ? <OctaSwitch /> : <DupoinSwitch />}
    </div>
  );
}

/** Contact CTA for US/UK, where the partnered brokers can't operate. */
function ContactCTA() {
  return (
    <div className="rounded-2xl border border-line bg-card p-6 text-center shadow-soft">
      <p className="font-display text-xl font-bold tracking-tight text-ink">
        Access in your region is arranged directly
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-subtle">
        Reach out and we&apos;ll get you set up.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={PRIMARY_BTN}>
          Contact us on WhatsApp <span aria-hidden>→</span>
        </a>
        <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={SECONDARY_BTN}>
          Telegram ↗
        </a>
      </div>
    </div>
  );
}

export default async function UpgradePage() {
  const access = await getAccess();
  if (!access.signedIn) {
    redirect("/login");
  }

  const country = ((await headers()).get("x-vercel-ip-country") ?? "").toUpperCase();
  const region = regionFor(country);

  return (
    <main className="min-h-screen bg-paper">
      {/* Minimal top bar — focused conversion page, no member sidebar. */}
      <header className="flex items-center justify-between border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <Link href="/dashboard">
          <Wordmark />
        </Link>
        <Link
          href="/dashboard"
          className="text-[13px] font-semibold text-subtle transition-colors hover:text-ink"
        >
          ← Dashboard
        </Link>
      </header>

      <article className="rise mx-auto max-w-2xl px-6 py-14 sm:py-20">
        {/* Headline */}
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
          Market Makers FX
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
          Your 14 days are up. Your desk is still set.
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-subtle">
          For two weeks you traded the MM System with everything unlocked. As
          of today the tools are locked — not gone. Here&apos;s what just went
          quiet:
        </p>

        {/* What's locked — the manifest */}
        <ul className="mt-8 overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
          {LOCKED_ITEMS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 border-b border-line px-6 py-3 last:border-b-0"
            >
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
              <span className="text-[15px] text-ink">{item}</span>
            </li>
          ))}
        </ul>

        {/* The reframe */}
        <div className="mt-10">
          <p className="font-display text-2xl font-bold leading-snug tracking-tight text-ink">
            Keeping all of it isn&apos;t a $500 purchase. It&apos;s{" "}
            <span className="text-orange">$500 that stays yours.</span>
          </p>
          <p className="mt-4 text-[16px] leading-relaxed text-subtle">
            You fund your own trading account with $500 at your broker. That
            capital sits in <em className="font-medium not-italic text-ink">your</em> account, under{" "}
            <em className="font-medium not-italic text-ink">your</em> name — you trade it, you
            withdraw it. Nothing is paid to us. Fund your account, and the desk
            reopens.
          </p>
        </div>

        {/* The mechanism — founder voice */}
        <blockquote className="mt-10 rounded-2xl border border-line bg-accent-soft/40 p-6">
          <p className="text-[16px] leading-relaxed text-ink">
            I don&apos;t charge traders for education, and I never will. When
            you fund your own account, the broker funds your seat — that&apos;s
            how the desk stays free. Your money goes into your trading, not
            into a subscription.
          </p>
        </blockquote>

        {/* Reassurance */}
        <p className="mt-10 border-y border-line py-4 text-center text-[12px] font-semibold uppercase tracking-wider text-subtle">
          No subscription. No card on file. No fee. A deposit you own, and a
          desk that stays open.
        </p>

        {/* CTA — geo-routed broker funnel */}
        <div className="mt-10">
          {region === "contact" ? <ContactCTA /> : <BrokerCTA region={region} />}
        </div>

        {/* Compliance footer — verbatim, do not remove */}
        <footer className="mt-16 border-t border-line pt-6 text-center">
          <p className="text-[12px] leading-relaxed text-faint">
            Trading involves risk, including the possible loss of capital. No
            returns are guaranteed.
          </p>
        </footer>
      </article>
    </main>
  );
}
