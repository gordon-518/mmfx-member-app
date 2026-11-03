import Link from "next/link";
import { getAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { parseOnboarding, type OnboardingState } from "@/lib/onboarding";
import { DashboardClient } from "./DashboardClient";
import { LESSONS, MODULES } from "@/app/course/courseData";
import type { DimensionScores } from "@/lib/kys/types";
import { TradingAccountGate } from "./TradingAccountGate";
import type { SpotlightSlide } from "./Spotlight";
import { getNews, type NewsCard } from "@/lib/forexNews";
import { getLocale, getT } from "@/i18n/server";
import { dayLabel, shortDateLabel } from "@/i18n/dates";
import { lessonText, moduleText } from "@/i18n/course";
import { sessionLabel } from "@/lib/sessions";
import { INTL_LOCALE } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import type { Messages } from "@/i18n/messages/types";

function Centered({
  eyebrow,
  title,
  body,
  cta,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md text-center">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-subtle">{body}</p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
          >
            {cta.label} →
          </Link>
        )}
      </div>
    </main>
  );
}

// Pure: format an ISO date (YYYY-MM-DD or full timestamp) to "11 Jun". Kept out
// of the component body so the date read isn't flagged as impure during render.
// The evergreen slides. Built per request from the reader's dictionary; the
// course count comes from the syllabus itself rather than a typed "19".
function evergreenSlides(t: Messages): SpotlightSlide[] {
  const d = t.dashboard;
  return [
    {
      key: "course",
      eyebrow: fmt(d.slideCourseEyebrow, { n: LESSONS.length }),
      title: d.slideCourseTitle,
      body: d.slideCourseBody,
      cta: { label: d.slideCourseCta, href: "/course" },
      image: { src: "/dashboard/spotlight-course.jpg", alt: d.slideCourseAlt },
    },
    {
      key: "fundamental",
      eyebrow: d.slideFundamentalEyebrow,
      title: d.slideFundamentalTitle,
      body: d.slideFundamentalBody,
      cta: { label: d.slideFundamentalCta, href: "/bots/fundamental" },
      image: { src: "/dashboard/spotlight-fundamental.jpg", alt: d.slideFundamentalAlt },
    },
    {
      key: "know-your-style",
      eyebrow: d.slideKysEyebrow,
      title: d.slideKysTitle,
      body: d.slideKysBody,
      cta: { label: d.slideKysCta, href: "/bots/know-your-style" },
      image: { src: "/dashboard/spotlight-knowstyle.jpg", alt: d.slideKysAlt },
    },
  ];
}

// Whole days from now until an ISO timestamp, rounded up. Kept out of the
// component body so the time read isn't flagged as impure during render.
function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export interface DashboardBrief {
  bias: string | null;
  session: string | null;
  latestDate: string | null;
  nextClassInDays: number | null;
}

