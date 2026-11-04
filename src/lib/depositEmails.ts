// Member emails for a reviewed deposit submission (conversion-fix 5.3). Pure
// builders, so the copy is testable; the admin action sends them. Compliance:
// they say what the tier opens, never what it earns.

import type { Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { emailMessages, riskLines } from "@/lib/email/i18n";
import { tierLabel, type MemberTier } from "@/lib/tiers";
import { ADMIN_DISPLAY_NAME, ADMIN_TELEGRAM_URL, adminDmMessage } from "@/lib/depositRef";

// In the member's language (EmailMessages.deposit). The tier names, Admin
// Amelia and the prefilled Telegram message stay in English: the team matches
// them as written. The risk line keeps its English wording, with the
// translation under it.

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

function greeting(name: string | null, locale: Locale): string {
  const m = emailMessages(locale).common;
  const first = name?.trim().split(/\s+/)[0];
  return first ? fmt(m.hi, { name: first }) : m.hiNoName;
}

function risk(locale: Locale): string[] {
  return riskLines(locale, (m) => m.deposit.riskLine);
}

function wrap(bodyHtml: string, locale: Locale): string {
  const line = risk(locale).map(esc).join("<br>");
  return `<div lang="${locale}" style="font:15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1714;max-width:520px">${bodyHtml}<p style="color:#8a8279;font-size:12px;margin-top:28px">${line}</p></div>`;
}

/** Two sentences as one paragraph: a space between them, none after "。". */
function sentences(a: string, b: string): string {
  return /[。！？]$/.test(a) ? `${a}${b}` : `${a} ${b}`;
}

function textWith(lines: string[], locale: Locale): string {
  return `${lines.join("\n\n")}\n\n${risk(locale).join("\n")}`;
}

/** `{name}` placeholders filled with escaped values, the template escaped too. */
function fmtHtml(template: string, vars: Record<string, string>): string {
  return fmt(esc(template), vars);
}

export function depositVerifiedEmail(opts: {
  name: string | null;
  amount: number;
  cumulative: number;
  tier: MemberTier;
  topUp: boolean;
  locale?: Locale;
}): DepositEmail {
  const locale = opts.locale ?? "en";
  const m = emailMessages(locale);
  const v = m.deposit.verified;
  const hi = greeting(opts.name, locale);
  const what = opts.topUp ? m.deposit.topUp : m.deposit.deposit;
  const tier = tierLabel(opts.tier);
  const sign = m.common.signoff;
  const vars = { amount: usd(opts.amount), what, tier, cumulative: usd(opts.cumulative) };
  return {
    subject: fmt(v.subject, { tier }),
    text: textWith([hi, fmt(v.body, vars), fmt(v.unlocked, { url: `${APP}/dashboard` }), sign], locale),
    html: wrap(
      `<p>${esc(hi)}</p><p>${fmtHtml(v.body, { ...vars, amount: `<b>${esc(vars.amount)}</b>`, what: esc(what), tier: `<b>${esc(tier)}</b>`, cumulative: esc(vars.cumulative) })}</p>` +
        `<p><a href="${APP}/dashboard" style="color:#ea580c;font-weight:600">${esc(v.cta)} →</a></p><p>${esc(sign)}</p>`,
      locale
    ),
  };
}

// The 24-hour nudge (Gordon, 15 Sep): the submission is pending and the member
// hasn't clicked "Message Admin Amelia". Sent once, by the deposit-dm-reminder cron.
export function depositDmReminderEmail(opts: { name: string | null; amount: number; ref: string; locale?: Locale }): DepositEmail {
  const locale = opts.locale ?? "en";
  const m = emailMessages(locale);
  const r = m.deposit.reminder;
  const hi = greeting(opts.name, locale);
  const chat = `${ADMIN_TELEGRAM_URL}?text=${encodeURIComponent(adminDmMessage({ ref: opts.ref, amount: opts.amount }))}`;
  const amount = usd(opts.amount);
  const sign = m.common.signoff;
  return {
    subject: fmt(r.subject, { amount }),
    text: textWith(
      [
        hi,
        sentences(fmt(r.body, { amount, admin: ADMIN_DISPLAY_NAME }), r.why),
        fmt(r.textLink, { admin: ADMIN_DISPLAY_NAME, url: chat }),
        fmt(r.ref, { ref: opts.ref }),
        sign,
      ],
      locale
    ),
    html: wrap(
      `<p>${esc(hi)}</p><p>${sentences(fmtHtml(r.body, { amount: `<b>${esc(amount)}</b>`, admin: esc(ADMIN_DISPLAY_NAME) }), esc(r.why))}</p>` +
        `<p><a href="${esc(chat)}" style="color:#ea580c;font-weight:600">${fmtHtml(r.cta, { admin: esc(ADMIN_DISPLAY_NAME) })} →</a></p>` +
        `<p>${fmtHtml(r.ref, { ref: `<b>${esc(opts.ref)}</b>` })}</p><p>${esc(sign)}</p>`,
      locale
    ),
  };
}

export function depositRejectedEmail(opts: { name: string | null; amount: number; reason: string; locale?: Locale }): DepositEmail {
  const locale = opts.locale ?? "en";
  const m = emailMessages(locale);
  const r = m.deposit.rejected;
  const hi = greeting(opts.name, locale);
  const amount = usd(opts.amount);
  const sign = m.common.signoff;
  return {
    subject: r.subject,
    text: textWith(
      [hi, fmt(r.body, { amount, reason: opts.reason }), fmt(r.text, { url: `${APP}/upgrade` }), sign],
      locale
    ),
    html: wrap(
      `<p>${esc(hi)}</p><p>${fmtHtml(r.body, { amount: `<b>${esc(amount)}</b>`, reason: esc(opts.reason) })}</p>` +
        `<p><a href="${APP}/upgrade#submit-deposit" style="color:#ea580c;font-weight:600">${esc(r.cta)} →</a></p>` +
        `<p>${esc(r.other)}</p><p>${esc(sign)}</p>`,
      locale
    ),
  };
}
