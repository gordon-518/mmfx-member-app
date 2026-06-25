import { NextRequest, NextResponse } from "next/server";
import { syncSendpulseAudiences } from "@/lib/sendpulseSync";
import { runHealthChecks } from "@/lib/health";

// Daily: (1) stamp every member's status onto their SendPulse contact in the
// signups book for segmentation (trial / member / expired / removed), and
// (2) run the dependency health check (SMTP + TradingView) — folded in here so
// we stay within the plan's 2-cron limit. Health failures email the admin via
// the SendPulse API path (independent of SMTP).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncSendpulseAudiences();

  // Health check runs regardless of sync outcome; it alerts on its own.
  const health = await runHealthChecks();

  if (result.error) {
    return NextResponse.json({ ...result, health }, { status: 500 });
  }
  console.log(
    `[cron/sendpulse-sync] ${result.total} contacts — synced ${result.synced} | health ok=${health.ok}`,
    result.counts
  );
  return NextResponse.json({ ...result, health });
}
