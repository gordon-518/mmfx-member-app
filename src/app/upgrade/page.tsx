import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ComponentType, SVGProps } from "react";
import { getAccess } from "@/lib/access";
import { Wordmark } from "@/components/AppShell";
import { UpgradeFlow, type Region } from "./UpgradeFlow";
import {
  IndicatorsIcon, StrategiesIcon, LibraryIcon, CourseIcon, LiveIcon, SignalsIcon, DeskIcon, LockIcon,
} from "@/components/icons";

// Geo-routed broker funnel (see memory mmfx-broker-funnel): MY/ID -> Octa/Elev8,
// US/UK -> contact, rest of world + unknown -> Dupoin. The funnel itself lives
// in <UpgradeFlow>; this page is the pitch + the visual lock manifest.
function regionFor(country: string): Region {
  if (country === "MY" || country === "ID") return "octa";
  if (country === "US" || country === "GB") return "contact";
  return "dupoin";
}

// Copy here stays compliance-safe (no profit/return language; risk footer kept
// verbatim). The original word-heavy prose was condensed into a visual manifest
// + the step pathway per Gordon's brief.
type Icon = ComponentType<SVGProps<SVGSVGElement>>;
const LOCKED_ITEMS: { label: string; icon: Icon }[] = [
  { label: "TradingView indicators", icon: IndicatorsIcon },
  { label: "Backtestable strategies", icon: StrategiesIcon },
  { label: "The MM System & playbooks", icon: LibraryIcon },
  { label: "Full video curriculum", icon: CourseIcon },
  { label: "Two live classes a week", icon: LiveIcon },
  { label: "Daily signals", icon: SignalsIcon },
  { label: "Know Your Style & the Macro desk", icon: DeskIcon },
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
          Your 14 days are up. Your desk is still set.
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-subtle">
          For two weeks you traded the MM System with everything unlocked. As of
          today the tools are locked — not gone.
        </p>

        {/* What's locked — visual manifest */}
        <p className="mt-10 text-[11px] font-semibold uppercase tracking-wider text-faint">
          What just went quiet
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
                Keeping all of it isn&apos;t a $500 purchase. It&apos;s{" "}
                <span className="text-orange">$500 that stays yours.</span>
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
            Reopen your desk
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-subtle">
            A few steps and your access switches back on. Follow the path that fits you.
          </p>
          <div className="mt-7">
            <UpgradeFlow region={region} />
          </div>
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
