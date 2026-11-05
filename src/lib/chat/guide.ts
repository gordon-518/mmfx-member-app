// The APP GUIDE: what the in-app assistant knows about the app itself, next to
// the support FACTS (plans, brokers, deposits). Built from the same English
// copy the app shows (the i18n dictionary, the access map, the content
// counts), so the assistant can't describe a page differently from the page.
//
// English on purpose: the model reads English facts and answers in the
// member's own language.

import { en } from "@/i18n/messages/en";
import { LOCALES, LOCALE_LABEL } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { FEATURE_HREF, FEATURE_MIN_TIER, TRIAL_EXTRAS } from "@/lib/access/features";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/access/featureKeys";
import { CONTENT_VARS } from "@/lib/contentCounts";
import { PUBLIC_CHANNEL_URL } from "@/lib/onboarding";
import { TIER_THRESHOLDS } from "@/lib/tiers";
import { faq } from "@/lib/upgradeContent";

export const APP_URL = "https://app.marketmakersfx.net";

/** Every page the assistant may link to (relative to APP_URL). */
export const CHAT_APP_PATHS: readonly string[] = [
  "/dashboard", "/welcome", "/upgrade", "/login", "/signup", "/forgot-password",
  ...Object.values(FEATURE_HREF),
];

const NAME: Readonly<Record<FeatureKey, string>> = {
  calendar: en.nav.calendar,
  news: en.nav.news,
  "know-your-style": en.nav.knowYourStyle,
  "daily-analysis": en.nav.dailyAnalysis,
  course: en.course.title,
  library: en.locked.features.library.title,
  indicators: en.nav.indicators,
  strategies: en.nav.strategies,
  signals: en.nav.signals,
  "live-classes": en.nav.liveClasses,
  "fundamental-desk": en.nav.fundamentalDesk,
  "ai-trading-assistant": en.nav.aiAssistant,
  "team-mm": en.nav.teamMm,
};

/** What each page is, in the words the app itself uses. */
function about(key: FeatureKey): string {
  const locked = (en.locked.features as Record<string, { pitch: string } | undefined>)[key];
  if (locked) return locked.pitch;
  switch (key) {
    case "daily-analysis": return `${en.dailyAnalysis.subtitle} A video and a PDF report every trading day.`;
    case "calendar": return en.calendar.subtitle;
    case "news": return "Gold and macro headlines with their sentiment, from the news feed.";
    case "know-your-style": return "A short questionnaire (about 6 minutes) that finds your trader archetype and the habits costing you, with a report you keep.";
    case "course": return fmt(`${en.course.subtitle} {lessons} lessons in 6 modules.`, CONTENT_VARS);
    case "signals": return en.signals.subtitle;
    default: return "";
  }
}

function opensAt(key: FeatureKey): string {
  const min = FEATURE_MIN_TIER[key];
  if (min === "free") {
    return key === "course"
      ? `Module 1 on every plan; all lessons from Foundation ($${TIER_THRESHOLDS.foundation})`
      : "every plan, Free included";
  }
  const paid = `${en.tiers[min]} ($${TIER_THRESHOLDS[min]} in cumulative deposits) and above`;
  return TRIAL_EXTRAS.has(key) ? `${paid}, and during the 14-day free trial` : paid;
}

const HOW_TO: readonly string[] = [
  `Language: the globe menu at the bottom of the side menu (and on the sign-in pages) switches the app between ${LOCALES.map((l) => LOCALE_LABEL[l]).join(", ")}. The choice follows the member to other devices. The daily analysis, the lessons, the eBooks and the signal posts themselves are in English.`,
  `Getting around: Start here (${APP_URL}/welcome) has the six first steps and the roadmap; its "How to use" button runs a two-minute guided tour of the menu. The Dashboard (${APP_URL}/dashboard) is the daily home.`,
  `Password: ${APP_URL}/forgot-password sends a 6-digit code to the member's email, then they set a new password. Signing in with Google also works for a Google email.`,
  `TradingView indicators and strategy scripts: submit the TradingView username once on ${APP_URL}/indicators (the strategies page uses the same username). Access is granted automatically, usually within 1–3 hours. ${en.tv.hint} If nothing shows after 3 hours, hand off.`,
  `AI Trading Assistant (${APP_URL}/journal, Team MM, and open during the 14-day free trial): connect an MT5 account with its account number, the broker server and the investor (read-only) password — never the master password. Demo servers aren't accepted. The password is never stored. Once connected it reads closed trades and reviews them against the MM System.`,
  `Course: ${fmt("Module 1 is open on every plan; all {lessons} lessons open from Foundation.", CONTENT_VARS)} Each lesson has a slide deck to download, and progress is saved to the account.`,
  `Team MM channel (${APP_URL}/team-mm): members on Team MM tap "Request your invite", which opens a private chat with the desk on Telegram; the desk checks and sends a personal invite link. Only @MMFX_BOSS and @MM_3000 are official desk accounts.`,
  `The free public Telegram channel is ${PUBLIC_CHANNEL_URL} — joining it is step one on Start here.`,
  `Live classes are listed with their start times (UTC) on ${APP_URL}/live-classes, with a join link once scheduled.`,
  `Deposit status: the MEMBER block shows the member's latest submission. Pending: it's in review — the team checks it against their trading account and emails them once it's approved — and the last step, if they haven't done it, is messaging Admin Amelia (@MM_3000) with the reference code the upgrade page showed them. Never say a deposit is received, approved or verified unless the MEMBER block says verified, and never promise how long a review takes. Rejected, missing, or a pending one they say is taking too long: hand off.`,
];

export function buildAppGuide(): string {
  const pages = FEATURE_KEYS.map(
    (key) => `- ${NAME[key]} (${APP_URL}${FEATURE_HREF[key]}): ${about(key)} Opens on: ${opensAt(key)}.`
  );
  const questions = faq(en.plans).map((f) => `- Q: ${f.q} A: ${f.a}`);
  return [
    "PAGES (name, link, what it is, which tier opens it; during the 14-day trial everything except the Team MM channel is open, the AI Trading Assistant included):",
    ...pages,
    "HOW TO:",
    ...HOW_TO.map((line) => `- ${line}`),
    "COMMON QUESTIONS (the upgrade page's own answers):",
    ...questions,
  ].join("\n");
}
