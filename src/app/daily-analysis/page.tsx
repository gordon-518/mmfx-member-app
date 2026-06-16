import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import {
  DailyAnalysisClient,
  type AnalysisEntry,
} from "./DailyAnalysisClient";

export default async function DailyAnalysisPage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();

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
    session_tag: r.session_tag,
    cover_url: r.cover_path
      ? supabase.storage.from("analysis-covers").getPublicUrl(r.cover_path)
          .data.publicUrl
      : null,
    has_report: Boolean(r.report_path),
  }));

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full">
      {/* Header */}
      <div className="mx-auto max-w-5xl px-5 pt-8 sm:px-8 lg:pt-10">
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            Desk · XAU/USD
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
            Daily Analysis
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            The read on Gold, session by session — bias, levels, and the thesis
            behind them.
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
          <p className="rounded-2xl border border-line bg-card px-5 py-10 text-center text-[14px] text-subtle shadow-soft">
            No analysis posted yet. Check back soon.
          </p>
        </div>
      ) : (
        <DailyAnalysisClient entries={entries} />
      )}
    </AppShell>
  );
}
