"use client";

import { Fragment } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { headerContent } from "./headerContent";
import type { AccountStatus, AccessTier } from "@/lib/trial/status";
import { ArrowIcon, LockIcon, LibraryIcon, AnalysisIcon, LiveIcon, SignalsIcon, NewsIcon } from "@/components/icons";
import { Spotlight, type SpotlightSlide } from "./Spotlight";
import { MarketBar } from "./MarketBar";
import { STAGES, FOUNDATIONS, type RailCard } from "./rails";
import type { DashboardBrief } from "./page";
import type { NewsItem } from "@/lib/forexNews";

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function biasChip(bias: string | null): string {
  if (bias === "bullish") return "bg-accent-soft text-accent-ink";
  if (bias === "bearish") return "bg-ink/5 text-ink";
  return "bg-paper text-subtle";
}

function nextClassLabel(d: number | null): string {
  if (d == null) return "None scheduled";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `in ${d} days`;
}

function BriefCard({
  icon: Icon,
  label,
  value,
  chip,
  href,
}: {
  icon: typeof AnalysisIcon;
  label: string;
  value: string;
  chip?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:shadow-soft-lg"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
        <Icon width={18} height={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</span>
        {chip ? (
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[13px] font-semibold ${chip}`}>
            {value}
          </span>
        ) : (
          <span className="mt-0.5 block truncate text-[15px] font-bold tracking-tight text-ink">{value}</span>
        )}
      </span>
    </Link>
  );
}

function TodaysBrief({ brief }: { brief: DashboardBrief }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <BriefCard
        icon={AnalysisIcon}
        label="Gold bias today"
        value={brief.bias ? titleCase(brief.bias) : "See the read"}
        chip={brief.bias ? biasChip(brief.bias) : undefined}
        href="/daily-analysis"
      />
      <BriefCard
        icon={LiveIcon}
        label="Next live class"
        value={nextClassLabel(brief.nextClassInDays)}
        href="/live-classes"
      />
      <BriefCard
        icon={SignalsIcon}
        label="Latest read"
        value={brief.latestDate ? `${brief.latestDate}${brief.session ? ` · ${brief.session}` : ""}` : "Daily Analysis"}
        href="/daily-analysis"
      />
    </div>
  );
}

function FeatureCard({ card, locked }: { card: RailCard; locked: boolean }) {
  const href = locked ? "/upgrade" : card.href;
  return (
    <Link
      href={href}
      aria-label={locked ? `${card.title} — upgrade to unlock` : card.title}
      className={`group flex items-start gap-3 rounded-xl border border-line bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:shadow-soft-lg ${
        locked ? "opacity-75 hover:opacity-100" : ""
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
        <card.icon width={18} height={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-display text-[14px] font-bold tracking-tight text-ink">{card.title}</span>
          {locked ? (
            <LockIcon width={14} height={14} className="shrink-0 text-faint" />
          ) : (
            <ArrowIcon width={15} height={15} className="shrink-0 text-faint transition-all group-hover:translate-x-0.5 group-hover:text-orange" />
          )}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-subtle">{card.blurb}</span>
      </span>
    </Link>
  );
}

const SENT_STYLE: Record<string, string> = {
  Positive: "bg-[#E1F5EE] text-[#0F6E56]",
  Negative: "bg-[#FCEBEB] text-[#A32D2D]",
  Neutral: "bg-paper text-subtle",
};

function fmtNewsDate(d: string): string {
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ""
    : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function NewsTeaser({ items }: { items: NewsItem[] }) {
  return (
    <div className="rise mt-10" style={{ animationDelay: "0.3s" }}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
          <NewsIcon width={18} height={18} className="text-accent-ink" /> Forex &amp; macro news
        </h3>
        <Link href="/news" className="text-[13px] font-semibold text-orange transition-colors hover:text-accent-ink">
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((n) => (
          <a
            key={n.url}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:shadow-soft-lg"
          >
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-accent-soft">
              <NewsIcon width={26} height={26} className="text-accent-ink/40" />
              {n.image && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={n.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              <span className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SENT_STYLE[n.sentiment] ?? "bg-paper text-subtle"}`}>
                {n.sentiment}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <span className="text-[11px] text-faint">
                {n.source}{fmtNewsDate(n.date) ? ` · ${fmtNewsDate(n.date)}` : ""}
              </span>
              <h4 className="mt-1 line-clamp-2 font-display text-[15px] font-bold leading-snug tracking-tight text-ink group-hover:text-accent-ink">
                {n.title}
              </h4>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {n.topics.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium text-subtle">{t}</span>
                ))}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export function DashboardClient({
  email,
  accountStatus,
  daysLeft,
  tier,
  slides,
  brief,
  news,
}: {
  email: string;
  accountStatus: AccountStatus;
  daysLeft: number;
  tier: AccessTier;
  slides: SpotlightSlide[];
  brief: DashboardBrief | null;
  news: NewsItem[];
}) {
  const head = headerContent(accountStatus, daysLeft);
  const locked = tier !== "Full";
  const firstName = email.split("@")[0];

  return (
    <AppShell email={email} accountStatus={accountStatus} tier={tier}>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Live market bar */}
        <div className="rise mb-6" style={{ animationDelay: "0s" }}>
          <MarketBar />
        </div>

        {/* Greeting */}
        <div className="rise" style={{ animationDelay: "0.04s" }}>
          <p className="text-[15px] text-subtle">Welcome back,</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink first-letter:uppercase">
            {firstName}
          </h1>
        </div>

        {/* Status hero */}
        <div
          className={`rise mt-6 overflow-hidden rounded-2xl border p-6 shadow-soft sm:p-7 ${
            head.cta?.kind === "push"
              ? "border-orange/25 bg-gradient-to-br from-[#FFF1E9] to-card"
              : "border-line bg-card"
          }`}
          style={{ animationDelay: "0.06s" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{head.eyebrow}</p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink">{head.title}</h2>
              {head.body && <p className="mt-1.5 text-[14px] leading-relaxed text-subtle">{head.body}</p>}
            </div>

            {head.cta ? (
              head.cta.kind === "push" ? (
                <Link href={head.cta.href} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg">
                  {head.cta.label} <ArrowIcon width={16} height={16} />
                </Link>
              ) : (
                <Link href={head.cta.href} className="shrink-0 text-[14px] font-semibold text-orange transition-colors hover:text-accent-ink">
                  {head.cta.label} →
                </Link>
              )
            ) : (
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-[13px] font-semibold text-accent-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-orange" /> Funded member
              </span>
            )}
          </div>
        </div>

        {/* Spotlight */}
        <div className="rise mt-6" style={{ animationDelay: "0.12s" }}>
          <Spotlight slides={slides} />
        </div>

        {/* Today's brief */}
        {brief && (
          <div className="rise mt-6" style={{ animationDelay: "0.16s" }}>
            <TodaysBrief brief={brief} />
          </div>
        )}

        {/* Workflow pipeline — the hook */}
        <div className="rise mt-10" style={{ animationDelay: "0.18s" }}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-lg font-bold tracking-tight text-ink">
              Everything you need to trade profitably
            </h3>
            {locked && <span className="hidden text-[13px] text-subtle sm:block">Unlock it all with full access</span>}
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {STAGES.map((stage, idx) => (
              <Fragment key={stage.n}>
                <div className="flex-1 rounded-2xl border border-line bg-accent-soft/20 p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent-ink">
                      {stage.n}
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-[15px] font-bold tracking-tight text-ink">{stage.label}</div>
                      <div className="text-[11px] text-faint">{stage.tagline}</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {stage.cards.map((c) => (
                      <FeatureCard key={c.key} card={c} locked={locked} />
                    ))}
                  </div>
                </div>

                {idx < STAGES.length - 1 && (
                  <div aria-hidden className="hidden shrink-0 items-center justify-center text-orange/60 lg:flex">
                    <ArrowIcon width={20} height={20} />
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>

        {/* Foundations */}
        <div className="rise mt-6 rounded-2xl border border-line bg-accent-soft/25 p-5" style={{ animationDelay: "0.24s" }}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
              <LibraryIcon width={18} height={18} />
            </span>
            <div>
              <h3 className="font-display text-[15px] font-bold tracking-tight text-ink">Foundations</h3>
              <p className="text-[12px] text-faint">The skill under all three</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FOUNDATIONS.map((c) => (
              <FeatureCard key={c.key} card={c} locked={locked} />
            ))}
          </div>
        </div>

        {/* Gold & macro headline news → /news */}
        {news.length > 0 && <NewsTeaser items={news} />}
      </div>
    </AppShell>
  );
}
