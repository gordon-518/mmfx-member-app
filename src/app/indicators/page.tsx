import Image from "next/image";
import { requireFeature } from "@/lib/access";
import { LockedFeature } from "@/components/LockedFeature";
import { AppShell } from "@/components/AppShell";
import { ExternalIcon } from "@/components/icons";
import { ComplianceText } from "@/components/ComplianceText";
import { TvAccessBlock } from "@/components/TvAccessBlock";
import { INDICATORS } from "./data";
import { setTradingViewUsername } from "./actions";
import { getT } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { MM_INDICATORS_DISCLAIMER } from "@/lib/content/disclaimer";

/** "ML Classifier" -> "MLClassifier", the key the dictionary uses. */
const typeKey = (type: string) => type.replace(/[^A-Za-z]/g, "");

export default async function IndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Gate (conversion-fix 2.2): signed-out -> /login; locked -> preview.
  const gate = await requireFeature("indicators");
  if (gate.locked) return <LockedFeature feature="indicators" gate={gate} />;
  const profile = gate.profile;

  const { tv_error } = await searchParams;
  const tvError = typeof tv_error === "string" ? tv_error : null;
  const t = await getT();
  const ind = t.indicators;
  const types = ind.types as Record<string, string | undefined>;
  const signals = ind.signals as Record<string, string | undefined>;

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} memberTier={gate.viewer.tier} isAdmin={profile.is_admin}>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{ind.eyebrow}</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">{ind.title}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            {fmt(ind.subtitle, { n: INDICATORS.length })}
          </p>
        </div>

        <TvAccessBlock
          action={setTradingViewUsername}
          username={profile.tradingview_username}
          grantedWhat={fmt(ind.grantedWhat, { n: INDICATORS.length })}
          requestBody={fmt(ind.requestBody, { n: INDICATORS.length })}
          errorCode={tvError}
        />

        {/* Indicator grid */}
        <p className="mb-4 mt-11 text-[12px] font-semibold uppercase tracking-wider text-faint">
          {fmt(ind.suite, { n: INDICATORS.length })}
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INDICATORS.map((item) => {
            const type = types[typeKey(item.type)] ?? item.type;
            const signal = signals[item.slug] ?? item.signal;
            const inner = (
              <>
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-accent-soft">
                  {item.noCover ? (
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <span className="font-display text-lg font-bold tracking-tight text-ink">
                        MM <span className="text-orange">FX</span>
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                        {type}
                      </span>
                    </div>
                  ) : (
                    <Image
                      src={`/indicators/${item.slug}-cover.png`}
                      alt={fmt(ind.imageAlt, { name: item.name })}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-[16px] font-bold tracking-tight text-ink">
                      {item.name}
                    </h3>
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                      {type}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-subtle">
                    {signal}
                  </p>
                  <p className="mt-3.5 text-[12px] font-semibold uppercase tracking-wide">
                    {item.tvUrl ? (
                      <span className="inline-flex items-center gap-1.5 text-orange transition-colors group-hover:text-accent-ink">
                        {ind.view} <ExternalIcon width={13} height={13} />
                      </span>
                    ) : (
                      <span className="text-faint">{ind.soon}</span>
                    )}
                  </p>
                </div>
              </>
            );

            const cardClass =
              "block overflow-hidden rounded-2xl border border-line bg-card shadow-soft";

            return item.tvUrl ? (
              <a
                key={item.slug}
                href={item.tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`group ${cardClass} cursor-pointer transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:shadow-soft-lg`}
              >
                {inner}
              </a>
            ) : (
              <article key={item.slug} className={cardClass}>
                {inner}
              </article>
            );
          })}
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
