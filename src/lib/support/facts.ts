import { TIER_THRESHOLDS } from "@/lib/tiers";
import { FEATURE_MIN_TIER } from "@/lib/access/features";
import { LIFETIME_PLANS, LIFETIME_PLAN_ORDER } from "@/lib/lifetimePlans";
import { ADMIN_DISPLAY_NAME, ADMIN_TELEGRAM_HANDLE, ADMIN_TELEGRAM_URL } from "@/lib/depositRef";
import {
  BOT_LINK, DUPOIN_SIGNUP, ELEV8_CHANGE_IB, IB_NUMBER, OCTA_CHANGE_IB, OCTA_SIGNUP, SWITCH_REASON,
} from "@/lib/brokerLinks";
import type { FactSheet, SupportSettings } from "./types";

/** New-signup trial length. Source of truth: handle_new_user (supabase/migrations). */
export const TRIAL_DAYS = 14;

const APP = "https://app.marketmakersfx.net";
const APP_PATHS = ["/", "/signup", "/login", "/upgrade", "/indicators", "/team-mm", "/course", "/daily-analysis"];

type FeatureKey = keyof typeof FEATURE_MIN_TIER;
const FEATURE_LABEL: Record<FeatureKey, string> = {
  calendar: "Economic Calendar",
  news: "News",
  "know-your-style": "Know Your Style",
  "daily-analysis": "Daily Analysis",
  course: "the course (Module 1 on Free; all 19 lessons from Foundation)",
  library: "the MM Library",
  indicators: "the TradingView indicators",
  strategies: "the strategy scripts",
  signals: "the public Telegram signals channel",
  "live-classes": "Live Classes",
  "fundamental-desk": "the Fundamental Desk",
  "ai-trading-assistant": "the AI Trading Assistant",
  "team-mm": "the private Team MM channel",
};

function featuresFor(tier: "free" | "foundation" | "desk" | "team"): string {
  return (Object.keys(FEATURE_MIN_TIER) as FeatureKey[])
    .filter((k) => FEATURE_MIN_TIER[k] === tier).map((k) => FEATURE_LABEL[k]).join(", ");
}

const usd = (n: number) => `USD ${n.toLocaleString("en-US")}`;

export function buildFactSheet(s: SupportSettings, now: Date = new Date()): FactSheet {
  const today = now.toISOString().slice(0, 10);
  const bonusCode = s.bonus_code && today <= s.bonus_code_expires ? s.bonus_code : null;
  const plans = LIFETIME_PLAN_ORDER.map((p) => `${LIFETIME_PLANS[p].name} ${usd(LIFETIME_PLANS[p].priceUsd)}`).join(" and ");
  const flows = s.approved_flows.map((f) => `- ${f.label}${f.link ? `: ${f.link}` : ""}. Use when ${f.use_when}.`).join("\n");

  const text = [
    "PLANS (tiers count cumulative verified deposits into the member's own trading account, never balance; every top-up counts toward the next tier; there is no fee and the money stays theirs):",
    `- Free (after the trial): ${featuresFor("free")}.`,
    `- Foundation, from $${TIER_THRESHOLDS.foundation}: adds ${featuresFor("foundation")}.`,
    `- Desk, from $${TIER_THRESHOLDS.desk}: adds ${featuresFor("desk")}.`,
    `- Team MM, from $${TIER_THRESHOLDS.team}: adds ${featuresFor("team")}.`,
    `TRIAL: ${TRIAL_DAYS} days for new signups. Someone who deposits during the trial keeps full trial access until it ends, then drops to the tier their deposits reached.`,
    `US AND UK: partner brokers can't take them. Two lifetime plans, paid once: ${plans}. Payment is arranged in chat on the upgrade page.`,
    `BROKERS: ${APP}/upgrade detects the member's country and shows the right broker: Octa or Elev8 for most countries; Dupoin for Canada, the EU/EEA, Japan, New Zealand, the Philippines, Singapore and a few others.`,
    `HOW TO JOIN, always in this order: 1) open an account through the upgrade page (Octa: ${OCTA_SIGNUP}, Dupoin: ${DUPOIN_SIGNUP}); 2) top up from $${TIER_THRESHOLDS.foundation}; 3) only after the top-up, message ${ADMIN_DISPLAY_NAME} (@${ADMIN_TELEGRAM_HANDLE}) with the reference code shown on the upgrade page (MM- plus 6 characters); 4) submit the deposit details on the upgrade page (broker, account number, amount, screenshot, TradingView and Telegram usernames); 5) the team checks it and emails them when it's approved. Never tell anyone to message ${ADMIN_DISPLAY_NAME} before topping up.`,
    `ALREADY WITH OCTA OR ELEV8: keep the account and switch partner: Octa ${OCTA_CHANGE_IB} or Elev8 ${ELEV8_CHANGE_IB}, IB number ${IB_NUMBER}, reason "${SWITCH_REASON}". Then hold at least $${TIER_THRESHOLDS.foundation} and submit on the upgrade page. Existing Dupoin clients send ${ADMIN_DISPLAY_NAME} their full name and Dupoin UID.`,
    `BONUS: Dupoin's 100% deposit bonus is shown in the app. ${bonusCode ? `Octa/Elev8 bonus code: ${bonusCode} (valid until ${s.bonus_code_expires}).` : "There is no Octa/Elev8 bonus code right now; hand off bonus-code requests."}`,
    `LINKS YOU MAY USE: ${APP_PATHS.filter((p) => p !== "/").map((p) => APP + p).join(", ")}, ${ADMIN_TELEGRAM_URL}.`,
    `APPROVED FLOW LINKS:\n${flows || "- none"}`,
    `OFFICIAL ACCOUNTS: ${s.official_accounts.map((a) => `@${a.handle} (${a.label})`).join(", ")}. Staff never ask for passwords or ask anyone to send money to a person.`,
    `HUMAN REPLIES: ${s.office_hours}. TRADE CADENCE: ${s.trade_cadence}.`,
    s.notes ? `NOTES: ${s.notes}` : "",
  ].filter(Boolean).join("\n");

  const urls = [OCTA_SIGNUP, DUPOIN_SIGNUP, OCTA_CHANGE_IB, ELEV8_CHANGE_IB, ADMIN_TELEGRAM_URL, BOT_LINK,
    ...s.approved_flows.map((f) => f.link).filter((l): l is string => Boolean(l))];

  return {
    text,
    allow: {
      amounts: new Set<number>([...Object.values(TIER_THRESHOLDS), ...LIFETIME_PLAN_ORDER.map((p) => LIFETIME_PLANS[p].priceUsd)]),
      urls,
      appPaths: APP_PATHS,
      handles: new Set([...s.official_accounts.map((a) => a.handle.toLowerCase()), "marketmakers18bot"]),
      ibNumber: IB_NUMBER,
      bonusCode,
      flowIds: new Set(s.approved_flows.map((f) => f.flow_id).filter((x): x is string => Boolean(x))),
    },
  };
}
