import Link from "next/link";
import { ExternalIcon } from "@/components/icons";
import {
  formatAge,
  formatLevel,
  formatUtc,
  humanize,
  theLine,
  trendFilterSentence,
} from "@/lib/fa/format";
import type { AnalysisEnvelope, DeskInstrument } from "@/lib/fa/types";
import { INTL_LOCALE } from "@/i18n/config";
import { biasWord } from "@/i18n/bias";
import { fmt } from "@/i18n/format";
import type { Messages } from "@/i18n/messages/types";
import { getLocale, getT } from "@/i18n/server";
import { en } from "@/i18n/messages/en";
import { ComplianceText } from "@/components/ComplianceText";
import { BiasPill, ConvictionBar, Panel, StateBadge } from "./parts";
import { LiveHero } from "./LiveHero";
import { SendCopyButton } from "./SendCopyButton";

// The full thesis for one instrument, rendered natively. Every field comes
// from the desk's output contract (desk BUILD.md §6) — nothing is inferred,
// and anything the desk left empty says so rather than being hidden.
//
// The frame is in the reader's language; what the desk wrote (the regime,
// the thesis, catalysts, reasons) is its English, shown as written. The desk's
// one-word values (bullish, invalidate...) are translated where we know them.

/** A desk value that is a bias word, in the reader's language; anything else as written. */
function deskWord(t: Messages, value: string): string {
  return value === "bullish" || value === "bearish" || value === "neutral" ? biasWord(t, value) : value;
}

