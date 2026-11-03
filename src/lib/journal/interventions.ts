import type { Health } from "./health";
import type { LeakResult } from "./leaks";
import type { RulesResult } from "./rules";
import { fmt, plural } from "@/i18n/format";
import { en } from "@/i18n/messages/en";
import type { JournalEngineMessages } from "./labels";

// Pure intervention engine. decideInterventions returns what is CURRENTLY true;
// dedup/cadence lives in filterUnsent (send layer). `now` is passed in so the
// module stays deterministic (no Date.now()). The text is in the reader's
// language (m); the email cron uses the English default.

export type InterventionKind = "blowup_alert" | "weekly_focus" | "inactivity_nudge";

export interface InterventionSignals {
  health: Health;
  leaks: LeakResult;
  rules: RulesResult;
  lastTradeAt: string | null;
  hasClosedTrades: boolean;
}

export interface Intervention {
  kind: InterventionKind;
  severity: "critical" | "info";
  channels: ("email" | "banner")[];
  headline: string;
  /** The weekly focus on its own, without the "This week's focus:" lead-in. */
  title?: string;
  body: string;
  action: string;
  episodeKey: string;
}

export interface SentRecord {
  kind: string;
  episode_key: string;
  sent_at: string;
}

export const INACTIVE_DAYS = 10;
export const BLOWUP_COOLDOWN_H = 48;
const DAY_MS = 86_400_000;

export function isoWeek(iso: string): string {
  const d = new Date(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // Thursday of this week
  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const fdDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fdDay + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function fmtMoney(n: number): string {
  return `${n < 0 ? "−" : "+"}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pickWeeklyFocus(
  s: InterventionSignals,
  I: JournalEngineMessages["interventions"]
): { title: string; body: string; action: string } {
  const leak = s.leaks.leaks[0];
  if (leak) {
    return {
      title: leak.title,
      body: fmt(I.leakBody, { detail: leak.detail, amount: fmtMoney(leak.dollarImpact) }),
      action: I.leakAction,
    };
  }
  const worstRule = s.rules.perRule
    .filter((r) => r.enabled && !r.inert && r.breachCount > 0)
    .sort((a, b) => b.breachCount - a.breachCount)[0];
  if (worstRule) {
    return {
      title: worstRule.title,
      body: plural(worstRule.breachCount, I.ruleBodyOne, I.ruleBodyOther),
      action: I.ruleAction,
    };
  }
  return {
    title: I.baselineTitle,
    body: I.baselineBody,
    action: I.baselineAction,
  };
}

export function decideInterventions(
  s: InterventionSignals,
  now: string,
  m: JournalEngineMessages = en.journalEngine
): Intervention[] {
  const I = m.interventions;
  const out: Intervention[] = [];
  const today = now.slice(0, 10);

  if (s.health.status === "critical") {
    out.push({
      kind: "blowup_alert",
      severity: "critical",
      channels: ["email", "banner"],
      headline: I.blowupHeadline,
      body: s.health.runwaySentence,
      action: I.blowupAction,
      episodeKey: `blowup:${today}`,
    });
  }

  const focus = pickWeeklyFocus(s, I);
  out.push({
    kind: "weekly_focus",
    severity: "info",
    channels: ["email", "banner"],
    headline: fmt(I.focusHeadline, { title: focus.title }),
    title: focus.title,
    body: focus.body,
    action: focus.action,
    episodeKey: `weekly:${isoWeek(now)}`,
  });

  if (s.hasClosedTrades && s.lastTradeAt) {
    const days = Math.floor((new Date(now).getTime() - new Date(s.lastTradeAt).getTime()) / DAY_MS);
    if (days >= INACTIVE_DAYS) {
      out.push({
        kind: "inactivity_nudge",
        severity: "info",
        channels: ["email"],
        headline: I.quietHeadline,
        body: fmt(I.quietBody, { days }),
        action: I.quietAction,
        episodeKey: `inactivity:${s.lastTradeAt.slice(0, 10)}`,
      });
    }
  }

  return out;
}

/** Email-channel interventions that still need sending (dedup + cadence). */
export function filterUnsent(
  interventions: Intervention[],
  log: SentRecord[],
  now: string
): Intervention[] {
  const sent = new Set(log.map((r) => `${r.kind}:${r.episode_key}`));
  const isMonday = new Date(now).getUTCDay() === 1;
  const lastBlowupAt = log
    .filter((r) => r.kind === "blowup_alert")
    .map((r) => new Date(r.sent_at).getTime())
    .sort((a, b) => b - a)[0];

  return interventions.filter((iv) => {
    if (!iv.channels.includes("email")) return false;
    if (sent.has(`${iv.kind}:${iv.episodeKey}`)) return false;
    if (iv.kind === "weekly_focus" && !isMonday) return false;
    if (iv.kind === "blowup_alert" && lastBlowupAt != null) {
      const hrs = (new Date(now).getTime() - lastBlowupAt) / 3_600_000;
      if (hrs < BLOWUP_COOLDOWN_H) return false;
    }
    return true;
  });
}
