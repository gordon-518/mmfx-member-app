import { NextResponse } from "next/server";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";
import {
  DAILY_REPORT_CAP,
  generateReport,
  loadReportContext,
} from "@/lib/journal/coach";

// POST /api/journal/report/generate — generate today's AI coaching report for
// the caller, on demand. Reports are on-demand only (no automatic cron) and
// capped at DAILY_REPORT_CAP generations per user per day. Admin-gated during
// staged rollout; persists with the service role.

export const maxDuration = 60;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST() {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const { profile } = guard;

  const db = serviceClient();
  const date = today();

  // Enforce the per-user daily cap. gen_count only ever increments on a
  // SUCCESSFUL generation below, so a failed model call never burns the quota.
  const { data: existing } = await db
    .from("journal_reports")
    .select("gen_count")
    .eq("user_id", profile.id)
    .eq("report_date", date)
    .maybeSingle();
  const used = existing?.gen_count ?? 0;

  if (used >= DAILY_REPORT_CAP) {
    return NextResponse.json(
      {
        error: `Daily limit reached — you can generate up to ${DAILY_REPORT_CAP} reports per day. Try again tomorrow.`,
        remaining: 0,
      },
      { status: 429 }
    );
  }

  const ctx = await loadReportContext(db, profile.id);
  if (!ctx) {
    return NextResponse.json(
      { error: "You need some closed trades before the coach can review them." },
      { status: 400 }
    );
  }

  const result = await generateReport(ctx);
  if (!result) {
    return NextResponse.json(
      { error: "The AI coach is temporarily unavailable — please try again." },
      { status: 502 }
    );
  }

  const genCount = used + 1;
  const { error } = await db.from("journal_reports").upsert(
    {
      user_id: profile.id,
      report_date: date,
      status: result.report.status,
      summary: result.report.summary,
      habits: result.report.habits,
      tips: result.report.tips,
      stats: {
        netProfit: ctx.analytics.netProfit,
        winRate: ctx.analytics.winRate,
        profitFactor: ctx.analytics.profitFactor,
        closedCount: ctx.analytics.closedCount,
        maxDrawdown: ctx.analytics.maxDrawdown,
      },
      model: result.model,
      gen_count: genCount,
    },
    { onConflict: "user_id,report_date" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    report: result.report,
    remaining: DAILY_REPORT_CAP - genCount,
  });
}
