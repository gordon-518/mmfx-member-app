import { requireFeature } from "@/lib/access";
import { LockedFeature } from "@/components/LockedFeature";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import {
  DailyAnalysisClient,
  type AnalysisEntry,
} from "./DailyAnalysisClient";
import { getLocale, getT } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import { monthLabel, weekdayLabel } from "@/i18n/dates";
import { sessionKey, sessionLabel } from "@/lib/sessions";

// Dates and session names are formatted here, on the server, in the reader's
// language (formatting them in the browser too can break hydration). The
// analyses themselves are the desk's English.

export default async function DailyAnalysisPage() {
  // Gate (conversion-fix 2.2): signed-out -> /login; locked -> preview.
  const gate = await requireFeature("daily-analysis");
  if (gate.locked) return <LockedFeature feature="daily-analysis" gate={gate} />;
  const profile = gate.profile;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const d = t.dailyAnalysis;
  const intl = INTL_LOCALE[locale];

  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_analysis")
    .select(
      "id, published_on, title, gumlet_id, description, bias, session_tag, cover_path, report_path"
    )
    .eq("is_published", true)
    .order("published_on", { ascending: false })
    .order("created_at", { ascending: false });

  const entries: AnalysisEntry[] = (data ?? []).map((r) => ({
    id: r.id,
    published_on: r.published_on,
    title: r.title,
    gumlet_id: r.gumlet_id,
    description: r.description,
    bias: r.bias,
    date_label: [weekdayLabel(r.published_on, intl), r.published_on].filter(Boolean).join(" · "),
    month_label: monthLabel(r.published_on, intl) ?? d.undated,
    session: r.session_tag
      ? { key: sessionKey(r.session_tag) ?? r.session_tag.trim(), label: sessionLabel(r.session_tag, d.sessions)! }
      : null,
    cover_url: r.cover_path
      ? supabase.storage.from("analysis-covers").getPublicUrl(r.cover_path)
          .data.publicUrl
      : null,
    has_report: Boolean(r.report_path),
  }));

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} memberTier={gate.viewer.tier} isAdmin={profile.is_admin}>
      {/* Header */}
      <div className="mx-auto max-w-5xl px-5 pt-8 sm:px-8 lg:pt-10">
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{d.eyebrow}</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">{t.nav.dailyAnalysis}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">{d.subtitle}</p>
          {locale !== "en" && <p className="mt-1.5 text-[12.5px] text-faint">{d.contentNote}</p>}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
          <p className="rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            {d.empty}
          </p>
        </div>
      ) : (
        // Keyed by language: the open groups are keyed by their (translated) labels.
        <DailyAnalysisClient key={locale} entries={entries} />
      )}
    </AppShell>
  );
}
