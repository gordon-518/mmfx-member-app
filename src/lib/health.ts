import "server-only";
import { checkSmtpAuth } from "@/lib/smtpCheck";
import { testTVSession } from "@/lib/tv/client";
import { sendAdminAlert } from "@/lib/notify";

export interface HealthResult {
  ok: boolean;
  smtp: boolean;
  tradingview: boolean;
  failures: string[];
}

// Probes the critical external dependencies that have broken before. On ANY
// failure it emails the admin via the SendPulse HTTP API (independent of the
// SMTP creds — so the alert sends even when SMTP is the thing that's down).
// Shared by the daily cron (folded into sendpulse-sync) and the admin-triggered
// /api/cron/health route.
export async function runHealthChecks(): Promise<HealthResult> {
  const failures: string[] = [];

  const smtp = await checkSmtpAuth();
  if (!smtp.ok) {
    failures.push(
      `EMAIL SENDING IS DOWN — new members can't get signup/login emails.\n` +
      `SMTP said: ${smtp.detail}\n` +
      `Fix: update the SendPulse SMTP password in Supabase → Authentication → SMTP Settings ` +
      `(and re-set the rate limit in the same save — changing the password resets it to 2/hr).`
    );
  }

  const tv = await testTVSession();
  if (!tv.ok) {
    failures.push(
      `TRADINGVIEW SESSION IS DOWN — indicator/strategy grants will fail.\n` +
      `Detail: ${tv.detail}\n` +
      `Fix: paste a fresh cookie in /admin → TradingView session.`
    );
  }

  if (failures.length > 0) {
    await sendAdminAlert(
      `🚨 MMFX health check FAILED (${failures.length} issue${failures.length > 1 ? "s" : ""})`,
      failures.join("\n\n———\n\n") + `\n\nChecked: ${new Date().toISOString()}`
    );
  }

  return {
    ok: failures.length === 0,
    smtp: smtp.ok,
    tradingview: tv.ok,
    failures,
  };
}
