#!/usr/bin/env node
/**
 * Seed one CTA post per MMFX feature into public.content_library as DRAFTS,
 * so they can be vetted (approve/skip) before entering the 4-hourly rotation.
 *
 *   node scripts/seed-feature-ctas.mjs [--dry-run] [--status approved]
 *   node scripts/seed-feature-ctas.mjs --dm      # also DM each draft with Approve/Skip
 *
 * Every post is checked against the compliance lint before insert: no promised
 * returns, no broker payout mechanics, no IB identifiers. Buttons use slugs from
 * the /go allowlist (src/lib/channel/destinations.ts).
 */
import fs from "node:fs";
import path from "node:path";

const REF = "dldrcitoeoxzfctsqlmo";
const PROJ = `https://${REF}.supabase.co`;

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}
function envVar(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const m = env.match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  } catch {}
  return null;
}

// Mirror of src/lib/channel/compliance.ts (scripts can't import server-only TS).
const BLOCKED = [
  /\bguarantee(?:d|s)?\b/i, /\bno[-\s]?loss\b/i, /\b47807426\b/,
  /\$?\d+\s*\/\s*lot\b/i, /\brebate(?:s)?\b/i, /\bIB\s*link\b/i,
];
const lint = (t) => BLOCKED.map((re) => (t.match(re) || [])[0]).filter(Boolean);

const POSTS = [
  {
    feature: "MM Mentorship (Course)",
    button: { text: "Open the course →", slug: "course" },
    body:
      "⚜️ **The MM System, start to finish.**\n\n" +
      "19 lessons across 6 modules — foundations, reading price, the institutional edge, " +
      "building your bias, the entry model, and the routine that holds it together.\n\n" +
      "Not signals to follow. __A method you can run yourself.__\n\n" +
      "**Structure over feelings. Process over profit.**",
  },
  {
    feature: "MM Library (eBooks)",
    button: { text: "Browse the library →", slug: "library" },
    body:
      "⚜️ **The whole system, on paper.**\n\n" +
      "Four eBooks led by __The MM System__ — read them in the browser or take them offline.\n\n" +
      "The kind you re-read at a different stage of your trading and find something you missed the first time.",
  },
  {
    feature: "Indicators",
    button: { text: "See the indicators →", slug: "indicators" },
    body:
      "⚜️ **Ten MM indicators. On your charts in a minute.**\n\n" +
      "Squeeze Pulse · Wave Pressure · Structure Map · Echo Predictor · Trend Rail · " +
      "Pivot Trend · MTF Minicharts · Auto Trendlines · Adaptive MA · Reversion Bands.\n\n" +
      "Drop in your TradingView name and they appear — __no codes, no manual sharing.__",
  },
  {
    feature: "Strategies",
    button: { text: "Backtest it yourself →", slug: "strategies" },
    body:
      "⚜️ **Don't take our word for it — backtest it.**\n\n" +
      "The entry model as a TradingView strategy script. Run it over your own history, " +
      "your own dates, your own settings.\n\n" +
      "__Test the method before you trust it.__ That's the whole point.",
  },
  {
    feature: "Daily Analysis",
    button: { text: "Today's gold read →", slug: "daily-analysis" },
    body:
      "⚜️ **Every session, the Gold read.**\n\n" +
      "Bias, levels, and — the part that matters — __the reasoning behind them.__ " +
      "Daily → 4H → 1H → 15M, top-down, with the PDF to keep.\n\n" +
      "You're not meant to copy it. You're meant to learn to build it.",
  },
  {
    feature: "Signals (TeamMM private desk)",
    button: { text: "Ask about TeamMM access →", slug: "teammm" },
    body:
      "\u269c\ufe0f **TeamMM \u2014 the private signals desk.**\n" +
      "\n" +
      "\ud83c\udfaf Entry. Stop. Target.\n" +
      "Minimum 1:2 R:R \u00b7 London & New York sessions.\n" +
      "\n" +
      "This one isn't public.\n" +
      "__TeamMM is for Market Makers clients only.__\n" +
      "\n" +
      "Every call on the record, with a weekly recap.\n" +
      "\n" +
      "Talk to the desk about access \u2193\n" +
      "\n" +
      "__Educational use only. Trading involves risk.__",
  },
  {
    feature: "Live Classes",
    button: { text: "See the schedule →", slug: "live-classes" },
    body:
      "⚜️ **Twice a week, live on the charts.**\n\n" +
      "Not a replay. The desk reading price in real time — you see the hesitation, " +
      "the invalidation, the trade that __didn't__ qualify.\n\n" +
      "That's where the method actually clicks.",
  },
  {
    feature: "Economic Calendar",
    button: { text: "Check this week →", slug: "calendar" },
    body:
      "⚜️ **Know what's about to move Gold.**\n\n" +
      "High and medium-impact releases, week by week, filterable by currency.\n\n" +
      "Most bad trades aren't bad analysis — they're __good analysis at the wrong minute.__",
  },
  {
    feature: "News & Articles",
    button: { text: "Read the tape →", slug: "news" },
    body:
      "⚜️ **The macro tape, filtered to what you trade.**\n\n" +
      "Sentiment-tagged headlines across 19 instruments — the context behind the candle, " +
      "without the doomscroll.\n\n" +
      "__Context informs bias. It never replaces your entry rules.__",
  },
  {
    feature: "Fundamental Desk (AI)",
    button: { text: "Ask the desk →", slug: "fundamental" },
    body:
      "⚜️ **Ask the desk why Gold is moving.**\n\n" +
      "An AI fundamental desk on the live macro picture driving XAU/USD — " +
      "rates, dollar, real yields, central-bank demand. It emails you the thesis as a PDF.\n\n" +
      "__Understand the why, not just the where.__",
  },
  {
    feature: "Know Your Style (AI)",
    button: { text: "Find your style →", slug: "know-your-style" },
    body:
      "⚜️ **What kind of trader are you actually?**\n\n" +
      "Two minutes. An honest read on your archetype — and the setups that suit how " +
      "you're actually wired, not how you wish you were.\n\n" +
      "__Most blown accounts are a style mismatch, not a strategy problem.__",
  },
  {
    feature: "Whole desk / free trial",
    button: { text: "Start your free trial →", slug: "signup" },
    body:
      "⚜️ **The whole desk. Free for 7 days.**\n\n" +
      "Course, 10 indicators, strategies, eBooks, daily Gold analysis, live classes, " +
      "the calendar, and two AI tools — __one login, no card.__\n\n" +
      "Use it for a week. Decide with evidence.",
  },
];

