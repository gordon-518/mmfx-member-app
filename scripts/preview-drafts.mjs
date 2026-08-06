#!/usr/bin/env node
/**
 * Push content_library items straight into the channel queue so they can be
 * reviewed as real posts (image + caption + buttons) before being approved
 * into the 4-hourly rotation.
 *
 *   node scripts/preview-drafts.mjs [--status draft] [--limit 20] [--dry-run]
 *
 * Visuals are assigned round-robin from visual_library so each preview looks
 * like a live post. Does NOT change the item's approval status — previewing is
 * not approving. Whatever CHANNEL_CHAT_ID points at is where these land.
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

const SERVICE = envVar("SUPABASE_SERVICE_ROLE_KEY");
if (!SERVICE) { console.error("✗ SUPABASE_SERVICE_ROLE_KEY missing."); process.exit(1); }
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

const DRY = !!arg("dry-run", false);
const status = arg("status", "draft");
const limit = Number(arg("limit", 20));
const source = arg("source", "manual");

const get = async (p) => (await fetch(`${PROJ}/rest/v1/${p}`, { headers: H })).json();

const items = await get(`content_library?select=id,kind,body,button_set&status=eq.${status}&source=eq.${source}&order=created_at.asc&limit=${limit}`);
if (!items.length) { console.log(`No "${status}" items to preview.`); process.exit(0); }

const visuals = await get("visual_library?select=id,image_url&status=eq.active&order=created_at.asc");
console.log(`\nPreviewing ${items.length} "${status}" item(s) with ${visuals.length} visual(s) in rotation${DRY ? "  [DRY RUN]" : ""}\n`);

const stamp = Date.now();
const rows = items.map((it, i) => ({
  kind: "library",
  status: "queued",
  body: it.body,
  button_set: it.button_set,
  image_url: visuals.length ? visuals[i % visuals.length].image_url : null,
  source_id: it.id,
  dedupe_key: `preview:${it.id}:${stamp}`,
  // Stagger so the dispatcher (5/run) sends them in order across runs.
  scheduled_for: new Date(stamp).toISOString(),
}));

for (const [i, r] of rows.entries()) {
  const label = (items[i].body.split("\n")[0] || "").replace(/[*_⚜️]/g, "").trim().slice(0, 52);
  console.log(`  ${String(i + 1).padStart(2)}. ${label}${r.image_url ? "  [+image]" : ""}`);
}

if (DRY) { console.log("\n[DRY RUN] nothing queued."); process.exit(0); }

const r = await fetch(`${PROJ}/rest/v1/channel_posts`, {
  method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(rows),
});
if (!r.ok) { console.error(`✗ enqueue ${r.status}: ${(await r.text()).slice(0, 200)}`); process.exit(1); }
console.log(`\n✓ Queued ${rows.length} preview post(s). The dispatcher will send them (5 per run).`);
