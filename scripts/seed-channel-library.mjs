#!/usr/bin/env node
/**
 * Seed public.content_library with a starter set of approved posts (with inline
 * button sets). Reads SUPABASE_SERVICE_ROLE_KEY from env or .env.local.
 * Skips if the library already has >= 6 approved rows.
 *
 * Usage: node scripts/seed-channel-library.mjs
 */
import fs from "node:fs";
import path from "node:path";

const REF = "dldrcitoeoxzfctsqlmo";
const PROJ = `https://${REF}.supabase.co`;

function envVar(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const m = env.match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  } catch {}
  return null;
}

const TRIAL = [{ text: "Start your free trial →", slug: "signup" }];
const READ = [{ text: "Today's gold read →", slug: "daily-analysis" }];
const TOOLS = [{ text: "See the indicators →", slug: "indicators" }];

const POSTS = [
  { kind: "educational", button_set: READ, body: "⚜️ **Discipline beats prediction.** __The market owes you nothing.__ A written plan turns a noisy chart into a checklist. Know your level, your invalidation, and your target before the candle opens. If price doesn't come to you, you don't chase it. **Structure over feelings. Process over profit.**" },
  { kind: "educational", button_set: READ, body: "⚜️ **Risk first, always.** Decide what you'll lose before you think about what you'll make. Size the position to the stop, not the dream. One clean 1:2 beats three revenge trades. __Protect the account and the account protects you.__" },
  { kind: "educational", button_set: TOOLS, body: "⚜️ **Your bias is a hypothesis, not a promise.** Higher-timeframe read sets direction; the lower timeframe only confirms the entry. No confirmation, no trade. Patience is a position." },
  { kind: "educational", button_set: READ, body: "⚜️ **Stop trading other people's opinions.** Social noise is not analysis. Trust your own marked levels and your own rules. The only voice that matters is the one aligned with your plan." },
  { kind: "cta", button_set: TRIAL, body: "⚜️ **The whole MM desk — free to try.** Course, indicators, daily gold analysis, and the signals channel, all in one login. 14 days, no card. See how we read XAUUSD." },
  { kind: "cta", button_set: TRIAL, body: "⚜️ **New to Market Makers?** Start with the daily gold read — bias, levels, and the reasoning behind them. Try the full desk free for 14 days. __Educational use only. Trading involves risk.__" },
];

async function main() {
  const SERVICE = envVar("SUPABASE_SERVICE_ROLE_KEY");
  if (!SERVICE) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing (env or .env.local).");
  const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

  const existing = await (
    await fetch(`${PROJ}/rest/v1/content_library?select=id&status=eq.approved`, { headers: H })
  ).json();
  if (Array.isArray(existing) && existing.length >= 6) {
    console.log(`Library already has ${existing.length} approved posts — skipping seed.`);
    return;
  }

  const rows = POSTS.map((p) => ({ ...p, status: "approved", source: "manual" }));
  const r = await fetch(`${PROJ}/rest/v1/content_library`, {
    method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`seed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  console.log(`✓ Seeded ${rows.length} approved library posts.`);
}
main().catch((e) => { console.error("✗ seed failed:", e.message); process.exit(1); });