function Chip({ label, value, lit }: { label: string; value: string; lit: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        lit ? "bg-accent-soft text-accent-ink" : "border border-line bg-paper text-faint"
      }`}
    >
      {label} · {value}
    </span>
  );
}

function ContractRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-0 sm:flex-row sm:gap-4">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-faint sm:w-36 sm:pt-0.5">
        {label}
      </span>
      <span className="text-[13.5px] leading-relaxed text-ink">{children}</span>
    </div>
  );
}

function Bullets({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-[13.5px] leading-relaxed text-subtle">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink">
          <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-orange" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export async function Thesis({
  instrument,
  envelope,
}: {
  instrument: DeskInstrument;
  envelope: AnalysisEnvelope;
}) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const desk = t.fundamental;
  const w = desk.thesis;
  const age = (iso: string | null | undefined) => formatAge(iso, undefined, desk);
  const nickname = (desk.nicknames as Record<string, string | undefined>)[instrument.id] ?? instrument.nickname;
  const a = envelope.analysis;
  const inv = a.invalidation;
  const tf = inv.trend_filter;
  const line = theLine(inv);
  const driver = humanize(a.dominant_driver);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
      {/* Back + freshness */}
      <div className="rise mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/bots/fundamental"
          className="text-[13px] font-semibold text-orange transition-colors hover:text-accent-ink"
        >
          {w.back}
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <StateBadge state={envelope.state} />
          <span className="text-[12px] text-faint">
            {fmt(w.written, {
              when: formatUtc(a.generated_at, INTL_LOCALE[locale], desk.utcStamp),
              age: age(a.generated_at),
            })}
          </span>
        </div>
      </div>

      <div className="rise mb-5">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
          {fmt(w.eyebrow, { nickname })}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
          {instrument.display}
        </h1>
        {locale !== "en" && <p className="mt-1.5 text-[12.5px] text-faint">{desk.contentNote}</p>}
      </div>

      <div className="space-y-4">
        {/* Spot + THE LINE (live) */}
        <LiveHero
          instrument={instrument.id}
          display={instrument.display}
          thesisPrice={a.price_context.current}
          line={line}
          watchZone={inv.watch_zone}
        />

        {/* Bias + conviction */}
        <div
          className="rise rounded-2xl border border-line bg-card p-5 shadow-soft"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                {w.bias}
              </p>
              <div className="mt-1.5">
                <BiasPill bias={a.bias} size="lg" />
              </div>
            </div>
            <div className="w-full max-w-xs">
              <ConvictionBar confidence={a.confidence} />
            </div>
          </div>
          <p className="mt-4 border-t border-line pt-3 text-[13.5px] leading-relaxed text-subtle">
            <span className="font-semibold text-ink">{w.dominantDriver}</span> {driver}
          </p>
        </div>

        {/* The numbers behind the read */}
        <dl
          className="rise grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-soft lg:grid-cols-4"
          style={{ animationDelay: "0.24s" }}
        >
          {[
            { label: w.cellEma, value: formatLevel(a.price_context.h4_50_ema) },
            { label: w.cellTrendFilter, value: `${tf.timeframe} ${tf.period} ${tf.indicator}` },
            { label: w.cellMaxAge, value: fmt(w.maxAgeValue, { h: inv.max_age_hours }) },
            { label: w.cellTrigger, value: humanize(a.trigger) },
          ].map((cell) => (
            <div key={cell.label} className="bg-card p-4">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                {cell.label}
              </dt>
              <dd className="mt-1 text-[15px] font-bold tracking-tight text-ink tabular-nums">
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>

        <Panel title={w.wherePrice} meta={w.wherePriceMeta} delay={0.28}>
          <p className="text-[13.5px] leading-relaxed text-ink">
            {humanize(a.price_context.position_vs_trend)}
          </p>
        </Panel>

        <Panel title={w.regime} meta={w.regimeMeta} delay={0.32}>
          <p className="text-[14px] leading-relaxed text-ink">{a.regime_summary}</p>
        </Panel>

        <Panel title={w.thesis} meta={driver} delay={0.36}>
          <p className="text-[15px] leading-relaxed text-ink">{a.narrative_summary}</p>
        </Panel>

        <Panel title={w.catalysts} meta={w.catalystsMeta} delay={0.4}>
          {a.active_catalysts.length === 0 ? (
            <p className="text-[13.5px] text-subtle">{w.noCatalysts}</p>
          ) : (
            <ul className="space-y-4">
              {a.active_catalysts.map((c) => (
                <li key={c.name} className="border-b border-line pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{c.name}</span>
                    <Chip
                      label={w.pull}
                      value={deskWord(t, c.narrative_pull)}
                      lit={c.narrative_pull !== "neutral"}
                    />
                    <Chip
                      label={w.effect}
                      value={deskWord(t, c.actual_effect)}
                      lit={c.actual_effect === "bullish" || c.actual_effect === "bearish"}
                    />
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-subtle">
                    {c.explanation}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* The falsifiable half: what would make this read wrong. */}
        <Panel title={w.contract} meta={w.contractMeta} delay={0.44}>
          <div>
            <ContractRow label={w.rowTrendFilter}>
              {trendFilterSentence(a, w)} · {humanize(tf.confirmation)}
            </ContractRow>
            <ContractRow label={w.rowAbove}>
              {formatLevel(inv.hard_level_invalidate_above)}
            </ContractRow>
            <ContractRow label={w.rowBelow}>
              {formatLevel(inv.hard_level_invalidate_below)}
            </ContractRow>
            <ContractRow label={w.rowWatchZone}>
              {inv.watch_zone
                ? `${formatLevel(inv.watch_zone[0])} — ${formatLevel(inv.watch_zone[1])}`
                : "—"}
            </ContractRow>
          </div>

          {inv.external_triggers.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {inv.external_triggers.map((trigger) => (
                <li
                  key={`${trigger.action}-${trigger.event}`}
                  className="rounded-xl border border-line bg-paper p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        trigger.action === "invalidate"
                          ? "bg-ink/5 text-ink"
                          : "bg-accent-soft text-accent-ink"
                      }`}
                    >
                      {trigger.action === "invalidate"
                        ? w.actionInvalidate
                        : trigger.action === "watch"
                          ? w.actionWatch
                          : trigger.action}
                    </span>
                    <span className="text-[13.5px] font-semibold text-ink">{trigger.event}</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-subtle">{trigger.rationale}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title={w.whyConviction} delay={0.48}>
            <Bullets items={a.confidence_drivers} empty={w.notStated} />
          </Panel>
          <Panel title={w.dataGaps} meta={w.dataGapsMeta} delay={0.5}>
            <Bullets items={a.data_gaps} empty={w.fullCoverage} />
          </Panel>
        </div>

        {envelope.reads.length > 0 && (
          <Panel title={w.reading} meta={w.readingMeta} delay={0.54}>
            <ul className="space-y-2">
              {envelope.reads.map((r) => (
                <li key={r.url}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-xl border border-line bg-paper p-3 transition-colors hover:border-orange/40"
                  >
                    <span className="text-[13.5px] font-semibold text-ink group-hover:text-accent-ink">
                      {r.title}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                      {r.source}
                      {r.sentiment ? ` · ${r.sentiment}` : ""}
                    </span>
                    <ExternalIcon
                      width={13}
                      height={13}
                      className="ml-auto shrink-0 text-faint group-hover:text-orange"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {/* Take-aways + the desk's own disclaimer. */}
        <div
          className="rise rounded-2xl border border-line bg-card p-5 shadow-soft"
          style={{ animationDelay: "0.58s" }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`/api/fundamental/report?instrument=${instrument.id}`}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
            >
              {w.downloadPdf}
            </a>
            <SendCopyButton instrument={instrument.id} />
          </div>
          <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-faint">
            {fmt(w.stateLine, {
              state: desk.states[envelope.state].label,
              reason: humanize(envelope.state_reason),
              age: age(envelope.state_updated_at),
            })}
          </p>
          <div className="mt-2">
            <ComplianceText
              english={fmt(en.fundamental.thesis.disclaimer, { instrument: instrument.display })}
              translated={fmt(w.disclaimer, { instrument: instrument.display })}
              className="text-[12px] leading-relaxed text-faint"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
