import { NextResponse } from "next/server";
import { requireMemberApi, serviceClient } from "@/lib/journal/api";
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
  const guard = await requireMemberApi();
  if ("response" in guard) return guard.response;
  const { profile } = guard;

  const db = serviceClient();
  const date = today();

  // Atomically RESERVE a slot before the (paid) model call. The old cap was a
  // non-atomic read-then-write, so N parallel POSTs each passed the check and
  // each burned an Anthropic call. fn_reserve_journal_report increments under a
  // single statement and returns NULL when the daily cap is already reached.
  const { data: reserved, error: reserveErr } = await db.rpc(
    "fn_reserve_journal_report",
    { p_user: profile.id, p_cap: DAILY_REPORT_CAP }
  );
  if (reserveErr) {
    return NextResponse.json({ error: reserveErr.message }, { status: 500 });
  }
  if (reserved == null) {
    return NextResponse.json(
      {
        error: `Daily limit reached — you can generate up to ${DAILY_REPORT_CAP} reports per day. Try again tomorrow.`,
        remaining: 0,
      },
      { status: 429 }
    );
  }
  const genCount = reserved as number;
  const refund = () => db.rpc("fn_refund_journal_report", { p_user: profile.id });

  const ctx = await loadReportContext(db, profile.id);
  if (!ctx) {
    await refund();
    return NextResponse.json(
      { error: "You need some closed trades before the coach can review them." },
      { status: 400 }
    );
  }

  const result = await generateReport(ctx);
  if (!result) {
    await refund();
    return NextResponse.json(
      { error: "The AI coach is temporarily unavailable — please try again." },
      { status: 502 }
    );
  }

  // Fill in the reserved row's content (gen_count was already set by the reserve).
  const { error } = await db
    .from("journal_reports")
    .update({
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
    })
    .eq("user_id", profile.id)
    .eq("report_date", date);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    report: result.report,
    remaining: DAILY_REPORT_CAP - genCount,
  });
}
