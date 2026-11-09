import Link from "next/link";
import { requireFeature } from "@/lib/access";
import { LockedFeature } from "@/components/LockedFeature";
import { AppShell } from "@/components/AppShell";
import { getNews, NEWS_PAIRS, type NewsCard } from "@/lib/forexNews";
import { NewsFeed } from "./NewsFeed";
import { shortDateLabel } from "@/i18n/dates";
import { INTL_LOCALE } from "@/i18n/config";
import { getLocale, getT } from "@/i18n/server";
import { VslTour } from "@/components/VslPlayer";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ pair?: string }>;
}) {
  // Gate (conversion-fix 2.2): signed-out -> /login; locked -> preview.
  const gate = await requireFeature("news");
  if (gate.locked) return <LockedFeature feature="news" gate={gate} />;
  const profile = gate.profile;

  const { pair: rawPair } = await searchParams;
  // Only honour an allowlisted pair (getNews validates again before the fetch).
  const pair = NEWS_PAIRS.some((p) => p.value && p.value === rawPair) ? rawPair : "";
  const items = await getNews(pair);
  const t = await getT();
  const locale = await getLocale();
  const cards: NewsCard[] = items.map((n) => ({ ...n, dateLabel: shortDateLabel(n.date, INTL_LOCALE[locale]) }));
  // The pair codes read the same in every language; only these three are words.
  const pairLabel = (label: string) =>
    label === "All" ? t.news.all : label === "Gold" ? t.news.gold : label === "Silver" ? t.news.silver : label;

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} memberTier={gate.viewer.tier} isAdmin={profile.is_admin}>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            {t.news.eyebrow}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
            {t.news.title}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            {t.news.intro}
          </p>
          {locale !== "en" && <p className="mt-1.5 text-[12.5px] text-faint">{t.news.sourceNote}</p>}
          <VslTour videos={[{ video: "news" }]} />
        </div>

        {/* Pair filter (server-driven — accurate per-pair coverage) */}
        <div className="rise mt-6 flex flex-wrap gap-1.5">
          {NEWS_PAIRS.map((p) => {
            const active = (p.value || "") === (pair || "");
            return (
              <Link
                key={p.label}
                href={p.value ? `/news?pair=${p.value}` : "/news"}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  active ? "bg-orange text-white" : "bg-card text-subtle hover:text-ink border border-line"
                }`}
              >
                {pairLabel(p.label)}
              </Link>
            );
          })}
        </div>

        {items.length === 0 ? (
          <p className="rise mt-6 rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            {t.news.emptyPair}
          </p>
        ) : (
          <NewsFeed items={cards} />
        )}
      </div>
    </AppShell>
  );
}
