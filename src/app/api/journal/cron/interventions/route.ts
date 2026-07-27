import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { loadReportContext } from "@/lib/journal/coach";
import {
  decideInterventions,
  filterUnsent,
  type InterventionSignals,
  type SentRecord,
} from "@/lib/journal/interventions";
import { interventionEmailHtml } from "@/lib/journal/interventionEmail";
import { sendEmail } from "@/lib/sendpulse";

// Daily proactive-intervention worker. Scheduled by Supabase pg_cron + pg_net
// (same convention/secret as journal-sync). Per connected user: reuse the coach
// loaders to build signals, dedup against journal_interventions, and email each
// new intervention — ADMIN-ONLY during rollout, skipping opt-outs.

export const maxDuration = 300;

const FROM = { name: "Market Makers FX", email: "hello@marketmakersfx.net" };
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.marketmakersfx.net";

function authorized(req: NextRequest): boolean {
  const secret = process.env.JOURNAL_CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date().toISOString();
  const db = serviceClient();

  // Distinct users with a connected journal account.
  const { data: accts } = await db
    .from("journal_accounts")
    .select("user_id")
    .neq("state", "disconnected");
  const userIds = [...new Set((accts ?? []).map((a) => a.user_id as string))];

  let evaluated = 0;
  let sent = 0;

  for (const userId of userIds) {
    try {
      const ctx = await loadReportContext(db, userId);
      if (!ctx || !ctx.health || !ctx.leaks || !ctx.rules) continue;
      evaluated += 1;

      const closed = ctx.sampleTrades.filter((t) => t.status === "closed" && t.close_time);
      const lastTradeAt = closed.reduce<string | null>(
        (max, t) =>
          max == null || (t.close_time as string) > max ? (t.close_time as string) : max,
        null
      );
      const signals: InterventionSignals = {
        health: ctx.health,
        leaks: ctx.leaks,
        rules: ctx.rules,
        lastTradeAt,
        hasClosedTrades: closed.length > 0,
      };

      const { data: logRows } = await db
        .from("journal_interventions")
        .select("kind, episode_key, sent_at")
        .eq("user_id", userId);
      const toSend = filterUnsent(
        decideInterventions(signals, now),
        (logRows ?? []) as SentRecord[],
        now
      );
      if (!toSend.length) continue;

      // Rollout gate: admins only, and skip opt-outs.
      const { data: profile } = await db
        .from("profiles")
        .select("email, full_name, is_admin")
        .eq("id", userId)
        .maybeSingle();
      if (!profile?.is_admin || !profile.email) continue;

      const { data: prefs } = await db
        .from("journal_email_prefs")
        .upsert({ user_id: userId, updated_at: now }, { onConflict: "user_id" })
        .select("opted_out, unsub_token")
        .single();
      if (!prefs || prefs.opted_out) continue;

      const unsubUrl = `${APP_URL}/api/journal/email/unsubscribe?token=${prefs.unsub_token}`;
      const ctaUrl = `${APP_URL}/journal`;

      for (const iv of toSend) {
        const html = interventionEmailHtml({
          headline: iv.headline,
          body: iv.body,
          action: iv.action,
          ctaUrl,
          unsubUrl,
        });
        const res = await sendEmail({
          to: { name: profile.full_name || profile.email, email: profile.email },
          from: FROM,
          subject: iv.headline,
          html,
        });
        if (res.ok) {
          await db.from("journal_interventions").insert({
            user_id: userId,
            kind: iv.kind,
            episode_key: iv.episodeKey,
            channel: "email",
            sent_at: new Date().toISOString(),
          });
          sent += 1;
        }
      }
    } catch {
      // best-effort: one user's failure never blocks the rest
    }
  }

  return NextResponse.json({ ok: true, evaluated, sent, users: userIds.length });
}
