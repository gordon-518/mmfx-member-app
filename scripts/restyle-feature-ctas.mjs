#!/usr/bin/env node
/**
 * Restyle the feature CTA drafts: shorter lines, a blank line every 1-2
 * sentences, and light emoji accents — same word count, easier on the eye in
 * the Telegram feed. Matches existing DRAFT rows by their button slug and
 * updates the body in place (no duplicates created).
 *
 *   node scripts/restyle-feature-ctas.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";

const PROJ = "https://dldrcitoeoxzfctsqlmo.supabase.co";
const DRY = process.argv.includes("--dry-run");

function envVar(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const m = env.match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  } catch {}
  return null;
}

const BLOCKED = [
  /\bguarantee(?:d|s)?\b/i, /\bno[-\s]?loss\b/i, /\b47807426\b/,
  /\$?\d+\s*\/\s*lot\b/i, /\brebate(?:s)?\b/i, /\bIB\s*link\b/i,
];
const lint = (t) => BLOCKED.map((re) => (t.match(re) || [])[0]).filter(Boolean);

// Keyed by button slug — one per feature.
const BODIES = {
  course:
    "⚜️ **The MM System — start to finish.**\n\n" +
    "🎓 **19 lessons. 6 modules.**\n\n" +
    "Foundations → Reading Price → The Institutional Edge\n" +
    "Building Your Bias → The Entry Model → The Routine\n\n" +
    "You're not here to follow signals.\n" +
    "__You're here to run the method yourself.__\n\n" +
    "**Structure over feelings. Process over profit.**",

  library:
    "⚜️ **The whole system — on paper.**\n\n" +
    "📘 Four eBooks, led by __The MM System__.\n\n" +
    "Read them in the browser.\n" +
    "Or take them offline and mark them up.\n\n" +
    "The kind you re-read a year later — and find the part you weren't ready for the first time.",

  indicators:
    "⚜️ **Ten MM indicators. On your charts in a minute.**\n\n" +
    "🧰 Squeeze Pulse · Wave Pressure · Structure Map\n" +
    "Echo Predictor · Trend Rail · Pivot Trend\n" +
    "MTF Minicharts · Auto Trendlines · Adaptive MA · Reversion Bands\n\n" +
    "Drop in your TradingView name.\n" +
    "They appear — __no codes, no manual sharing.__",

  strategies:
    "⚜️ **Don't take our word for it. Backtest it.**\n\n" +
    "♟️ The entry model, as a TradingView strategy script.\n\n" +
    "Your own history.\n" +
    "Your own dates.\n" +
    "Your own settings.\n\n" +
    "__Test the method before you trust it.__\n" +
    "That's the whole point.",

  "daily-analysis":
    "⚜️ **Every session — the Gold read.**\n\n" +
    "📈 Bias. Levels.\n" +
    "And the part that actually matters — __the reasoning behind them.__\n\n" +
    "Daily → 4H → 1H → 15M, top-down.\n" +
    "With the PDF to keep.\n\n" +
    "You're not meant to copy it.\n" +
    "You're meant to learn to build it.",

  signals:
    "⚜️ **The levels we're watching — on the record.**\n\n" +
    "🎯 Entry. Stop. Target.\n" +
    "Minimum 1:2 R:R.\n\n" +
    "London and New York sessions.\n" +
    "Weekly recap, so nothing quietly disappears.\n\n" +
    "__Educational use only. Trading involves risk.__",

  "live-classes":
    "⚜️ **Twice a week — live on the charts.**\n\n" +
    "🎥 Not a replay.\n" +
    "The desk reading price in real time.\n\n" +
    "You see the hesitation.\n" +
    "The invalidation.\n" +
    "The trade that __didn't__ qualify.\n\n" +
    "That's where the method finally clicks.",

  calendar:
    "⚜️ **Know what's about to move Gold.**\n\n" +
    "📅 High and medium-impact releases.\n" +
    "Week by week, filterable by currency.\n\n" +
    "Most bad trades aren't bad analysis.\n" +
    "__They're good analysis at the wrong minute.__",

  news:
    "⚜️ **The macro tape — filtered to what you trade.**\n\n" +
    "📰 Sentiment-tagged headlines across 19 instruments.\n\n" +
    "The context behind the candle.\n" +
    "Without the doomscroll.\n\n" +
    "__Context informs bias. It never replaces your entry rules.__",

  fundamental:
    "⚜️ **Ask the desk why Gold is moving.**\n\n" +
    "🧠 An AI fundamental desk on the live macro picture driving XAU/USD.\n\n" +
    "Rates. Dollar. Real yields. Central-bank demand.\n\n" +
    "It emails you the thesis as a PDF.\n\n" +
    "__Understand the why — not just the where.__",

  "know-your-style":
    "⚜️ **What kind of trader are you actually?**\n\n" +
    "🧭 Two minutes.\n" +
    "An honest read on your archetype.\n\n" +
    "And the setups that suit how you're actually wired — not how you wish you were.\n\n" +
    "__Most blown accounts are a style mismatch, not a strategy problem.__",

  signup:
    "⚜️ **The whole desk. Free for 14 days.**\n\n" +
    "✅ Course · 10 indicators · strategies · eBooks\n" +
    "✅ Daily Gold analysis · live classes · calendar\n" +
    "✅ Two AI tools\n\n" +
    "__One login. No card.__\n\n" +
    "Use it for two weeks.\n" +
    "Decide with evidence.",
};

const SERVICE = envVar("SUPABASE_SERVICE_ROLE_KEY");
if (!SERVICE) { console.error("✗ SUPABASE_SERVICE_ROLE_KEY missing."); process.exit(1); }
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

// source=manual only. The replenish cron also writes drafts (source=claude);
// those are distinct AI copy and must not be overwritten with feature blurbs.
const rows = await (await fetch(
  `${PROJ}/rest/v1/content_library?select=id,body,button_set,source&status=eq.draft&source=eq.manual&order=created_at.asc`,
  { headers: H }
)).json();

console.log(`\nRestyling ${rows.length} draft(s)${DRY ? "  [DRY RUN]" : ""}\n`);

let done = 0, missed = [];
for (const row of rows) {
  const slug = row.button_set?.[0]?.slug;
  const body = BODIES[slug];
  if (!body) { missed.push(slug || "(no button)"); continue; }

  const hits = lint(body);
  if (hits.length) { console.log(`  ✗ ${slug}: BLOCKED → ${hits.join(", ")}`); continue; }

  const beforeWords = row.body.split(/\s+/).length;
  const afterWords = body.split(/\s+/).length;
  const beforeLines = row.body.split("\n").length;
  const afterLines = body.split("\n").length;
  console.log(`  ✓ ${slug.padEnd(16)} words ${beforeWords}→${afterWords}   lines ${beforeLines}→${afterLines}`);

  if (!DRY) {
    const r = await fetch(`${PROJ}/rest/v1/content_library?id=eq.${row.id}`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ body, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) { console.error(`    ✗ update ${r.status}: ${(await r.text()).slice(0, 120)}`); continue; }
  }
  done++;
}

if (missed.length) console.log(`\n  (no restyle defined for: ${missed.join(", ")})`);
console.log(DRY ? `\n[DRY RUN] ${done} would be updated.` : `\n✓ Restyled ${done} draft(s).`);
