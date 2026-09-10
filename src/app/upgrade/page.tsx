import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ComponentType, SVGProps } from "react";
import { getAccess } from "@/lib/access";
import { logEventAfter } from "@/lib/events";
import { Wordmark } from "@/components/AppShell";
import { UpgradeFlow, type Region } from "./UpgradeFlow";
import { TierCards } from "./TierCards";
import { DepositSubmitForm } from "./DepositSubmitForm";
import { createClient } from "@/lib/supabase/server";
import { nextTierFor, tierLabel } from "@/lib/tiers";
import {
  IndicatorsIcon, StrategiesIcon, LibraryIcon, CourseIcon, LiveIcon, SignalsIcon, DeskIcon, LockIcon,
} from "@/components/icons";

// Geo-routed broker funnel (see memory mmfx-broker-funnel): US/UK -> contact,
// a fixed list of countries -> Dupoin, everyone else (ROW) + unknown -> Octa/Elev8.
// The funnel itself lives in <UpgradeFlow>; this page is the pitch + lock manifest.
//
// Dupoin countries: Canada, the EU/EEA member states, Iran, Israel, Japan,
// Myanmar, New Zealand, North Korea, the Philippines, Singapore.
const DUPOIN_COUNTRIES = new Set<string>([
  "CA", // Canada
  // EU member states
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // EEA (non-EU) member states
  "IS", "LI", "NO",
  "IR", // Iran
  "IL", // Israel
  "JP", // Japan
  "MM", // Myanmar
  "NZ", // New Zealand
  "KP", // North Korea
  "PH", // The Philippines
  "SG", // Singapore
]);

function regionFor(country: string): Region {
  if (country === "US" || country === "GB") return "contact";
  if (DUPOIN_COUNTRIES.has(country)) return "dupoin";
  return "octa";
}

// Copy here stays compliance-safe (no profit/return language; risk footer kept
// verbatim). The original word-heavy prose was condensed into a visual manifest
// + the step pathway per Gordon's brief.
type Icon = ComponentType<SVGProps<SVGSVGElement>>;
const LOCKED_ITEMS: { label: string; icon: Icon }[] = [
  { label: "TradingView indicators", icon: IndicatorsIcon },
  { label: "Backtestable strategies", icon: StrategiesIcon },
  { label: "The MM System & playbooks", icon: LibraryIcon },
  { label: "The full course (Module 1 stays free)", icon: CourseIcon },
  { label: "Live classes with the desk", icon: LiveIcon },
  { label: "Daily signals", icon: SignalsIcon },
  { label: "The Fundamental Desk", icon: DeskIcon },
];

