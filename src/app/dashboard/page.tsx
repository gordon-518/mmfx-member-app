import Link from "next/link";
import { getAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";
import type { SpotlightSlide } from "./Spotlight";
import { getNews, type NewsItem } from "@/lib/forexNews";

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
function fmtDay(value: string): string {
  const d = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

const COURSE_SLIDE: SpotlightSlide = {
  key: "course",
  eyebrow: "Education · 19 lessons",
  title: "Learn the MM System",
  body: "The full curriculum, basic to advanced — the read, the tools, and how to manage the trade.",
  cta: { label: "Open the course", href: "/course" },
  image: { src: "/dashboard/spotlight-course.jpg", alt: "The MM System course on a laptop" },
};

const FUNDAMENTAL_SLIDE: SpotlightSlide = {
  key: "fundamental",
  eyebrow: "Bots · Macro",
  title: "The Fundamental Desk",
  body: "The live macro read on gold — the current fundamental picture driving XAU/USD, on demand.",
  cta: { label: "Open the desk", href: "/bots/fundamental" },
  image: { src: "/dashboard/spotlight-fundamental.jpg", alt: "MM Analyst fundamental desk on a phone" },
};

const KNOWSTYLE_SLIDE: SpotlightSlide = {
  key: "know-your-style",
  eyebrow: "Bots · Profile",
  title: "Know Your Style",
  body: "Find your trader archetype — answer a few questions and get a profile tailored to how you trade.",
  cta: { label: "Take the quiz", href: "/bots/know-your-style" },
  image: { src: "/dashboard/spotlight-knowstyle.jpg", alt: "A trader studying gold charts" },
};

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

  if (!access.signedIn) {
    return (
      <Centered
        eyebrow="No session"
        title="You're not signed in"
        body="Sign in to open your desk."
        cta={{ href: "/login", label: "Go to login" }}
      />
    );
  }

  if (!access.profile) {
    return (
      <Centered
        eyebrow="Setting up"
        title="Preparing your desk"
        body="We couldn't load your profile just yet. Refresh in a moment — if it persists, sign out and back in."
      />
    );
  }

  const locked = access.tier !== "Full";

  // Build the spotlight server-side from real, timely content. Locked users get
  // a single upgrade-nudge slide instead of gated content.
  let slides: SpotlightSlide[];
  let brief: DashboardBrief | null = null;
  let news: NewsItem[] = [];
  if (locked) {
    slides = [
      {
        key: "upgrade",
        eyebrow: "Full access",
        title: "Unlock your full desk",
        body: "Analysis, signals, the indicator suite and the course all open when you fund your account.",
        cta: { label: "Restore full access", href: "/upgrade" },
        image: { src: "/dashboard/spotlight-course.jpg", alt: "" },
      },
    ];
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
        eyebrow: `Desk · XAU/USD · ${fmtDay(latest.published_on)}`,
        title: latest.title,
        body:
          latest.description ??
          "The read on gold, session by session — bias, levels and the thesis behind them.",
        cta: { label: "Watch the read", href: "/daily-analysis" },
        image: coverUrl
          ? { src: coverUrl, alt: latest.title, fit: "contain", dark: true }
          : { src: "/dashboard/spotlight-live.jpg", alt: latest.title },
      });
    }

    if (nextClass) {
      slides.push({
        key: "live",
        eyebrow: `Live · ${fmtDay(nextClass.starts_at)}`,
        title: nextClass.title,
        body: "Twice a week, live on the charts. Join the next session and trade it with us.",
        cta: { label: "Join the class", href: "/live-classes" },
        image: { src: "/dashboard/spotlight-course-alt.jpg", alt: "Live trading class" },
      });
    }

    // Evergreen variety — keep the rotation fresh beyond desk + education.
    slides.push(COURSE_SLIDE, FUNDAMENTAL_SLIDE, KNOWSTYLE_SLIDE);

    brief = {
      bias: latest?.bias ?? null,
      session: latest?.session_tag ?? null,
      latestDate: latest ? fmtDay(latest.published_on) : null,
      nextClassInDays: nextClass ? daysUntil(nextClass.starts_at) : null,
    };

    // Top gold/macro headlines for the dashboard teaser (cached fetch shared
    // with /news, so no extra quota burn).
    news = (await getNews()).slice(0, 6);
  }

  return (
    <DashboardClient
      email={access.profile.email}
      accountStatus={access.profile.account_status}
      daysLeft={access.daysLeft}
      tier={access.tier}
      slides={slides}
      brief={brief}
      news={news}
    />
  );
}
