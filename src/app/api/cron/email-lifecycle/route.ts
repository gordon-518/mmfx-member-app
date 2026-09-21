import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { sendEmail, type EmailAddress } from "@/lib/sendpulse";
import { renderLifecycle, templateFor } from "@/lib/email/lifecycle";
import type { LifecycleCtx, LifecycleEmail } from "@/lib/email/lifecycle/types";
import { tierFor } from "@/lib/tiers";
import type { AccountStatus } from "@/lib/trial/status";

// The lifecycle rail's worker (design doc 2026-09-21 §4). Hourly, via Supabase
// pg_cron + pg_net (job 'email-lifecycle', snippet in the migration) — the
// Vercel plan's two cron slots are taken.
//
// Same shape as deposit-dm-reminder: fn_claim_email_sends decides what is due
// and STAMPS the rows before we render, so overlapping runs can't double-send,
// and a failed send is logged against its row (ok = false) rather than
// retried. Retrying a marketing email is worse than dropping it.
//
// Nothing leaves the building until EMAIL_LIFECYCLE_ENABLED=true: without it
// the route claims nothing and answers { disabled: true }, so the pg_cron job
// can be scheduled safely well before go-live.

export const maxDuration = 300;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.marketmakersfx.net";
const DEFAULT_FROM = "Market Makers FX <hello@marketmakersfx.net>";

/** A claimed row: one due email, with everything its template needs. */
interface ClaimedSend {
  send_id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  flow: string;
  step: string;
  dedupe_key: string;
  audience: string;
  account_status: string;
  trial_ends_at: string | null;
  deposit_amount: number | string | null;
  grandfathered: boolean | null;
  lifetime_plan: string | null;
  days_since_signup: number;
  onb_tv: boolean;
  onb_analysis: boolean;
  onb_kys: boolean;
  onb_lesson1: boolean;
  onb_desk: boolean;
  analysis_title: string | null;
  analysis_bias: string | null;
  analysis_description: string | null;
  unsub_token: string;
  upgrade_viewed_at: string | null;
  upgrade_broker_clicked_at: string | null;
  spotlight_id: string | null;
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

/** `EMAIL_FROM_MARKETING`, as either "Name <a@b>" or a bare address. */
export function parseSender(raw: string | undefined): EmailAddress {
  const value = (raw ?? "").trim() || DEFAULT_FROM;
  const m = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m && m[2].includes("@")) {
    return { name: m[1].replace(/^"|"$/g, "").trim() || "Market Makers FX", email: m[2].trim() };
  }
  if (value.includes("@")) return { name: "Market Makers FX", email: value };
  return { name: "Market Makers FX", email: "hello@marketmakersfx.net" };
}

/** `SPOTLIGHT_DAY` as an ISO day-of-week number. Default Thursday. */
export function parseSpotlightDay(raw: string | undefined): number {
  const d = Number((raw ?? "").trim());
  return Number.isInteger(d) && d >= 1 && d <= 7 ? d : 4;
}

/** `DIGEST_DAYS` as ISO day-of-week numbers (Mon = 1). Default Mon/Wed/Fri. */
export function parseDigestDays(raw: string | undefined): number[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  return parsed.length ? [...new Set(parsed)] : [1, 3, 5];
}

const AUDIENCES = new Set(["trial", "expired", "member"]);
const BIASES = new Set(["bullish", "bearish", "neutral"]);

/** Turn a claimed row into the ctx a template is a pure function of. */
export function contextFor(row: ClaimedSend, appUrl = APP_URL): LifecycleCtx | null {
  if (!AUDIENCES.has(row.audience)) return null;
  return {
    firstName: row.first_name,
    audience: row.audience as LifecycleCtx["audience"],
    // The SQL returns the raw inputs; tierFor() stays the one ladder.
    tier: tierFor({
      account_status: row.account_status as AccountStatus,
      trial_ends_at: row.trial_ends_at,
      deposit_amount: row.deposit_amount,
      grandfathered: row.grandfathered,
      lifetime_plan: row.lifetime_plan,
    }),
    trialEndsAt: row.trial_ends_at,
    daysSinceSignup: row.days_since_signup,
    onboarding: {
      tv: row.onb_tv,
      analysis: row.onb_analysis,
      kys: row.onb_kys,
      lesson1: row.onb_lesson1,
      desk: row.onb_desk,
    },
    // daily_analysis.bias is NULLABLE, and most rows carry one but not all.
    // Dropping the whole analysis over a missing bias would have sent an empty
    // digest to the entire Free tier, so only the bias itself is dropped.
    // types.ts is the design doc's block verbatim and types bias as non-null;
    // every template already handles its absence, hence the narrow cast.
    todayAnalysis: row.analysis_title
      ? {
          title: row.analysis_title,
          bias: (row.analysis_bias && BIASES.has(row.analysis_bias)
            ? row.analysis_bias
            : null) as NonNullable<LifecycleCtx["todayAnalysis"]>["bias"],
          description: row.analysis_description,
        }
      : null,
    appUrl,
    unsubUrl: `${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(row.unsub_token)}`,
  };
}

