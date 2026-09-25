import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { partnerDb } from "@/lib/partners/client";
import { fetchFunnel } from "@/lib/partners/funnel";
import { renderPartnerWeekly } from "@/lib/email/partnerWeekly";
import { sendEmail, type EmailAddress } from "@/lib/sendpulse";

// The partner's Monday email (design 2026-09-25 §2.7). Scheduled by pg_cron +
// pg_net at 01:00 UTC on Mondays — 09:00 SGT — with the snippet in
// 20260925000001_partner_attribution.sql's ops footer.
//
// Tiny by design: a handful of partners, one seven-day query each, one email
// each. No claim table and no dedupe key, because a weekly job that runs
// twice sends a duplicate report, which is an annoyance rather than the
// marketing-email problem the lifecycle rail had to solve.
//
// A partner without report_email is skipped, so the job is safe to schedule
// before any address is filled in — which is the state it ships in.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_FROM = "Market Makers FX <hello@marketmakersfx.net>";
const WEEK_MS = 7 * 86_400_000;

interface PartnerRow {
  slug: string;
  name: string;
  report_email: string | null;
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await serviceClient()
    .from("partners")
    .select("slug, name, report_email")
    .eq("active", true);

  if (error) {
    console.error("[cron/partner-weekly] partner read failed:", error.message);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }

  const partners = ((data ?? []) as PartnerRow[]).filter((p) => !!p.report_email?.trim());
  if (!partners.length) return NextResponse.json({ sent: 0, skipped: 0 });

  const until = new Date();
  const since = new Date(until.getTime() - WEEK_MS);
  const from = parseSender(process.env.EMAIL_FROM_MARKETING);

  let sent = 0;
  let failed = 0;

  for (const p of partners) {
    try {
      const rows = await fetchFunnel(partnerDb(), {
        slug: p.slug,
        since,
        until,
        // The rule the contract pays on. The dashboard can show either; the
        // weekly report shows the one the money follows.
        rule: "last_paid_7d",
      });
      const mail = renderPartnerWeekly({ partnerName: p.name, since, until, rows });
      const res = await sendEmail({
        to: { name: p.name, email: p.report_email!.trim() },
        from,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      if (res.ok) sent += 1;
      else {
        failed += 1;
        console.error(`[cron/partner-weekly] ${p.slug} send failed:`, res.detail);
      }
    } catch (e) {
      // One partner's bad week must not cost the others their report.
      failed += 1;
      console.error(`[cron/partner-weekly] ${p.slug} threw:`, e);
    }
  }

  return NextResponse.json({ sent, failed, skipped: (data ?? []).length - partners.length });
}
