import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAccess } from "@/lib/access";
import { logEventAfter } from "@/lib/events";
import { Wordmark } from "@/components/AppShell";
import { UpgradeFlow } from "./UpgradeFlow";
import { TierCards } from "./TierCards";
import { DepositSlider } from "./DepositSlider";
import { PlanFinder } from "./PlanFinder";
import { CompareGrid, UpgradeFaq } from "./CompareGrid";
import { DepositSubmitForm } from "./DepositSubmitForm";
import { LifetimePlans } from "./LifetimePlans";
import { isLifetimePlan, LIFETIME_PLANS } from "@/lib/lifetimePlans";
import { createClient } from "@/lib/supabase/server";
import { nextTierFor } from "@/lib/tiers";
import { depositRef } from "@/lib/depositRef";
import { AmeliaLastStep } from "./AmeliaLastStep";
import { regionFor } from "@/lib/brokerRegion";
import { RiskNotice } from "@/components/RiskNotice";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getT } from "@/i18n/server";
import { fmt, plural } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import type { Messages } from "@/i18n/messages/types";

// Geo-routed broker funnel (see memory mmfx-broker-funnel): US/UK -> contact,
// a fixed list of countries -> Dupoin, everyone else (ROW) + unknown -> Octa/Elev8.
//
// Broker regions get the redesigned pricing page (15 Sep, inspired by
// Higgsfield's): outcome-first tier cards, a deposit slider, a plan finder that
// uses the Know Your Style archetype, a comparison grid and an FAQ, around the
// existing broker steps and deposit form. US/UK keeps the lifetime plans.

// Copy stays compliance-safe: no profit/return language; the risk footer is
// verbatim. Broker regions: the deposit-you-own model (no fee). US/UK: a paid
// one-time lifetime membership, so the copy must differ, or it would falsely
// claim "no fee" to people who do pay. Words: messages/<locale>/upgrade.ts.

type Upgrade = Messages["upgrade"];