interface Spotlight {
  subject: string;
  html: string;
  text: string;
  guide_url: string | null;
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The kill switch. Off by default, everywhere, until Gordon flips it.
  if (process.env.EMAIL_LIFECYCLE_ENABLED !== "true") {
    return NextResponse.json({ disabled: true });
  }

  const db = serviceClient();
  const { data, error } = await db.rpc("fn_claim_email_sends", {
    // Small on purpose: every row in a batch is claimed up front, so a batch
    // killed mid-flight is a batch of rows the reaper has to unwind. 60 sends
    // an hour is 1,440 a day, well past what 4,112 profiles can absorb under
    // the one-per-user-per-day cap.
    p_limit: Number(process.env.EMAIL_LIFECYCLE_BATCH ?? 60),
    p_digest_days: parseDigestDays(process.env.DIGEST_DAYS),
    p_spotlight_day: parseSpotlightDay(process.env.SPOTLIGHT_DAY),
  });
  if (error) {
    console.error("[cron/email-lifecycle] claim failed:", error.message);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }

  const claimed = (data ?? []) as ClaimedSend[];
  const from = parseSender(process.env.EMAIL_FROM_MARKETING);

  // The spotlight's copy comes from the brain, not from a template: one read
  // covers every recipient in this batch, since the claim pins one row's id.
  const spotlights = new Map<string, Spotlight>();
  const spotlightIds = [...new Set(claimed.map((r) => r.spotlight_id).filter((id): id is string => !!id))];
  if (spotlightIds.length) {
    const { data: rows } = await db
      .from("email_spotlights")
      .select("id, subject, html, text, guide_url")
      .in("id", spotlightIds);
    for (const r of (rows ?? []) as (Spotlight & { id: string })[]) {
      spotlights.set(r.id, {
        subject: r.subject,
        html: r.html,
        text: r.text,
        guide_url: r.guide_url,
      });
    }
  }

  let sent = 0;
  let failed = 0;
  let released = 0;

  for (const row of claimed) {
    let mail: LifecycleEmail | null = null;
    let why: string | null = null;

    try {
      const ctx = contextFor(row);
      if (!ctx) {
        why = `no context for audience "${row.audience}"`;
      } else if (row.step === "spotlight") {
        // The brain composes the spotlight's BODY (design doc §5); the
        // spotlight template supplies the envelope and the rail the shell, so
        // it carries the same risk line and unsubscribe link as every other
        // step. types.ts is the spec's block verbatim, so the approved body
        // rides along as an extra ctx field the template narrows for itself.
        const s = row.spotlight_id ? spotlights.get(row.spotlight_id) : undefined;
        if (!s) {
          why = "approved spotlight row not found";
        } else {
          mail = renderLifecycle(row.flow, row.step, {
            ...ctx,
            spotlight: {
              subject: s.subject,
              html: s.html,
              text: s.text,
              guideUrl: s.guide_url ?? `${APP_URL}/daily-analysis`,
            },
          } as LifecycleCtx);
        }
      } else if (!templateFor(row.flow, row.step)) {
        why = `no template for ${row.flow}/${row.step}`;
      } else {
        mail = renderLifecycle(row.flow, row.step, ctx);
      }
    } catch (e) {
      why = String(e);
    }

    let ok = false;
    if (mail) {
      const unsubUrl = `${APP_URL}/api/email/unsubscribe?token=${encodeURIComponent(row.unsub_token)}`;
      const res = await sendEmail({
        to: { name: row.first_name ?? row.email, email: row.email },
        from,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        // RFC 8058 one-click: Gmail and Yahoo want both, and want the POST
        // path to work without the reader signing in.
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      ok = res.ok;
      if (!ok) why = typeof res.detail === "string" ? res.detail : JSON.stringify(res.detail);
    }

    if (!mail) {
      // We never got as far as an email, so nothing was consumed on the
      // recipient's behalf: RELEASE the claim. Leaving ok = false here would
      // burn the dedupe key forever (the step could never be re-claimed) and
      // spend the user's one-per-day slot on an email they never received.
      // A send that was attempted and failed is a different thing — see below.
      released += 1;
      console.error(
        `[cron/email-lifecycle] ${row.flow}/${row.step} did not render for ${row.user_id}, claim released:`,
        why
      );
      await db.from("email_sends").delete().eq("id", row.send_id);
      continue;
    }

    if (ok) sent += 1;
    else {
      failed += 1;
      console.error(`[cron/email-lifecycle] ${row.flow}/${row.step} failed for ${row.user_id}:`, why);
    }

    // A send that actually went to SendPulse is recorded either way, and is
    // never retried: one best-effort marketing email, like deposit-dm-reminder.
    await db
      .from("email_sends")
      .update({ ok, error: ok ? null : (why ?? "unknown").slice(0, 2000) })
      .eq("id", row.send_id);
  }

  console.log(
    `[cron/email-lifecycle] claimed ${claimed.length}, sent ${sent}, failed ${failed}, released ${released}`
  );
  return NextResponse.json({ claimed: claimed.length, sent, failed, released });
}

export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}
