#!/usr/bin/env node
/**
 * MM Channel Bot — build the reusable visual library (Option A).
 *
 * The bot reuses these images across CTA posts (LRU rotation), so posting itself
 * spends zero generation credits. Generate in occasional batches.
 *
 * Two modes:
 *   1) REGISTER images you already have:
 *        node scripts/generate-visuals.mjs --register ./my-visuals    (file or dir)
 *
 *   2) GENERATE via the Higgsfield CLI (@higgsfield/cli), then register:
 *        higgsfield auth login          # once, if the session expired
 *        node scripts/generate-visuals.mjs --generate --count 4
 *
 *      The CLI returns a RESULT URL (not a file), so this runs
 *        higgsfield generate create <model> --prompt "..." --wait --json
 *      and downloads the URL from the response.
 *
 *      Options: --model <id> (default nano_banana_2) · --count N · --target N
 *               --dry-run  (print the commands without spending credits)
 *
 * Uploads each image to channel-assets/visuals/ and inserts a public.visual_library
 * row. Reads SUPABASE_SERVICE_ROLE_KEY from env or .env.local.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const REF = "dldrcitoeoxzfctsqlmo";
const PROJ = `https://${REF}.supabase.co`;
const DEFAULT_MODEL = "nano_banana_2";

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

// On-brand prompts. No text baked into the image — the post copy carries the words.
const PROMPTS = [
  "Minimalist financial hero image for a gold trading brand, deep navy background, teal accent light, abstract candlestick glow, premium fintech, cinematic studio lighting, no text, no words, no letters",
  "Close-up of a gold bar on a dark reflective surface, teal rim light, cinematic, luxurious, editorial product photography, no text, no words, no letters",
  "Abstract market structure chart rendered as flowing light, navy-to-teal gradient, calm disciplined mood, premium brand visual, no text, no words, no letters",
  "A single trading desk with a screen at dawn, warm light through blinds, focused calm atmosphere, muted navy palette, cinematic, no text, no words, no letters",
  "Macro shot of gold texture with subtle grid lines, dark elegant fintech branding, teal highlights, no text, no words, no letters",
  "Minimal geometric emblem suggesting structure and discipline, navy teal and gold palette, flat premium brand style, no text, no words, no letters",
];

const DRY = !!arg("dry-run", false);
const SERVICE = envVar("SUPABASE_SERVICE_ROLE_KEY");
if (!SERVICE && !DRY) { console.error("✗ SUPABASE_SERVICE_ROLE_KEY missing (env or .env.local)."); process.exit(1); }
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

async function activeCount() {
  const r = await fetch(`${PROJ}/rest/v1/visual_library?select=id&status=eq.active`, { headers: H });
  const rows = await r.json();
  return Array.isArray(rows) ? rows.length : 0;
}

/** Recursively collect http(s) URLs that look like generated media. */
function findUrls(node, out = []) {
  if (typeof node === "string") {
    if (/^https?:\/\//.test(node) && /\.(png|jpe?g|webp)(\?|$)/i.test(node)) out.push(node);
  } else if (Array.isArray(node)) {
    for (const v of node) findUrls(v, out);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) findUrls(v, out);
  }
  return out;
}

/** Run the CLI and pull the first result image URL out of its output. */
function generateOne(model, prompt) {
  const args = ["generate", "create", model, "--prompt", prompt, "--wait", "--json"];
  if (DRY) {
    console.log(`  [DRY] higgsfield ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
    return null;
  }

  const stdout = execFileSync("higgsfield", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

  let urls = [];
  try {
    urls = findUrls(JSON.parse(stdout));
  } catch {
    // Not clean JSON (progress lines mixed in) — try each line, then raw regex.
    for (const line of stdout.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("{") && !t.startsWith("[")) continue;
      try { urls.push(...findUrls(JSON.parse(t))); } catch {}
    }
    if (!urls.length) {
      urls = stdout.match(/https?:\/\/\S+?\.(?:png|jpe?g|webp)(?=[\s")]|$)/gi) || [];
    }
  }
  if (!urls.length) {
    throw new Error(`no image URL in CLI output. First 400 chars:\n${stdout.slice(0, 400)}`);
  }
  return urls[0];
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} for ${url.slice(0, 80)}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

// Telegram's sendPhoto-by-URL caps at 5 MB, and raw model output is often
// 6-8 MB at 2048px. Downscale to 1280px JPEG (q85) — well under the cap and
// far quicker to load in-app. Uses macOS `sips`; falls back to the original
// file if sips is unavailable.
function optimize(file) {
  if (/\.jpe?g$/i.test(file) && fs.statSync(file).size < 4_000_000) return file;
  const out = path.join(os.tmpdir(), `${path.basename(file, path.extname(file))}-opt.jpg`);
  try {
    execFileSync("sips", ["-Z", "1280", "-s", "format", "jpeg", "-s", "formatOptions", "85", file, "--out", out], {
      stdio: "ignore",
    });
    const before = (fs.statSync(file).size / 1024 / 1024).toFixed(1);
    const after = (fs.statSync(out).size / 1024).toFixed(0);
    console.log(`    optimized ${before} MB → ${after} KB`);
    return out;
  } catch {
    console.warn("    (sips unavailable — uploading original; may exceed Telegram's 5 MB URL limit)");
    return file;
  }
}

async function uploadAndRegister(srcFile, prompt = null, tag = "generic") {
  const file = optimize(srcFile);
  const base = path.basename(file).replace(/\s+/g, "_");
  const name = `visuals/${base}`;
  const ext = path.extname(file).toLowerCase();
  const contentType =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
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
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
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
    const model = arg("model", DEFAULT_MODEL);
    const target = Number(arg("target", 8));
    const have = DRY ? 0 : await activeCount();
    if (!DRY && have >= target) {
      console.log(`Pool already has ${have} active visuals (target ${target}) — nothing to do.`);
      return;
    }
    const want = Math.min(Number(arg("count", target - have)), PROMPTS.length);
    console.log(`Generating ${want} visual(s) with ${model}${DRY ? "  [DRY RUN]" : ""}...`);

    let ok = 0;
    for (let i = 0; i < want; i++) {
      const prompt = PROMPTS[i % PROMPTS.length];
      console.log(`\n[${i + 1}/${want}] ${prompt.slice(0, 70)}...`);
      try {
        const url = generateOne(model, prompt);
        if (DRY || !url) continue;
        const out = path.join(os.tmpdir(), `mmfx-visual-${Date.now()}-${i}.png`);
        await download(url, out);
        await uploadAndRegister(out, prompt, "generic");
        fs.rmSync(out, { force: true });
        ok++;
      } catch (e) {
        console.error(`  ✗ ${e.message.split("\n")[0]}`);
        if (/Session expired|auth login/i.test(e.message)) {
          console.error("\n→ Run `higgsfield auth login`, then re-run this script.");
          break;
        }
      }
    }
    if (!DRY) console.log(`\n✓ Added ${ok} visual(s) to the library.`);
    return;
  }

  console.log(
    "Usage:\n" +
    "  --register <file|dir>                 register existing images\n" +
    "  --generate [--count N] [--model ID]   generate via the Higgsfield CLI, then register\n" +
    "  --dry-run                             show the CLI commands without spending credits"
  );
}
main().catch((e) => { console.error("\n✗ generate-visuals failed:", e.message); process.exit(1); });