function SectionHead({ id, eyebrow, title, sub }: { id?: string; eyebrow: string; title: string; sub?: string }) {
  return (
    <div id={id} className="scroll-mt-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">{title}</h2>
      {sub && <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-subtle">{sub}</p>}
    </div>
  );
}

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ geo?: string }>;
}) {
  const access = await getAccess();
  if (!access.signedIn) {
    redirect("/login");
  }
  const t = await getT();
  const u: Upgrade = t.upgrade;

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
  // What their deposits have EARNED (labels and upgrade maths). Access may be
  // higher while an early depositor's trial is still running (accessTierFor).
  const earnedTier = access.earnedTier;
  const cumulative = Number(access.profile?.deposit_amount ?? 0) || 0;
  const isPaid = earnedTier === "foundation" || earnedTier === "desk" || earnedTier === "team";
  const isMember = access.profile?.account_status === "member_active";
  const next = isPaid ? nextTierFor(cumulative) : null;
  // A running trial clock, for a trial user or an early depositor.
  const trialDaysLeft = access.profile?.trial_ends_at ? access.daysLeft : 0;
  // Phase 6 — a US/UK lifetime member's plan.
  const lifetimePlan = isLifetimePlan(access.profile?.lifetime_plan) ? access.profile.lifetime_plan : null;

  // conversion-fix 5.1 — the latest deposit submission decides whether the
  // form or its review status shows.
  // The code the member sends @MM_3000 so the admin can match the DM.
  const refCode = access.profile ? depositRef(access.profile.id) : null;
  let latestSubmission: {
    status: "pending" | "verified" | "rejected" | "closed";
    amount: number | string;
    reject_reason: string | null;
    admin_dm_clicked_at: string | null;
    broker: string | null;
    trading_account_number: string | null;
  } | null = null;
  if (access.profile && !isContact) {
    // Filter to the viewer explicitly. RLS alone isn't enough: admins may read
    // every submission (the review queue), so without this an admin's own
    // /upgrade showed whoever submitted last.
    const { data } = await (await createClient())
      .from("deposit_submissions")
      .select("status, amount, reject_reason, admin_dm_clicked_at, broker, trading_account_number")
      .eq("user_id", access.profile.id)
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
  const assurances = Object.values(isContact ? u.assuranceContact : u.assuranceBroker);

  const headline = lifetimePlan === "team"
    ? u.headline.lifetimeTeam
    : earnedTier === "team"
      ? u.headline.wholeDesk
      : isPaid && next
        ? fmt(u.headline.topUpTo, {
            tier: t.tiers[earnedTier],
            amount: `$${next.topUp.toLocaleString("en-US")}`,
            next: t.tiers[next.next],
          })
        : onFree
          ? u.headline.onFree
          : u.headline.keepDesk;
  const subline = lifetimePlan
    ? lifetimePlan === "team"
      ? fmt(u.subline.lifetimeTeam, { plan: LIFETIME_PLANS.team.name })
      : fmt(u.subline.lifetimeMentorship, { plan: LIFETIME_PLANS.team_mentorship.name })
    : earnedTier === "team"
      ? u.subline.topTier
      : isPaid
        ? fmt(u.subline.deposited, { amount: `$${cumulative.toLocaleString("en-US")}` })
        : onFree
          ? u.subline.onFree
          : u.subline.trial;

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
        <div className="flex items-center gap-3">
          <LanguageSwitcher short />
          <Link
            href="/dashboard"
            className="whitespace-nowrap text-[13px] font-semibold text-subtle transition-colors hover:text-ink"
          >
            {u.backToDashboard}
          </Link>
        </div>
      </header>

      {/* A real countdown, never a manufactured one: only while a trial clock runs.
          An early depositor keeps the full desk until it ends (15 Sep rule). */}
      {!isContact && trialDaysLeft > 0 && (
        <div className="border-b border-orange/20 bg-accent-soft/50 px-5 py-2.5 text-center text-[13px] text-ink sm:px-8">
          <span className="font-semibold">{plural(trialDaysLeft, u.trialDaysOne, u.trialDaysOther)}</span>{" "}
          {isMember ? fmt(u.trialMember, { tier: t.tiers[earnedTier] }) : u.trialDeposit}
        </div>
      )}

      <article className="rise mx-auto max-w-5xl px-6 py-14 sm:py-16">
        {/* Headline */}
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">Market Makers FX</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
            {headline}
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-subtle">{subline}</p>
        </div>

        {isContact ? (
          <div className="max-w-2xl">
            {/* Phase 6 — the US/UK lifetime plans */}
            <p className="mt-10 text-[11px] font-semibold uppercase tracking-wider text-faint">{u.lifetimeHead}</p>
            <LifetimePlans currentPlan={lifetimePlan} />
          </div>
        ) : (
          <>
            {/* Tier cards */}
            <div className="mt-12 flex flex-wrap items-end justify-between gap-3">
              <SectionHead id="tiers" eyebrow={u.tiersEyebrow} title={u.tiersTitle} sub={u.tiersSub} />
              <a
                href="#finder"
                className="rounded-xl border border-line-strong bg-card px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink"
              >
                {u.notSure}
              </a>
            </div>
            <TierCards earnedTier={earnedTier} cumulative={cumulative} isMember={isMember} />

            {/* Slider + finder */}
            <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <SectionHead eyebrow={u.tryEyebrow} title={isMember ? u.tryTitleMember : u.tryTitle} />
                <div className="mt-4">
                  <DepositSlider cumulative={cumulative} isMember={isMember} />
                </div>
              </div>
              <div>
                <SectionHead id="finder" eyebrow={u.finderEyebrow} title={u.finderTitle} />
                <div className="mt-4">
                  <PlanFinder archetype={access.profile?.kys_archetype ?? null} isMember={isMember} />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="mx-auto max-w-2xl">
          {/* The reframe — region-aware (broker deposit model vs US/UK lifetime fee) */}
          <div className="mt-14">
            <p className="font-display text-2xl font-bold leading-snug tracking-tight text-ink sm:text-[28px]">
              {isContact
                ? rich(u.reframeContact, { highlight: <span className="text-orange">{u.reframeContactHighlight}</span> })
                : rich(u.reframeBroker, { highlight: <span className="text-orange">{u.reframeBrokerHighlight}</span> })}
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
            <p className="text-[16px] leading-relaxed text-ink">{isContact ? u.quoteContact : u.quoteBroker}</p>
          </blockquote>

          {/* How to open or top up — the geo-routed pathway */}
          <div id="get-started" className="mt-14 scroll-mt-6">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              {isPaid ? u.startTitlePaid : onFree ? u.startTitleFree : u.startTitleTrial}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-subtle">{u.startSub}</p>
            <div className="mt-7">
              <UpgradeFlow region={region} />
            </div>
          </div>

          {/* conversion-fix 5.1 / 5.4 — submit the deposit here: the primary
              way to get verified. Broker regions only; US/UK keeps its contact path. */}
          {!isContact && (
            <section id="submit-deposit" className="mt-14 scroll-mt-6 rounded-2xl border border-orange/30 bg-card p-6 shadow-soft sm:p-7">
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
                {isPaid ? u.submitTitlePaid : u.submitTitle}
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-subtle">{u.submitSub}</p>
              <div className="mt-6">
                {latestSubmission?.status === "pending" && refCode ? (
                  // The last step after submitting: message Admin Amelia. Stays
                  // here until the deposit is reviewed.
                  <AmeliaLastStep
                    refCode={refCode}
                    amount={Number(latestSubmission.amount)}
                    isTopUp={isPaid}
                    clicked={latestSubmission.admin_dm_clicked_at !== null}
                    broker={latestSubmission.broker}
                    account={latestSubmission.trading_account_number}
                  />
                ) : (
                  <>
                    {latestSubmission?.status === "rejected" && (
                      // The reason is written by the admin, so it shows as written.
                      <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13.5px] text-red-800">
                        {latestSubmission.reject_reason
                          ? fmt(u.rejectedWithReason, { reason: latestSubmission.reject_reason })
                          : u.rejected}
                      </p>
                    )}
                    <DepositSubmitForm
                      defaultBroker={region === "dupoin" ? "dupoin" : "octa"}
                      tradingview={access.profile?.tradingview_username ?? null}
                      isTopUp={isPaid}
                      refCode={refCode ?? ""}
                    />
                  </>
                )}
              </div>
              <p className="mt-5 text-[12.5px] text-faint">{u.needHelp}</p>
            </section>
          )}
        </div>

        {!isContact && (
          <>
            <div className="mt-16">
              <SectionHead eyebrow={u.compareEyebrow} title={u.compareTitle} />
              <div className="mt-4">
                <CompareGrid current={isPaid ? earnedTier : onFree ? "free" : null} />
              </div>
            </div>
            <div className="mx-auto mt-16 max-w-2xl">
              <SectionHead eyebrow={u.faqEyebrow} title={u.faqTitle} />
              <div className="mt-4">
                <UpgradeFaq />
              </div>
            </div>
          </>
        )}

        {/* Compliance footer — verbatim, do not remove */}
        <footer className="mt-16 border-t border-line pt-6 text-center">
          <RiskNotice className="text-[12px] leading-relaxed text-faint" />
        </footer>
      </article>
    </main>
  );
}
