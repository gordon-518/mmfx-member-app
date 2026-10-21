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
import { BiasPill, ConvictionBar, Panel, StateBadge } from "./parts";
import { LiveHero } from "./LiveHero";
import { SendCopyButton } from "./SendCopyButton";

// The full thesis for one instrument, rendered natively. Every field comes
// from the desk's output contract (desk BUILD.md §6) — nothing is inferred,
// and anything the desk left empty says so rather than being hidden.

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

export function Thesis({
  instrument,
  envelope,
}: {
  instrument: DeskInstrument;
  envelope: AnalysisEnvelope;
}) {
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
          ← The desk
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <StateBadge state={envelope.state} />
          <span className="text-[12px] text-faint">
            Written {formatUtc(a.generated_at)} · {formatAge(a.generated_at)}
          </span>
        </div>
      </div>

      <div className="rise mb-5">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
          Fundamental thesis · {instrument.nickname}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
          {instrument.display}
        </h1>
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
                Bias
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
            <span className="font-semibold text-ink">Dominant driver:</span> {driver}
          </p>
        </div>

        {/* The numbers behind the read */}
        <dl
          className="rise grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-soft lg:grid-cols-4"
          style={{ animationDelay: "0.24s" }}
        >
          {[
            { label: "H4 · 50 EMA", value: formatLevel(a.price_context.h4_50_ema) },
            { label: "Trend filter", value: `${tf.timeframe} ${tf.period} ${tf.indicator}` },
            { label: "Max age", value: `${inv.max_age_hours}h` },
            { label: "Trigger", value: humanize(a.trigger) },
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

        <Panel title="Where price sits" meta="vs the trend" delay={0.28}>
          <p className="text-[13.5px] leading-relaxed text-ink">
            {humanize(a.price_context.position_vs_trend)}
          </p>
        </Panel>

        <Panel title="Regime" meta="macro baseline" delay={0.32}>
          <p className="text-[14px] leading-relaxed text-ink">{a.regime_summary}</p>
        </Panel>

        <Panel title="The thesis" meta={driver} delay={0.36}>
          <p className="text-[15px] leading-relaxed text-ink">{a.narrative_summary}</p>
        </Panel>

        <Panel title="Active catalysts" meta="pull vs effect" delay={0.4}>
          {a.active_catalysts.length === 0 ? (
            <p className="text-[13.5px] text-subtle">None flagged on this run.</p>
          ) : (
            <ul className="space-y-4">
              {a.active_catalysts.map((c) => (
                <li key={c.name} className="border-b border-line pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{c.name}</span>
                    <Chip
                      label="pull"
                      value={c.narrative_pull}
                      lit={c.narrative_pull !== "neutral"}
                    />
                    <Chip
                      label="effect"
                      value={c.actual_effect}
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
        <Panel title="Invalidation contract" meta="falsifiable" delay={0.44}>
          <div>
            <ContractRow label="Trend filter">
              {trendFilterSentence(a)} · {humanize(tf.confirmation)}
            </ContractRow>
            <ContractRow label="Invalidate above">
              {formatLevel(inv.hard_level_invalidate_above)}
            </ContractRow>
            <ContractRow label="Invalidate below">
              {formatLevel(inv.hard_level_invalidate_below)}
            </ContractRow>
            <ContractRow label="Watch zone">
              {inv.watch_zone
                ? `${formatLevel(inv.watch_zone[0])} — ${formatLevel(inv.watch_zone[1])}`
                : "—"}
            </ContractRow>
          </div>

          {inv.external_triggers.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {inv.external_triggers.map((t) => (
                <li
                  key={`${t.action}-${t.event}`}
                  className="rounded-xl border border-line bg-paper p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        t.action === "invalidate"
                          ? "bg-ink/5 text-ink"
                          : "bg-accent-soft text-accent-ink"
                      }`}
                    >
                      {t.action}
                    </span>
                    <span className="text-[13.5px] font-semibold text-ink">{t.event}</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-subtle">{t.rationale}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Why this conviction" delay={0.48}>
            <Bullets items={a.confidence_drivers} empty="Not stated on this run." />
          </Panel>
          <Panel title="Data gaps" meta="what was missing" delay={0.5}>
            <Bullets items={a.data_gaps} empty="Full data coverage on this run." />
          </Panel>
        </div>

        {envelope.reads.length > 0 && (
          <Panel title="Recommended reading" meta="what the desk read" delay={0.54}>
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
              Download PDF
            </a>
            <SendCopyButton instrument={instrument.id} />
          </div>
          <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-faint">
            State: {envelope.state} — {humanize(envelope.state_reason)} (checked{" "}
            {formatAge(envelope.state_updated_at)}).
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-faint">
            Fundamental analysis of {instrument.display} only — not a signal, target, or
            instruction to buy or sell. The contract above states precisely where this
            thesis is wrong.
          </p>
        </div>
      </div>
    </div>
  );
}
