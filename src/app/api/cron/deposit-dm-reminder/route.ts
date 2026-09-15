import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { sendEmail } from "@/lib/sendpulse";
import { depositDmReminderEmail } from "@/lib/depositEmails";
import { depositRef } from "@/lib/depositRef";

// The 24-hour "message Admin Amelia" reminder (Gordon, 15 Sep). A member who
// submitted a deposit but hasn't clicked "Message Admin Amelia" within 24
// hours, while it's still pending, gets one email. Hourly, via Supabase
// pg_cron + pg_net (job 'deposit-dm-reminder', the same CRON_SECRET as
// daily-stats): the Vercel plan's 2 crons are taken.
//
// fn_claim_dm_reminders stamps the rows before we send, so overlapping runs
// can't double-send. A failed send is logged, not retried: it's one
// best-effort nudge, and the /upgrade pending notice keeps the reminder too.

const FROM = { name: "Market Makers FX", email: "hello@marketmakersfx.net" };

interface DueReminder {
  submission_id: string;
  member_id: string;
  email: string;
  full_name: string | null;
  amount: number | string;
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { data, error } = await db.rpc("fn_claim_dm_reminders", { p_limit: 50 });
  if (error) {
    console.error("[cron/deposit-dm-reminder] claim failed:", error.message);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }

  const due = (data ?? []) as DueReminder[];
  let sent = 0;
  for (const r of due) {
    const mail = depositDmReminderEmail({
      name: r.full_name,
      amount: Number(r.amount),
      ref: depositRef(r.member_id),
    });
    const res = await sendEmail({ to: { name: r.full_name ?? r.email, email: r.email }, from: FROM, ...mail });
    if (res.ok) sent += 1;
    else console.error(`[cron/deposit-dm-reminder] send failed for ${r.submission_id}:`, res.detail);
  }

  console.log(`[cron/deposit-dm-reminder] claimed ${due.length}, sent ${sent}`);
  return NextResponse.json({ claimed: due.length, sent });
}

export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}
