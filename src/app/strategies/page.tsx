import { STRATEGIES } from "./data";
import Image from "next/image";
import { requireFeature } from "@/lib/access";
import { LockedFeature } from "@/components/LockedFeature";
import { AppShell } from "@/components/AppShell";
import { ExternalIcon } from "@/components/icons";
import { ComplianceText } from "@/components/ComplianceText";
import { TvAccessBlock } from "@/components/TvAccessBlock";
import { setTradingViewUsernameFromStrategies } from "./actions";
import { getT } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { MM_INDICATORS_DISCLAIMER } from "@/lib/content/disclaimer";

// Published MM TradingView strategy scripts. The .pine source is NEVER served
// here — these are just links to the public TradingView publications + a chart
// screenshot cover. Three slots are still in build.


const COMING_SOON = 3;

export default async function StrategiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const gate = await requireFeature("strategies");
  if (gate.locked) return <LockedFeature feature="strategies" gate={gate} />;
  const profile = gate.profile;

  const { tv_error } = await searchParams;
  const tvError = typeof tv_error === "string" ? tv_error : null;
  const t = await getT();
  const st = t.strategies;
  const types = st.types as Record<string, string | undefined>;
  const signals = st.signals as Record<string, string | undefined>;

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} memberTier={gate.viewer.tier} isAdmin={profile.is_admin}>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{st.eyebrow}</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">{st.title}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">{st.subtitle}</p>
        </div>

        <TvAccessBlock
          action={setTradingViewUsernameFromStrategies}
          username={profile.tradingview_username}
          grantedWhat={st.grantedWhat}
          requestBody={st.requestBody}
          errorCode={tvError}
        />

        {/* Grid: live strategies + coming-soon slots */}
        <div className="rise mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STRATEGIES.map((s) => (
            <a
              key={s.slug}
              href={s.tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block cursor-pointer overflow-hidden rounded-2xl border border-line bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:shadow-soft-lg"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-ink">
                <Image
                  src={s.cover}
                  alt={fmt(st.imageAlt, { name: s.name })}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-[16px] font-bold tracking-tight text-ink">{s.name}</h3>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                    {types[s.type] ?? s.type}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-subtle">{signals[s.slug] ?? s.signal}</p>
                <p className="mt-3.5 text-[12px] font-semibold uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1.5 text-orange transition-colors group-hover:text-accent-ink">
                    {st.view} <ExternalIcon width={13} height={13} />
                  </span>
                </p>
              </div>
            </a>
          ))}

          {Array.from({ length: COMING_SOON }, (_, i) => (
            <article
              key={`soon-${i}`}
              className="rounded-2xl border border-dashed border-line-strong bg-card/50 p-5"
            >
              <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-accent-soft/50">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{st.comingSoon}</span>
              </div>
              <h3 className="mt-4 font-display text-[16px] font-bold tracking-tight text-subtle">{st.inBuild}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-faint">{st.inBuildBody}</p>
            </article>
          ))}
        </div>

        {/* Disclaimer */}
        <footer className="mt-14 border-t border-line pt-6">
          <ComplianceText
            english={MM_INDICATORS_DISCLAIMER}
            translated={t.common.toolsDisclaimer}
            className="text-[12px] leading-relaxed text-faint"
          />
        </footer>
      </div>
    </AppShell>
  );
}
