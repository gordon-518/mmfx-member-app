// Member emails for a reviewed deposit submission (conversion-fix 5.3). Pure
// builders, so the copy is testable; the admin action sends them. Compliance:
// they say what the tier opens, never what it earns.

import { tierLabel, type MemberTier } from "@/lib/tiers";
import { ADMIN_DISPLAY_NAME, ADMIN_TELEGRAM_URL, adminDmMessage } from "@/lib/depositRef";

export interface DepositEmail {
  subject: string;
  html: string;
  text: string;
}

const APP = "https://app.marketmakersfx.net";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function wrap(bodyHtml: string): string {
  return `<div style="font:15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1714;max-width:520px">${bodyHtml}<p style="color:#8a8279;font-size:12px;margin-top:28px">Trading involves risk, including the possible loss of capital. No returns are guaranteed.</p></div>`;
}

export function depositVerifiedEmail(opts: {
  name: string | null;
  amount: number;
  cumulative: number;
  tier: MemberTier;
  topUp: boolean;
}): DepositEmail {
  const hi = opts.name ? `Hi ${opts.name.split(/\s+/)[0]},` : "Hi,";
  const what = opts.topUp ? "top-up" : "deposit";
  const tier = tierLabel(opts.tier);
  const lines = [
    hi,
    `Your ${usd(opts.amount)} ${what} is verified. You're on ${tier}, with ${usd(opts.cumulative)} in deposits so far, and your desk is open now.`,
    `Everything on your tier is unlocked. Open the desk: ${APP}/dashboard`,
    "— Don, Market Makers FX",
  ];
  return {
    subject: `Verified: you're on ${tier}`,
    text: lines.join("\n\n") + "\n\nTrading involves risk, including the possible loss of capital. No returns are guaranteed.",
    html: wrap(
      `<p>${esc(hi)}</p><p>Your <b>${esc(usd(opts.amount))}</b> ${what} is verified. You're on <b>${esc(tier)}</b>, with ${esc(usd(opts.cumulative))} in deposits so far, and your desk is open now.</p>` +
        `<p><a href="${APP}/dashboard" style="color:#ea580c;font-weight:600">Open your desk →</a></p><p>— Don, Market Makers FX</p>`
    ),
  };
}

// The 24-hour nudge (Gordon, 15 Sep): the submission is pending and the member
// hasn't clicked "Message Admin Amelia". Sent once, by the deposit-dm-reminder cron.
export function depositDmReminderEmail(opts: { name: string | null; amount: number; ref: string }): DepositEmail {
  const hi = opts.name ? `Hi ${opts.name.split(/\s+/)[0]},` : "Hi,";
  const chat = `${ADMIN_TELEGRAM_URL}?text=${encodeURIComponent(adminDmMessage(opts.ref, opts.amount))}`;
  const why = `Our admin can't message you first, so it's how we reach you if anything about your deposit needs checking.`;
  const lines = [
    hi,
    `Your ${usd(opts.amount)} deposit is in for review. One step is left: send ${ADMIN_DISPLAY_NAME} a message on Telegram. ${why}`,
    `Message ${ADMIN_DISPLAY_NAME}: ${chat}`,
    `Your reference is ${opts.ref}. It's already in the message.`,
    "— Don, Market Makers FX",
  ];
  return {
    subject: `One last step for your ${usd(opts.amount)} deposit`,
    text: lines.join("\n\n") + "\n\nTrading involves risk, including the possible loss of capital. No returns are guaranteed.",
    html: wrap(
      `<p>${esc(hi)}</p><p>Your <b>${esc(usd(opts.amount))}</b> deposit is in for review. One step is left: send ${esc(ADMIN_DISPLAY_NAME)} a message on Telegram. ${esc(why)}</p>` +
        `<p><a href="${esc(chat)}" style="color:#ea580c;font-weight:600">Message ${esc(ADMIN_DISPLAY_NAME)} on Telegram →</a></p>` +
        `<p>Your reference is <b>${esc(opts.ref)}</b>. It's already in the message.</p><p>— Don, Market Makers FX</p>`
    ),
  };
}

export function depositRejectedEmail(opts: { name: string | null; amount: number; reason: string }): DepositEmail {
  const hi = opts.name ? `Hi ${opts.name.split(/\s+/)[0]},` : "Hi,";
  const lines = [
    hi,
    `We couldn't verify your ${usd(opts.amount)} deposit yet: ${opts.reason}`,
    `You can submit it again from ${APP}/upgrade, or message us on WhatsApp or Telegram and we'll sort it out with you.`,
    "— Don, Market Makers FX",
  ];
  return {
    subject: "About your deposit submission",
    text: lines.join("\n\n") + "\n\nTrading involves risk, including the possible loss of capital. No returns are guaranteed.",
    html: wrap(
      `<p>${esc(hi)}</p><p>We couldn't verify your <b>${esc(usd(opts.amount))}</b> deposit yet: ${esc(opts.reason)}</p>` +
        `<p><a href="${APP}/upgrade#submit-deposit" style="color:#ea580c;font-weight:600">Submit it again →</a></p>` +
        `<p>Or message us on WhatsApp or Telegram and we'll sort it out with you.</p><p>— Don, Market Makers FX</p>`
    ),
  };
}
