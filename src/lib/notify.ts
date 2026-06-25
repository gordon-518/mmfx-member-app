import "server-only";
import { sendEmail } from "@/lib/sendpulse";

// Ops alert to the admin. Thin wrapper over the shared SendPulse helper so
// there's a single send path. Best-effort — never throws.

export interface AlertResult {
  ok: boolean;
  detail: unknown;
}

export async function sendAdminAlert(subject: string, text: string): Promise<AlertResult> {
  const to = process.env.ALERT_TO_EMAIL || "gordon@marketmakersfx.net";
  const from = process.env.ALERT_FROM_EMAIL || "alerts@marketmakersfx.net";

  const html = `<pre style="font:14px/1.5 monospace;white-space:pre-wrap">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre>`;

  return sendEmail({
    to: { name: "MMFX Admin", email: to },
    from: { name: "MMFX Alerts", email: from },
    subject,
    html,
    text,
  });
}
