import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeMetrics, type GrowthProfileRow, type GrowthMetrics } from "@/lib/growth/metrics";
import { buildNarrative, type PriorSnapshot } from "@/lib/growth/narrative";
import { sendTelegram, escapeHtml } from "@/lib/telegram";

// Daily growth-stats snapshot. Triggered at 09:00 SGT (01:00 UTC) by a
// Supabase pg_cron + pg_net job that POSTs here with the CRON_SECRET bearer.
// NOT registered in vercel.json, so it consumes no Hobby cron slot — yet runs
// in Node so it can call Anthropic (narrative) and Telegram (push).
//
// Reads profiles with the service role (server-only, never a browser), computes
// aggregate counts, upserts today's growth_daily row, generates a short AI
// narrative, and DMs the founder. Idempotent on the SGT date. Degrades
// gracefully: a failed narrative or push never fails the snapshot.

const PROFILE_COLUMNS =
  "signup_at, account_status, trial_ends_at, deposit_verified_at, downgraded_at, broker, tradingview_username";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** YYYY-MM-DD of `date` shifted by `deltaDays`. */
function shiftDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function fmtDelta(current: number, prior?: number | null): string {
  if (prior == null) return "";
  const diff = current - prior;
  if (diff === 0) return " (=)";
  return diff > 0 ? ` (▲${diff})` : ` (▼${Math.abs(diff)})`;
}

function buildTelegram(m: GrowthMetrics, narrative: string | null, yest?: PriorSnapshot | null): string {
  const b = m.broker_split;
  const lines = [
    `<b>📈 MMFX growth — ${m.date}</b>`,
    "",
    `<b>Signups:</b> ${m.signups_today} today${fmtDelta(m.signups_today, yest?.signups_today)} · ${m.signups_7d} 7d · ${m.signups_30d} 30d`,
    `<b>Active trials:</b> ${m.trials_active}${fmtDelta(m.trials_active, yest?.trials_active)}`,
    `<b>Expiring ≤48h:</b> ${m.trials_expiring_48h}`,
    `<b>Conversions:</b> ${m.conversions_today} today${fmtDelta(m.conversions_today, yest?.conversions_today)}`,
    `<b>Members:</b> ${m.members_active}${fmtDelta(m.members_active, yest?.members_active)}`,
    `<b>Churn:</b> ${m.churn_today} today`,
    `<b>TV engagement:</b> ${m.tv_engagement_pct}%`,
    `<b>Brokers:</b> Octa ${b.octa} · Dupoin ${b.dupoin} · Elev8 ${b.elev8}`,
  ];
  if (narrative) {
    lines.push("", `<i>${escapeHtml(narrative)}</i>`);
  }
  return lines.join("\n");
}

async function handle(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = admin();

  const { data: profiles, error } = await db.from("profiles").select(PROFILE_COLUMNS);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const metrics = computeMetrics((profiles ?? []) as GrowthProfileRow[]);

  // Pull yesterday + last-week snapshots for deltas / narrative context.
  const { data: priorRows } = await db
    .from("growth_daily")
    .select("date, signups_today, trials_active, conversions_today, members_active, churn_today")
    .in("date", [shiftDate(metrics.date, -1), shiftDate(metrics.date, -7)]);

  const byDate = new Map((priorRows ?? []).map((r) => [r.date as string, r as PriorSnapshot & { date: string }]));
  const yesterday = byDate.get(shiftDate(metrics.date, -1)) ?? null;
  const lastWeek = byDate.get(shiftDate(metrics.date, -7)) ?? null;

  const narrative = await buildNarrative({ today: metrics, yesterday, lastWeek });

  const { error: upsertError } = await db
    .from("growth_daily")
    .upsert({ ...metrics, narrative }, { onConflict: "date" });
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const tg = await sendTelegram(buildTelegram(metrics, narrative, yesterday));

  console.log(
    `[cron/daily-stats] ${metrics.date} — signups ${metrics.signups_today}, ` +
      `trials ${metrics.trials_active}, members ${metrics.members_active}, ` +
      `narrative ${narrative ? "ok" : "none"}, telegram ${tg.ok ? "ok" : "failed"}`
  );

  return NextResponse.json({ ok: true, date: metrics.date, metrics, telegram: tg.ok });
}

// Accept both: GET for manual test calls, POST for pg_net.
export const GET = handle;
export const POST = handle;