async function main() {
  const DRY = !!arg("dry-run", false);
  const status = arg("status", "draft");
  const DM = !!arg("dm", false);

  console.log(`\nFeature CTA posts — ${POSTS.length} total (status: ${status})${DRY ? "  [DRY RUN]" : ""}\n`);

  const clean = [];
  for (const p of POSTS) {
    const hits = lint(p.body);
    if (hits.length) { console.log(`  ✗ ${p.feature}: BLOCKED by lint → ${hits.join(", ")}`); continue; }
    console.log(`  ✓ ${p.feature.padEnd(26)} [${p.button.text}] → /${p.button.slug}`);
    clean.push(p);
  }
  if (DRY) { console.log(`\n[DRY RUN] ${clean.length} would be inserted. Nothing written.`); return; }

  const SERVICE = envVar("SUPABASE_SERVICE_ROLE_KEY");
  if (!SERVICE) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing (env or .env.local).");
  const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

  const rows = clean.map((p) => ({
    kind: "cta", body: p.body, status, source: "manual", button_set: [p.button],
  }));
  const r = await fetch(`${PROJ}/rest/v1/content_library`, {
    method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`insert ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const inserted = await r.json();
  console.log(`\n✓ Inserted ${inserted.length} feature CTA post(s) as "${status}".`);

  if (DM) {
    const token = envVar("CHANNEL_BOT_TOKEN");
    const chat = envVar("APPROVER_CHAT_ID");
    const html = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/__([^_]+)__/g, "<i>$1</i>");
    for (let i = 0; i < inserted.length; i++) {
      const item = inserted[i];
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat, parse_mode: "HTML",
          text: `<b>Feature CTA ${i + 1}/${inserted.length} — ${clean[i].feature}</b>\n\n${html(item.body)}`,
          reply_markup: { inline_keyboard: [[
            { text: "✅ Approve", callback_data: `approve:${item.id}` },
            { text: "⏭ Skip", callback_data: `skip:${item.id}` },
          ]] },
        }),
      });
    }
    console.log(`✓ DM'd ${inserted.length} draft(s) for approval.`);
  }
}
main().catch((e) => { console.error("\n✗ seed-feature-ctas failed:", e.message); process.exit(1); });
