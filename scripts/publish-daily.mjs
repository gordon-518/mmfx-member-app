#!/usr/bin/env node
/**
 * MMFX Daily — publish one day's analysis into the member app.
 *
 * Uploads the cover (public) + report PDF (private) to Supabase Storage and
 * inserts one row into public.daily_analysis, so it appears LIVE on
 * app.marketmakersfx.net/daily-analysis with no deploy.
 *
 * Implements DAILY_ANALYSIS_PUBLISHING_SPEC.md (§6 uploads, §7 idempotency).
 * Service-role key is read from .env.local (or env). Never commit the key.
 *
 * Usage:
 *   node scripts/publish-daily.mjs --day day.json \
 *        [--cover thumb.png] [--report report.pdf] [--dry-run]
 *
 * If --cover/--report are omitted, they default to the MM Analyst folder
 * naming: MMFX_Thumbnail_<date>.png and MMFX_XAUUSD_Analysis_<date>.pdf.
 */
import fs from "node:fs";
import path from "node:path";

const REF = "dldrcitoeoxzfctsqlmo";
const PROJ = `https://${REF}.supabase.co`;
const ANALYST_DIR = "/Users/gordon/Documents/Claude/Projects/MM Analyst";

// ---- args ------------------------------------------------------------------
function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}
const DRY = !!arg("dry-run", false) || !!process.env.DRY_RUN;

// ---- service key (env or .env.local) --------------------------------------
function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const m = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m);
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  } catch {}
  return null;
}

function gumletId(url) {
  return String(url).split("/embed/").pop().split(/[?#]/)[0].trim();
}

async function upload(SERVICE, bucket, objPath, file, contentType) {
  const body = fs.readFileSync(file);
  const r = await fetch(`${PROJ}/storage/v1/object/${bucket}/${objPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": contentType, "x-upsert": "true" },
    body,
  });
  if (!r.ok) throw new Error(`${bucket} upload ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function main() {
  const dayPath = arg("day");
  if (!dayPath) throw new Error("--day <day.json> is required");
  const day = JSON.parse(fs.readFileSync(dayPath, "utf8"));
  const date = day.date;

  const coverFile = arg("cover", path.join(ANALYST_DIR, `MMFX_Thumbnail_${date}.png`));
  const reportFile = arg("report", path.join(ANALYST_DIR, `MMFX_XAUUSD_Analysis_${date}.pdf`));
  for (const [label, f] of [["cover", coverFile], ["report", reportFile]]) {
    if (!fs.existsSync(f)) throw new Error(`${label} file not found: ${f}`);
  }

  const coverPath = `cover-${date}.png`;
  const reportPath = `report-${date}.pdf`;
  const row = {
    published_on: date,
    title: `⚜️ XAUUSD Daily Analysis — ${day.title_date}`,
    gumlet_id: gumletId(day.gumlet_url),
    description: day.description,
    bias: String(day.bias).toLowerCase(),
    session_tag: day.session || "London",
    is_published: true,
    cover_path: coverPath,
    report_path: reportPath,
  };

  console.log(`\nMMFX publish — ${date}${DRY ? "  [DRY RUN]" : ""}`);
  console.log("  title      :", row.title);
  console.log("  bias       :", row.bias);
  console.log("  gumlet_id  :", row.gumlet_id);
  console.log("  cover       ->", `analysis-covers/${coverPath}`, `(${coverFile})`);
  console.log("  report      ->", `analysis-reports/${reportPath}`, `(${reportFile})`);
  console.log("  description:", (row.description || "").slice(0, 90) + "...");

  const SERVICE = serviceKey();
  if (DRY) {
    console.log("\n[DRY RUN] No uploads, no insert. Re-run without --dry-run to publish.");
    return;
  }
  if (!SERVICE) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing (env or .env.local).");

  const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

  // idempotency (§7) — does this date already exist?
  const existing = await (
    await fetch(`${PROJ}/rest/v1/daily_analysis?select=published_on&published_on=eq.${date}`, { headers: H })
  ).json();
  const exists = Array.isArray(existing) && existing.length > 0;

  // uploads (safe to re-run via x-upsert)
  await upload(SERVICE, "analysis-covers", coverPath, coverFile, "image/png");
  await upload(SERVICE, "analysis-reports", reportPath, reportFile, "application/pdf");
  console.log("  ✓ assets uploaded");

  if (exists) {
    console.log(`  ↻ ${date} row already exists — assets refreshed, insert skipped.`);
  } else {
    const ins = await fetch(`${PROJ}/rest/v1/daily_analysis`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!ins.ok) throw new Error(`insert ${ins.status}: ${(await ins.text()).slice(0, 300)}`);
    console.log("  ✓ row inserted");
  }
  console.log(`\n✓ Published ${date} — live on app.marketmakersfx.net/daily-analysis\n`);
}

main().catch((e) => {
  console.error("\n✗ publish failed:", e.message, "\n");
  process.exit(1);
});
