#!/usr/bin/env node
/**
 * MM Channel Bot — build the reusable visual library (Option A).
 *
 * Two modes:
 *   1) REGISTER existing images (CLI-agnostic, works today):
 *        node scripts/generate-visuals.mjs --register ./my-visuals   (file or dir of .png/.jpg)
 *
 *   2) GENERATE via your Higgsfield CLI, then register. Set a command template
 *      in env HIGGSFIELD_GEN_CMD using {prompt} and {out} placeholders, e.g.:
 *        HIGGSFIELD_GEN_CMD='higgsfield generate --prompt "{prompt}" --output "{out}"'
 *        node scripts/generate-visuals.mjs --generate --count 6
 *
 * Uploads each image to the channel-assets/visuals/ bucket path and inserts a
 * public.visual_library row. Skips generation if the active pool already has
 * >= --target (default 8). Reads SUPABASE_SERVICE_ROLE_KEY from env/.env.local.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

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

// On-brand prompts (no text baked into the image — the post copy carries the words).
const PROMPTS = [
  "Minimalist financial hero image, XAUUSD gold trading, deep navy background with teal accents, soft studio light, abstract candlestick glow, premium fintech, no text",
  "Close-up of a gold bar on dark reflective surface, teal rim light, cinematic, luxurious, editorial, no text",
  "Abstract upward market chart made of light, navy-to-teal gradient, calm and disciplined mood, premium, no text",
  "A single desk with a trading screen at dawn, warm light through blinds, focused calm atmosphere, muted navy palette, no text",
  "Macro shot of gold texture and subtle grid lines, dark elegant fintech branding, teal highlights, no text",
  "Minimal geometric emblem suggesting structure and discipline, navy + teal + gold, flat premium brand style, no text",
];

const SERVICE = envVar("SUPABASE_SERVICE_ROLE_KEY");
if (!SERVICE) { console.error("✗ SUPABASE_SERVICE_ROLE_KEY missing (env or .env.local)."); process.exit(1); }
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

async function activeCount() {
  const r = await fetch(`${PROJ}/rest/v1/visual_library?select=id&status=eq.active`, { headers: H });
  const rows = await r.json();
  return Array.isArray(rows) ? rows.length : 0;
}

async function uploadAndRegister(file, prompt = null, tag = "generic") {
  const name = `visuals/${path.basename(file).replace(/\s+/g, "_")}`;
  const ext = path.extname(file).toLowerCase();
  const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  const up = await fetch(`${PROJ}/storage/v1/object/channel-assets/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": contentType, "x-upsert": "true" },
    body: fs.readFileSync(file),
  });
  if (!up.ok) throw new Error(`upload ${up.status}: ${(await up.text()).slice(0, 160)}`);

  const image_url = `${PROJ}/storage/v1/object/public/channel-assets/${name}`;
  const ins = await fetch(`${PROJ}/rest/v1/visual_library`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ image_url, storage_path: name, prompt, tag, status: "active" }),
  });
  if (!ins.ok) throw new Error(`insert ${ins.status}: ${(await ins.text()).slice(0, 160)}`);
  console.log(`  ✓ registered ${name}`);
}

function listImages(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    return fs.readdirSync(target)
      .filter((f) => /\.(png|jpe?g)$/i.test(f))
      .map((f) => path.join(target, f));
  }
  return [target];
}

async function main() {
  const registerTarget = arg("register");
  if (registerTarget) {
    const files = listImages(registerTarget);
    if (!files.length) { console.log("No images found to register."); return; }
    for (const f of files) await uploadAndRegister(f);
    console.log(`\n✓ Registered ${files.length} visuals.`);
    return;
  }

  if (arg("generate")) {
    const cmdTemplate = envVar("HIGGSFIELD_GEN_CMD");
    if (!cmdTemplate) {
      console.error("✗ Set HIGGSFIELD_GEN_CMD, e.g.\n    HIGGSFIELD_GEN_CMD='higgsfield generate --prompt \"{prompt}\" --output \"{out}\"'");
      process.exit(1);
    }
    const target = Number(arg("target", 8));
    const have = await activeCount();
    if (have >= target) { console.log(`Pool already has ${have} active visuals (target ${target}) — nothing to do.`); return; }

    const want = Math.min(Number(arg("count", target - have)), PROMPTS.length);
    console.log(`Generating ${want} visuals via HIGGSFIELD_GEN_CMD...`);
    for (let i = 0; i < want; i++) {
      const prompt = PROMPTS[i % PROMPTS.length];
      const out = path.join(os.tmpdir(), `mmfx-visual-${i}-${process.pid}.png`);
      const cmd = cmdTemplate.replaceAll("{prompt}", prompt.replace(/"/g, '\\"')).replaceAll("{out}", out);
      console.log(`  → [${i + 1}/${want}] ${cmd}`);
      execSync(cmd, { stdio: "inherit" });
      if (!fs.existsSync(out)) throw new Error(`CLI did not produce ${out} — check the {out} placeholder in HIGGSFIELD_GEN_CMD`);
      await uploadAndRegister(out, prompt, "generic");
      fs.rmSync(out, { force: true });
    }
    console.log(`\n✓ Generated + registered ${want} visuals.`);
    return;
  }

  console.log("Usage:\n  --register <file|dir>            register existing images\n  --generate [--count N] [--target N]   generate via HIGGSFIELD_GEN_CMD then register");
}
main().catch((e) => { console.error("\n✗ generate-visuals failed:", e.message); process.exit(1); });
