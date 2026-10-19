// The member block on a "Needs Amelia" Telegram ping (Gordon, 28 Sep).
//
// The ping used to carry only a first name, an @handle and the member's
// message, so an upgrade question arrived with nothing to act on: no tier, no
// trading account, no idea whether a deposit was already sitting in the queue.
// runBurst already resolves all of that to answer the member (member.ts), so
// it costs nothing to put it in the ping.
//
// Only what Gordon needs to check both ends — the member's own account facts.
// The member's typed text is still redacted separately in run.ts, because
// Telegram sits outside the 90-day support_events purge.

import { depositRef } from "@/lib/depositRef";
import { BRAND } from "@/lib/brand";
import { tierLabel } from "@/lib/tiers";
import type { MemberContext } from "./types";

/** The three characters Telegram treats as special inside HTML text. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function day(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Telegram HTML for the member block, or "" when the chat isn't matched to a
 * member (nothing to say, so the ping stays short).
 */
export function memberPingHtml(member: MemberContext | null, now: Date = new Date()): string {
  if (!member) return "";

  const lines: string[] = [];
  lines.push(
    `👤 <b>${esc(tierLabel(member.tier))}</b> · ref <code>${esc(depositRef(member.userId))}</code>` +
      (member.email ? ` · ${esc(member.email)}` : "")
  );

  const account = member.tradingAccount
    ? `account <code>${esc(member.tradingAccount)}</code>`
    : "<i>no trading account on file</i>";
  const broker = member.broker ? ` · ${esc(member.broker)}` : "";
  const total = member.depositTotal ?? 0;
  const deposited = total > 0 ? ` · ${esc(usd(total))} deposited` : "";
  lines.push(`${account}${broker}${deposited}`);

  if (member.submission) {
    const s = member.submission;
    const amount = s.amount != null ? ` ${esc(usd(s.amount))}` : "";
    const sBroker = s.broker ? ` · ${esc(s.broker)}` : "";
    const why = s.status === "rejected" && s.rejectReason ? ` — ${esc(s.rejectReason)}` : "";
    lines.push(`Submission: <b>${esc(s.status)}</b>${amount}${sBroker} (${esc(day(s.createdAt))})${why}`);
  } else {
    lines.push("Submission: <i>none yet</i>");
  }

  if (member.trialEndsAt && new Date(member.trialEndsAt) > now) {
    lines.push(`Trial ends ${esc(day(member.trialEndsAt))}`);
  }

  // A ref code is self-asserted: it can be forwarded or pasted from someone
  // else's screenshot, so say plainly that these facts may not be this person's.
  if (!member.attested) {
    lines.push("⚠️ <i>Matched by the code they typed, not their Telegram account — check before acting.</i>");
  }

  lines.push(`<a href="${BRAND.appUrl}/admin">Open the admin queue</a>`);
  return `\n\n${lines.join("\n")}`;
}
