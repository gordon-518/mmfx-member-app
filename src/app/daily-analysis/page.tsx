import Link from "next/link";
import { requireFull } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import {
  DailyAnalysisClient,
  type AnalysisEntry,
} from "./DailyAnalysisClient";

export default async function DailyAnalysisPage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  await requireFull();

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
    <main className="relative min-h-screen overflow-hidden bg-obsidian">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="session-grid absolute inset-0" />
        <div className="absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-orange/10 blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange/40 to-transparent" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-pearl/10 px-6 py-5 sm:px-10">
        <Link href="/dashboard" className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold tracking-tight text-pearl">
            MARKET MAKERS <span className="text-orange">FX</span>
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-muted sm:inline">
            Daily Analysis
          </span>
        </Link>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-orange"
        >
          ← Desk
        </Link>
      </header>

      {/* Header */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-10 sm:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
          Desk · XAU/USD
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-pearl sm:text-4xl">
          Daily Analysis
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          The read on Gold, session by session — bias, levels, and the thesis
          behind them.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-16 sm:px-10">
          <p className="rounded-lg border border-pearl/10 bg-graphite/40 px-5 py-8 text-center font-mono text-sm text-muted">
            No analysis posted yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="relative z-10">
          <DailyAnalysisClient entries={entries} />
        </div>
      )}
    </main>
  );
}
