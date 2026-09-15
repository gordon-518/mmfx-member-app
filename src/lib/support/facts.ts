import { TIER_THRESHOLDS, type PaidTier } from "@/lib/tiers";
import { FEATURE_MIN_TIER, type FeatureMinTier } from "@/lib/access/features";
import { LIFETIME_PLANS, LIFETIME_PLAN_ORDER } from "@/lib/lifetimePlans";
import { ADMIN_DISPLAY_NAME, ADMIN_TELEGRAM_HANDLE, ADMIN_TELEGRAM_URL } from "@/lib/depositRef";
import { DUPOIN_COUNTRIES } from "@/lib/brokerRegion";
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

// A tier-specific phrase to bolt onto featuresFor()'s list for a fact that
// isn't itself a FEATURE_MIN_TIER entry: the full course unlocks at
// Foundation via the "library" gate (see access/course.ts), not its own key.
const TIER_EXTRA_LABEL: Partial<Record<PaidTier, string>> = {
  foundation: "the full course (all lessons)",
};

function featuresFor(tier: FeatureMinTier): string {
  return (Object.keys(FEATURE_MIN_TIER) as FeatureKey[])
    .filter((k) => FEATURE_MIN_TIER[k] === tier).map((k) => FEATURE_LABEL[k]).join(", ");
}

const usd = (n: number) => `USD ${n.toLocaleString("en-US")}`;

// Compliance risk footer, copied verbatim from the "Compliance footer —
// verbatim, do not remove" block in src/app/upgrade/page.tsx (~lines 357-361).
// Not exported there, and this file may only touch facts.ts/facts.test.ts, so
// it's duplicated here — keep the two in sync by hand if that copy changes.
const RISK_FOOTER = "Trading involves risk, including the possible loss of capital. No returns are guaranteed.";

// Dupoin's country list, derived once from the shared source of truth
// (brokerRegion.ts) so this text can never drift into a hand-copied list.
const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const DUPOIN_COUNTRY_NAMES = [...DUPOIN_COUNTRIES]
  .map((code) => REGION_NAMES.of(code) ?? code)
  .sort((a, b) => a.localeCompare(b))
  .join(", ");

/** Trim and strip every leading "@". Case is kept for display; `allow` lowercases separately. */
function stripHandle(h: string): string {
  return h.trim().replace(/^@+/, "");
}

