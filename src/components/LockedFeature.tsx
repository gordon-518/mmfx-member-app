import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { LockedOverlay } from "@/lib/access/LockedOverlay";
import { FEATURE_HREF, FEATURE_MIN_TIER } from "@/lib/access/features";
import { FEATURE_VSL } from "@/lib/vsl";
import { VslPlayer } from "@/components/VslPlayer";
import { getT } from "@/i18n/server";
import { unlocksAt } from "@/i18n/tierName";
import type { Messages } from "@/i18n/messages/types";
import type { FeatureKey } from "@/lib/access/featureKeys";
import type { FeatureGate } from "@/lib/access/requireFeature";

// The locked state of a feature page (conversion-fix 2.4). A Free user who
// opens a locked route sees what it is, a preview under the lock veil and the
// way to unlock it, instead of being bounced to /upgrade. Nothing gated is
// fetched to render it: the preview is static art and copy.
//
// Copy stays compliance-safe: it says what the tool is, never what it earns.

// Words: messages/<locale>/locked.ts. Here: which features have a preview,
// and its artwork.
type LockedKey = keyof Messages["locked"]["features"];

const IMAGE: Partial<Record<LockedKey, { src: string; width: number; height: number }>> = {
  indicators: { src: "/indicators/auto-trendlines-cover.png", width: 1200, height: 675 },
  strategies: { src: "/strategies/mm-system-5m-entry.jpg", width: 1200, height: 675 },
  library: { src: "/dashboard/spotlight-course.jpg", width: 1200, height: 675 },
  "live-classes": { src: "/dashboard/spotlight-live.jpg", width: 1200, height: 675 },
  "fundamental-desk": { src: "/dashboard/spotlight-fundamental.jpg", width: 1200, height: 675 },
};

function isLockedKey(feature: FeatureKey, t: Messages): feature is LockedKey {
  return feature in t.locked.features;
}

/** The free features, linked from every locked page. */
function freeLinks(t: Messages): { label: string; feature: FeatureKey }[] {
  return [
    { label: t.nav.dailyAnalysis, feature: "daily-analysis" },
    { label: t.locked.freeSignals, feature: "signals" },
    { label: t.nav.calendar, feature: "calendar" },
    { label: t.locked.freeNews, feature: "news" },
    { label: t.nav.knowYourStyle, feature: "know-your-style" },
    { label: t.locked.freeCourse, feature: "course" },
  ];
}

export async function LockedFeature({
  feature,
  gate,
  notice,
}: {
  feature: FeatureKey;
  gate: FeatureGate;
  /** Something the page needs this member to know first (e.g. a connection that stopped syncing). */
  notice?: React.ReactNode;
}) {
  const t = await getT();
  const l = t.locked;
  const known = isLockedKey(feature, t) ? l.features[feature] : null;
  const copy = known
    ? { ...known, points: Object.values(known.points), image: IMAGE[feature as LockedKey] }
    : { eyebrow: t.common.locked, title: l.fallbackTitle, pitch: l.fallbackPitch, points: [] as string[], image: undefined };
  // Tier-specific CTA (conversion-fix 2.4 / 3.3): say which tier opens it.
  const min = FEATURE_MIN_TIER[feature];
  const video = FEATURE_VSL[feature];
  const { profile, viewer } = gate;

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} memberTier={viewer.tier} isAdmin={profile.is_admin}>
      {/* data-gate: a language-independent marker for the tier-matrix checks. */}
      <div data-gate="locked" className="mx-auto max-w-5xl px-5 pb-12 pt-8 sm:px-8 lg:pt-10">
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{copy.eyebrow}</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">{copy.title}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">{copy.pitch}</p>
        </div>

        {notice && (
          <div className="rise mt-6" style={{ animationDelay: "40ms" }}>
            {notice}
          </div>
        )}

        {/* The feature's own video: what it does, before what it costs. */}
        {video && (
          <div className="rise mt-7 max-w-3xl" style={{ animationDelay: "60ms" }}>
            <VslPlayer video={video} />
          </div>
        )}

        <div className="rise mt-7" style={{ animationDelay: "80ms" }}>
          <LockedOverlay
            ctaHref="/upgrade"
            lockedLabel={t.common.locked}
            ctaLabel={
              min === "free"
                ? l.openOnEvery
                : unlocksAt(t, min)
            }
          >
            <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
              {copy.image && (
                <Image
                  src={copy.image.src}
                  alt=""
                  width={copy.image.width}
                  height={copy.image.height}
                  className="h-auto w-full rounded-xl"
                />
              )}
              {copy.points.length > 0 && (
                <ul className={`grid grid-cols-1 gap-2.5 sm:grid-cols-3 ${copy.image ? "mt-4" : ""}`}>
                  {copy.points.map((p) => (
                    <li key={p} className="rounded-xl border border-line bg-paper/60 px-4 py-3 text-[13.5px] font-medium text-ink">
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </LockedOverlay>
        </div>

        <div className="rise mt-6 rounded-2xl border border-line bg-card p-5 shadow-soft" style={{ animationDelay: "140ms" }}>
          <p className="text-[13.5px] font-semibold text-ink">{l.openNow}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {freeLinks(t).map((link) => (
              <Link
                key={link.feature}
                href={FEATURE_HREF[link.feature]}
                className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-orange/40 hover:text-accent-ink"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
