import "server-only";
import type { GrowthMetrics } from "@/lib/growth/metrics";
import { deltaPct } from "@/lib/growth/metrics";

// Turns the day's aggregate numbers into a short written growth read via the
// Anthropic API, and formats the Telegram digest. Best-effort: the narrative
// resolves to null on any failure so the snapshot + push still succeed.
//
// Numbers only — no member PII is ever sent to the model or to Telegram.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";

/** A prior snapshot row, narrowed to the headline numbers we diff against. */
export interface PriorSnapshot {
  signups_today: number;
  trials_active: number;
  conversions_today: number;
  members_active: number;
  churn_today: number;
}

export interface NarrativeContext {
  today: GrowthMetrics;
  /** Yesterday's snapshot (day-over-day), if present. */
  yesterday?: PriorSnapshot | null;
  /** The snapshot 7 days ago (week-over-week), if present. */
  lastWeek?: PriorSnapshot | null;
}

function deltaLine(label: string, current: number, prior?: number | null): string {
  if (prior == null) return `- ${label}: ${current} (no prior baseline)`;
  const d = deltaPct(current, prior);
  const arrow = d == null ? "" : d > 0 ? ` (▲ ${d}%)` : d < 0 ? ` (▼ ${Math.abs(d)}%)` : " (flat)";
  return `- ${label}: ${current} vs ${prior}${arrow}`;
}

/** Build the numbers-only prompt fed to the model. */
export function buildPrompt(ctx: NarrativeContext): string {
  const { today, yesterday, lastWeek } = ctx;
  const brokers = today.broker_split;
  return [
    "You are the growth analyst for MarketMakersFX, a forex/gold education + broker-IB business.",
    "Write a SHORT daily growth read (3–5 sentences, plain text, no markdown headings) for the founder.",
    "Lead with the most important movement, call out anything actionable (e.g. trials expiring soon → nudge them),",
    "and be specific with the numbers. Do not invent data beyond what is given. No preamble.",
    "",
    "Today's snapshot (" + today.date + ", Singapore time):",
    `- New signups: ${today.signups_today} today, ${today.signups_7d} last 7d, ${today.signups_30d} last 30d`,
    `- Active trials: ${today.trials_active}`,
    `- Trials expiring within 48h: ${today.trials_expiring_48h}`,
    `- Trial→member conversions today: ${today.conversions_today}`,
    `- Active members: ${today.members_active}`,
    `- Churn today: ${today.churn_today}`,
    `- TV engagement: ${today.tv_engagement_pct}% of members`,
    `- Broker split (members): Octa ${brokers.octa}, Dupoin ${brokers.dupoin}, Elev8 ${brokers.elev8}`,
    "",
    "Day-over-day (vs yesterday):",
    deltaLine("Signups", today.signups_today, yesterday?.signups_today),
    deltaLine("Active trials", today.trials_active, yesterday?.trials_active),
    deltaLine("Conversions", today.conversions_today, yesterday?.conversions_today),
    deltaLine("Members", today.members_active, yesterday?.members_active),
    "",
    "Week-over-week (vs 7 days ago):",
    deltaLine("Active trials", today.trials_active, lastWeek?.trials_active),
    deltaLine("Members", today.members_active, lastWeek?.members_active),
  ].join("\n");
}

/** Generate the AI narrative. Returns null on any failure (best-effort). */
export async function buildNarrative(ctx: NarrativeContext): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{ role: "user", content: buildPrompt(ctx) }],
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text = Array.isArray(data?.content)
      ? data.content
          .filter((b: { type?: string }) => b?.type === "text")
          .map((b: { text?: string }) => b.text ?? "")
          .join("")
          .trim()
      : "";
    return text || null;
  } catch {
    return null;
  }
}