/** "example.com" -> "https://example.com". A link that already has a scheme passes through. */
function normalizeLink(link: string): string {
  const trimmed = link.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function buildFactSheet(s: SupportSettings, now: Date = new Date()): FactSheet {
  // The desk runs on Singapore time, so the bonus expiry is a Singapore
  // date, not UTC — comparing against now.toISOString() would flip the code
  // off up to 8 hours early for members west of SGT.
  const sgtToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }); // YYYY-MM-DD
  const trimmedBonusCode = s.bonus_code.trim() || null;
  const validExpiry = /^\d{4}-\d{2}-\d{2}$/.test(s.bonus_code_expires);
  const bonusCode = trimmedBonusCode && validExpiry && sgtToday <= s.bonus_code_expires ? trimmedBonusCode : null;

  const plans = LIFETIME_PLAN_ORDER
    .map((p) => {
      const info = LIFETIME_PLANS[p];
      return `${info.name} ${usd(info.priceUsd)} (includes: ${info.includes.join("; ")})`;
    })
    .join(" and ");

  // Only flows with a real link are worth stating — starting a flow by id is
  // out of scope for this build. flow_id entries still count for allow.flowIds.
  const flowsWithLinks = s.approved_flows
    .map((f) => ({ ...f, link: f.link?.trim() ? normalizeLink(f.link) : undefined }))
    .filter((f): f is typeof f & { link: string } => Boolean(f.link));
  const flows = flowsWithLinks.map((f) => `- ${f.label}: ${f.link}. Use when ${f.use_when}.`).join("\n");

  // Official accounts: normalise for display (trim/strip @, keep case) and
  // separately for the allow-list (also lowercased). The admin handle and the
  // welcome bot are always allowed and always shown, whatever settings say.
  const cleanedAccounts = s.official_accounts
    .map((a) => ({ handle: stripHandle(a.handle), label: a.label }))
    .filter((a) => a.handle.length > 0);
  const adminHandleLower = ADMIN_TELEGRAM_HANDLE.toLowerCase();
  const hasAdminAccount = cleanedAccounts.some((a) => a.handle.toLowerCase() === adminHandleLower);
  const accountsForText = hasAdminAccount
    ? cleanedAccounts
    : [{ handle: ADMIN_TELEGRAM_HANDLE, label: ADMIN_DISPLAY_NAME }, ...cleanedAccounts];

  const text = [
    "PLANS (tiers count cumulative verified deposits into the member's own trading account, in their name, never balance; every top-up counts toward the next tier; the deposit is never paid to MMFX; no fee for these broker tiers — the US/UK lifetime plans are a one-off payment instead, see US AND UK):",
    `- Free (after the trial): ${featuresFor("free")}.`,
    `- Foundation, from $${TIER_THRESHOLDS.foundation}: adds ${featuresFor("foundation")} and ${TIER_EXTRA_LABEL.foundation ?? ""}.`,
    `- Desk, from $${TIER_THRESHOLDS.desk}: adds ${featuresFor("desk")}.`,
    `- Team MM, from $${TIER_THRESHOLDS.team}: adds ${featuresFor("team")}.`,
    `RISK: ${RISK_FOOTER} Never tell anyone their money is safe or protected.`,
    `TRIAL: ${TRIAL_DAYS} days of Desk-level access for new signups — everything except ${featuresFor("team")}. A deposit that reaches Team MM ($${TIER_THRESHOLDS.team}) during the trial unlocks it immediately; otherwise trial access continues until the trial ends, then the member moves to the tier their verified deposits reached (Free below $${TIER_THRESHOLDS.foundation}).`,
    `US AND UK: partner brokers can't take them. Two lifetime plans, paid once: ${plans}. Payment is arranged in chat on the upgrade page.`,
    `BROKERS: Dupoin for exactly these countries: ${DUPOIN_COUNTRY_NAMES}. US and UK: the lifetime plans (see US AND UK). Every other country: Octa or Elev8. The upgrade page picks automatically from the member's country. If the member's country isn't known, send the upgrade page and never guess.`,
    `HOW TO JOIN, always in this order: 1) open an account through the upgrade page (Octa: ${OCTA_SIGNUP}, Dupoin: ${DUPOIN_SIGNUP}). Send the direct broker link only when the member's country is known (they said it, or a country tag shows it) and matches that broker; otherwise send the upgrade page. 2) top up from $${TIER_THRESHOLDS.foundation}; 3) only after the top-up, message ${ADMIN_DISPLAY_NAME} (@${ADMIN_TELEGRAM_HANDLE}) with the reference code shown on the upgrade page (MM- plus 6 characters); 4) submit the deposit details on the upgrade page (broker, account number, amount, screenshot, TradingView and Telegram usernames); 5) the team checks it and emails them when it's approved. Never tell anyone to message ${ADMIN_DISPLAY_NAME} before topping up.`,
    `ALREADY WITH OCTA OR ELEV8: keep the account and switch partner: Octa ${OCTA_CHANGE_IB} or Elev8 ${ELEV8_CHANGE_IB}, IB number ${IB_NUMBER}, reason to paste exactly: "${SWITCH_REASON}" Then hold at least $${TIER_THRESHOLDS.foundation} and submit on the upgrade page. Existing Dupoin clients send ${ADMIN_DISPLAY_NAME} their full name and Dupoin UID.`,
    `BONUS: Dupoin's 100% deposit bonus is shown in the app. ${bonusCode ? `Octa/Elev8 bonus code: ${bonusCode} (valid until ${s.bonus_code_expires}).` : "There is no Octa/Elev8 bonus code right now; hand off bonus-code requests."}`,
    `LINKS YOU MAY USE: ${APP_PATHS.filter((p) => p !== "/").map((p) => APP + p).join(", ")}, ${ADMIN_TELEGRAM_URL}.`,
    `APPROVED FLOW LINKS:\n${flows || "- none"}`,
    `OFFICIAL ACCOUNTS: ${accountsForText.map((a) => `@${a.handle} (${a.label})`).join(", ")}. Staff never ask for passwords or ask anyone to send money to a person.`,
    `HUMAN REPLIES: ${s.office_hours}. TRADE CADENCE: ${s.trade_cadence}.`,
    s.notes ? `NOTES: ${s.notes}` : "",
  ].filter(Boolean).join("\n");

  const urls = [OCTA_SIGNUP, DUPOIN_SIGNUP, OCTA_CHANGE_IB, ELEV8_CHANGE_IB, ADMIN_TELEGRAM_URL, BOT_LINK,
    ...flowsWithLinks.map((f) => f.link)];

  return {
    text,
    allow: {
      amounts: new Set<number>([...Object.values(TIER_THRESHOLDS), ...LIFETIME_PLAN_ORDER.map((p) => LIFETIME_PLANS[p].priceUsd)]),
      urls,
      appPaths: APP_PATHS,
      handles: new Set([...cleanedAccounts.map((a) => a.handle.toLowerCase()), adminHandleLower, "marketmakers18bot"]),
      ibNumber: IB_NUMBER,
      bonusCode,
      flowIds: new Set(s.approved_flows.map((f) => f.flow_id).filter((x): x is string => Boolean(x))),
    },
  };
}
