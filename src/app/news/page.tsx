import Link from "next/link";
import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { getNews, NEWS_PAIRS } from "@/lib/forexNews";
import { NewsFeed } from "./NewsFeed";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ pair?: string }>;
}) {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();

  const { pair: rawPair } = await searchParams;
  // Only honour an allowlisted pair (getNews validates again before the fetch).
  const pair = NEWS_PAIRS.some((p) => p.value && p.value === rawPair) ? rawPair : "";
  const items = await getNews(pair);

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            Markets · Forex &amp; commodities
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
            News &amp; Articles
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            The headlines moving the markets — the pairs you trade, gold and commodities, the dollar,
            the Fed and rates — each tagged with sentiment. Filter to what you trade.
          </p>
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
                {p.label}
              </Link>
            );
          })}
        </div>

        {items.length === 0 ? (
          <p className="rise mt-6 rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            No articles available right now. Try another pair, or check back shortly.
          </p>
        ) : (
          <NewsFeed items={items} />
        )}
      </div>
    </AppShell>
  );
}