// Broker regions: the deposit-you-own model (no fee). US/UK: a paid one-time
// lifetime membership (the brokers can't host them) — so the copy must differ,
// or it would falsely claim "no fee" to people who do pay.
const ASSURANCES_BROKER = ["No subscription", "No card on file", "No fee", "The deposit stays yours"];
const ASSURANCES_CONTACT = ["One-time payment", "Lifetime access", "No recurring fees", "Details on Telegram"];

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ geo?: string }>;
}) {
  const access = await getAccess();
  if (!access.signedIn) {
    redirect("/login");
  }

  // Admins can preview any region with ?geo=XX (e.g. ?geo=MY, ?geo=US). The
  // override is ignored for everyone else, so it can't be used to pick a broker.
  const isAdmin = access.profile?.is_admin === true;
  const { geo } = await searchParams;
  const override = isAdmin && typeof geo === "string" && geo.trim() ? geo.trim().toUpperCase() : null;
  const headerCountry = ((await headers()).get("x-vercel-ip-country") ?? "").toUpperCase();
  const region = regionFor(override ?? headerCountry);
  const isContact = region === "contact";
  // conversion-fix 2.5 — an expired trial is on Free (the reverse trial), so it
  // is never told its access "ended". A live trial gets forward-looking copy.
  const onFree = access.tier !== "Full";
  // conversion-fix 3.6 — paid members see their tier, their cumulative
  // deposits and the top-up to the next tier.
  const memberTier = access.memberTier;
  const cumulative = Number(access.profile?.deposit_amount ?? 0) || 0;
  const isPaid = memberTier === "foundation" || memberTier === "desk" || memberTier === "team";
  const next = isPaid ? nextTierFor(cumulative) : null;

  // conversion-fix 5.1 — the latest deposit submission decides whether the
  // form or its review status shows (RLS: a user reads only their own).
  let latestSubmission: {
    status: "pending" | "verified" | "rejected";
    amount: number | string;
    reject_reason: string | null;
  } | null = null;
  if (access.profile && !isContact) {
    const { data } = await (await createClient())
      .from("deposit_submissions")
      .select("status, amount, reject_reason")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestSubmission = data;
  }

  // conversion-fix 1.3 — the top of the upgrade funnel. Admin ?geo= previews
  // aren't real visits, so they aren't counted.
  if (access.profile && !override) {
    logEventAfter(access.profile.id, "upgrade_viewed", { region });
  }
  const assurances = isContact ? ASSURANCES_CONTACT : ASSURANCES_BROKER;

  return (
    <main className="min-h-screen bg-paper">
      {override && (
        <div className="bg-ink px-5 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white">
          Admin preview · geo={override} → {region}
        </div>
      )}
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
          {memberTier === "team"
            ? "You have the whole desk."
            : isPaid && next
              ? `You're on ${tierLabel(memberTier)}. Top up $${next.topUp.toLocaleString("en-US")} to unlock ${tierLabel(next.next)}.`
              : onFree
                ? "You're on Free. Your desk is still set."
                : "Keep your whole desk after the trial."}
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-subtle">
          {memberTier === "team"
            ? "Team MM is the top tier: nothing left to unlock."
            : isPaid
              ? `You've deposited $${cumulative.toLocaleString("en-US")} so far, and it stays yours. Tiers count everything you've deposited, never your balance, so a drawdown never locks you out.`
              : onFree
                ? "Your trial has ended, so you're on the Free plan. Daily Analysis, the calendar, news, Know Your Style and Module 1 of the course stay open. The rest is locked, not gone."
                : "Right now everything is unlocked. Fund your account and it stays that way when your trial ends."}
        </p>

        {isContact ? (
          <>
            {/* What's locked — visual manifest */}
            <p className="mt-10 text-[11px] font-semibold uppercase tracking-wider text-faint">
              {onFree ? "What's locked on Free" : "What locks when the trial ends"}
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {LOCKED_ITEMS.map((item) => (
                <li
                  key={item.label}
                  className="relative flex items-center gap-3 rounded-xl border border-line bg-card/70 px-4 py-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper text-faint">
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 text-[13.5px] font-medium text-subtle">{item.label}</span>
                  <LockIcon className="absolute right-3 top-3 h-3.5 w-3.5 text-faint/60" />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {/* conversion-fix 3.6 — three tiers on cumulative deposits */}
            <p className="mt-10 text-[11px] font-semibold uppercase tracking-wider text-faint">
              Three tiers · on everything you&apos;ve deposited, never your balance
            </p>
            <TierCards memberTier={memberTier} cumulative={cumulative} />
          </>
        )}

        {/* The reframe — region-aware (broker deposit model vs US/UK lifetime fee) */}
        <div className="mt-12">
          <p className="font-display text-2xl font-bold leading-snug tracking-tight text-ink sm:text-[28px]">
            {isContact ? (
              <>
                In your region, access is a one-time{" "}
                <span className="text-orange">lifetime membership.</span>
              </>
            ) : (
              <>
                None of it is a purchase. Start at $50, and{" "}
                <span className="text-orange">it stays yours.</span>
              </>
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {assurances.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-[12.5px] font-medium text-ink"
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-orange" />
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* The mechanism — founder voice, region-aware */}
        <blockquote className="mt-10 rounded-2xl border border-line bg-accent-soft/40 p-6">
          <p className="text-[16px] leading-relaxed text-ink">
            {isContact ? (
              <>
                Where you are, the brokers I work with can&apos;t take clients — so
                I can&apos;t fund your seat through a deposit like I do elsewhere.
                Instead it&apos;s a single lifetime payment, and we&apos;ll sort the
                details with you directly on Telegram.
              </>
            ) : (
              <>
                I don&apos;t charge traders for education, and I never will. When you
                fund your own account, the broker funds your seat — your money goes
                into your trading, not a subscription.
              </>
            )}
          </p>
        </blockquote>

        {/* How to reopen — the geo-routed pathway */}
        <div className="mt-14">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            {isPaid ? "Top up through your broker" : onFree ? "Reopen your desk" : "Keep your desk"}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-subtle">
            A few steps and your access switches back on. Follow the path that fits you.
          </p>
          <div className="mt-7">
            <UpgradeFlow region={region} />
          </div>
        </div>

        {/* conversion-fix 5.1 / 5.4 — submit the deposit here: the primary
            way to get verified. Broker regions only; US/UK keeps its contact path. */}
        {!isContact && (
          <section id="submit-deposit" className="mt-14 rounded-2xl border border-orange/30 bg-card p-6 shadow-soft sm:p-7">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              {isPaid ? "Submit a top-up" : "Deposited? Submit it here"}
            </h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-subtle">
              Upload a screenshot of the deposit. We check it against your account and switch your
              access on. Tiers count every deposit you&apos;ve made, so a top-up moves you up.
            </p>
            <div className="mt-6">
              {latestSubmission?.status === "pending" ? (
                <p className="rounded-xl border border-orange/25 bg-accent-soft/40 px-4 py-3 text-[14px] text-ink">
                  {`Your $${Number(latestSubmission.amount).toLocaleString("en-US")} deposit is waiting for review. We'll switch your access on as soon as it's verified.`}
                </p>
              ) : (
                <>
                  {latestSubmission?.status === "rejected" && (
                    <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13.5px] text-red-800">
                      Your last submission wasn&apos;t verified
                      {latestSubmission.reject_reason ? `: ${latestSubmission.reject_reason}` : "."} You can
                      submit again below.
                    </p>
                  )}
                  <DepositSubmitForm
                    defaultBroker={region === "dupoin" ? "dupoin" : "octa"}
                    tradingview={access.profile?.tradingview_username ?? null}
                    isTopUp={isPaid}
                  />
                </>
              )}
            </div>
            <p className="mt-5 text-[12.5px] text-faint">
              Need help? Message us on WhatsApp or Telegram using the buttons above.
            </p>
          </section>
        )}

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