export default async function DashboardPage() {
  const access = await getAccess();
  const t = await getT();
  const intl = INTL_LOCALE[await getLocale()];

  if (!access.signedIn) {
    return (
      <Centered
        eyebrow={t.dashboard.notSignedInEyebrow}
        title={t.dashboard.notSignedInTitle}
        body={t.dashboard.notSignedInBody}
        cta={{ href: "/login", label: t.dashboard.goToLogin }}
      />
    );
  }

  if (!access.profile) {
    return (
      <Centered
        eyebrow={t.dashboard.settingUpEyebrow}
        title={t.dashboard.settingUpTitle}
        body={t.dashboard.settingUpBody}
      />
    );
  }

  const locked = access.tier !== "Full";

  // Funded members must save a trading account number before the desk unlocks.
  if (
    access.profile.account_status === "member_active" &&
    !access.profile.trading_account_number &&
    !access.profile.lifetime_plan
  ) {
    return <TradingAccountGate />;
  }

  // Full-access users who haven't finished Know Your Style get the onboarding
  // hero pinned atop the desk (see KnowYourStyleOnboarding).
  const showKysOnboarding = !locked && !access.profile.kys_completed_at;

  // Build the spotlight server-side from real, timely content. Locked users get
  // a single upgrade-nudge slide instead of gated content.
  let slides: SpotlightSlide[];
  let brief: DashboardBrief | null = null;
  let news: NewsCard[] = [];
  if (locked) {
    // Free plan (conversion-fix 2.3): Daily Analysis is open to every signed-in
    // user, so lead with today's read, then what funding unlocks.
    const supabase = await createClient();
    const { data: latest } = await supabase
      .from("daily_analysis")
      .select("title, description, published_on, cover_path")
      .eq("is_published", true)
      .order("published_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    slides = [];
    if (latest) {
      const coverUrl = latest.cover_path
        ? supabase.storage.from("analysis-covers").getPublicUrl(latest.cover_path).data.publicUrl
        : null;
      slides.push({
        key: "analysis",
        eyebrow: fmt(t.dashboard.slideAnalysisEyebrow, { date: dayLabel(latest.published_on, intl) }),
        title: latest.title,
        body: latest.description ?? t.dashboard.slideAnalysisBody,
        cta: { label: t.dashboard.slideAnalysisCta, href: "/daily-analysis" },
        image: coverUrl
          ? { src: coverUrl, alt: latest.title, fit: "contain", dark: true }
          : { src: "/dashboard/spotlight-live.jpg", alt: latest.title },
      });
    }
    slides.push({
      key: "upgrade",
      eyebrow: t.dashboard.slideFreeEyebrow,
      title: t.dashboard.slideFreeTitle,
      body: t.dashboard.slideFreeBody,
      cta: { label: t.dashboard.slideFreeCta, href: "/upgrade" },
      image: { src: "/dashboard/spotlight-course.jpg", alt: "" },
    });
  } else {
    const supabase = await createClient();

    const { data: latest } = await supabase
      .from("daily_analysis")
      .select("title, description, published_on, cover_path, bias, session_tag")
      .eq("is_published", true)
      .order("published_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: nextClass } = await supabase
      .from("live_classes")
      .select("title, starts_at")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    slides = [];

    if (latest) {
      const coverUrl = latest.cover_path
        ? supabase.storage.from("analysis-covers").getPublicUrl(latest.cover_path).data.publicUrl
        : null;
      slides.push({
        key: "analysis",
        eyebrow: fmt(t.dashboard.slideAnalysisEyebrow, { date: dayLabel(latest.published_on, intl) }),
        title: latest.title,
        body: latest.description ?? t.dashboard.slideAnalysisBody,
        cta: { label: t.dashboard.slideAnalysisCta, href: "/daily-analysis" },
        image: coverUrl
          ? { src: coverUrl, alt: latest.title, fit: "contain", dark: true }
          : { src: "/dashboard/spotlight-live.jpg", alt: latest.title },
      });
    }

    if (nextClass) {
      slides.push({
        key: "live",
        eyebrow: fmt(t.dashboard.slideLiveEyebrow, { date: dayLabel(nextClass.starts_at, intl) }),
        title: nextClass.title,
        body: t.dashboard.slideLiveBody,
        cta: { label: t.dashboard.slideLiveCta, href: "/live-classes" },
        image: { src: "/dashboard/spotlight-course-alt.jpg", alt: t.dashboard.slideLiveAlt },
      });
    }

    // Evergreen variety — keep the rotation fresh beyond desk + education.
    slides.push(...evergreenSlides(t));

    brief = {
      bias: latest?.bias ?? null,
      session: sessionLabel(latest?.session_tag, t.dailyAnalysis.sessions),
      latestDate: latest ? dayLabel(latest.published_on, intl) : null,
      nextClassInDays: nextClass ? daysUntil(nextClass.starts_at) : null,
    };

    // Top gold/macro headlines for the dashboard teaser (cached fetch shared
    // with /news, so no extra quota burn).
    news = (await getNews()).slice(0, 6).map((n) => ({ ...n, dateLabel: shortDateLabel(n.date, intl, false) }));
  }

  // conversion-fix 4.2 — the onboarding card, for trial and Free users until
  // all five steps are done. Paid members are past onboarding; skip the read.
  let onboarding: OnboardingState | null = null;
  if (access.memberTier === "trial" || access.memberTier === "free") {
    const { data: onboardingRaw } = await (await createClient()).rpc("fn_my_onboarding");
    onboarding = parseOnboarding(onboardingRaw);
  }

  // The member's own row: lessons watched anywhere (20261022000003) and
  // their Know Your Style scores, for the "what you're building" track.
  const { data: progressRow } = await (await createClient())
    .from("profiles")
    .select("course_watched, kys_dimensions")
    .eq("id", access.profile.id)
    .maybeSingle();

  // Client-safe syllabus for the track: slugs and titles only.
  // ...in the reader's language: titles come from the syllabus dictionary.
  const courseTrack = MODULES.map((m) => ({
    id: m.id,
    title: moduleText(t, m.id, m).title,
    lessons: LESSONS.filter((l) => l.number >= m.from && l.number <= m.to).map((l) => ({
      slug: l.slug,
      title: lessonText(t, l.slug, l).title,
    })),
  }));

  return (
    <DashboardClient
      email={access.profile.email}
      fullName={access.profile.full_name}
      accountStatus={access.profile.account_status}
      daysLeft={access.daysLeft}
      tier={access.tier}
      memberTier={access.memberTier}
      slides={slides}
      brief={brief}
      news={news}
      showKysOnboarding={showKysOnboarding}
      isAdmin={access.profile.is_admin}
      tradingAccount={access.profile.trading_account_number}
      onboarding={onboarding}
      kysArchetype={access.profile.kys_archetype}
      courseTrack={courseTrack}
      courseWatched={(progressRow?.course_watched as string[] | null) ?? []}
      kysDimensions={(progressRow?.kys_dimensions as DimensionScores | null) ?? null}
    />
  );
}
