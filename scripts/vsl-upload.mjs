// Upload the feature videos (VSLs) to the public `vsl` bucket in Supabase
// storage, where this app and the marketing site both play them from
// (src/lib/vsl.ts). Creates the bucket the first time.
//
//   node scripts/vsl-upload.mjs <dir> [--version v2] [--dry-run] [--force]
//
// <dir> holds <key>-16x9.mp4 and <key>-4x5.mp4 for every key in VSL_KEYS. The
// web copies are cut from the 1080p masters with:
//   ffmpeg -nostdin -i MASTER -vf "scale=1920:1080:flags=lanczos"   (16:9)
//          or       -vf "scale=864:1080:flags=lanczos"   (4:5)
//     -c:v libx264 -preset slow -crf 26 -profile:v high -pix_fmt yuv420p
//     -c:a aac -b:a 128k -movflags +faststart OUT.mp4
// (faststart puts the index first, so playback starts before the download ends.)
//
// A re-cut goes to a new --version, and VERSION in src/lib/vsl.ts moves to it
// once the upload checks out: files are cached for a year, so a path is never
// reused for new content. An upload to a path that already holds a file stops
// rather than overwriting it; --force overwrites, for a version no member has
// been sent yet.
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

function fail(message) {
  console.error(message);
  process.exit(1);
}

// The keys and the version the app plays, read from the app itself so the two
// lists can't drift apart.
const lib = readFileSync(new URL("../src/lib/vsl.ts", import.meta.url), "utf8");
const keyList = lib.match(/VSL_KEYS = \[([^\]]+)\]/)?.[1];
const APP_VERSION = lib.match(/const VERSION = "([^"]+)"/)?.[1];
if (!keyList || !APP_VERSION) fail("couldn't read VSL_KEYS and VERSION from src/lib/vsl.ts");
const KEYS = [...keyList.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const CUTS = ["16x9", "4x5"];
const YEAR = 31536000;

const args = process.argv.slice(2);
const dir = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--version");
const version = args.includes("--version") ? args[args.indexOf("--version") + 1] : APP_VERSION;
const DRY = args.includes("--dry-run");
const FORCE = args.includes("--force");
if (!dir) fail("usage: node scripts/vsl-upload.mjs <dir> [--version v2] [--dry-run] [--force]");
if (!/^v\d+$/.test(version ?? "")) fail(`--version must look like v2, got ${version}`);

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local");
const base = url.replace(/\/+$/, "");
const auth = { apikey: key, Authorization: `Bearer ${key}` };

const files = KEYS.flatMap((k) => CUTS.map((cut) => ({ name: `${k}-${cut}.mp4`, path: join(dir, `${k}-${cut}.mp4`) })));
const missing = files.filter((f) => !existsSync(f.path));
if (missing.length) fail(`missing: ${missing.map((f) => f.name).join(", ")}`);

// Say where this is going before it goes: .env.local decides the project.
console.log(`target ${new URL(base).host}, bucket vsl, ${version}/ (the app plays ${APP_VERSION})${DRY ? ", dry run" : ""}`);

async function ensureBucket() {
  const got = await fetch(`${base}/storage/v1/bucket/vsl`, { headers: auth });
  if (got.ok) {
    const b = await got.json();
    console.log(`bucket vsl exists (public: ${b.public})`);
    if (!b.public) throw new Error("bucket vsl exists but isn't public");
    return;
  }
  if (DRY) return console.log("would create the public bucket vsl");
  const res = await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ id: "vsl", name: "vsl", public: true, file_size_limit: 30 * 1024 * 1024, allowed_mime_types: ["video/mp4"] }),
  });
  if (!res.ok) throw new Error(`create bucket: ${res.status} ${await res.text()}`);
  console.log("created the public bucket vsl");
}

async function upload(f) {
  const size = statSync(f.path).size;
  const path = `${version}/${f.name}`;
  if (DRY) return console.log(`would upload ${path} (${(size / 1048576).toFixed(1)} MB)`);
  const res = await fetch(`${base}/storage/v1/object/vsl/${path}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "video/mp4", "cache-control": `max-age=${YEAR}`, "x-upsert": String(FORCE) },
    body: readFileSync(f.path),
  });
  if (!res.ok) {
    const body = await res.text();
    if (/duplicate|already exists/i.test(body)) {
      throw new Error(`${path} is already uploaded. Browsers keep it for a year, so put a re-cut in a new --version (--force only for a version no member has played).`);
    }
    throw new Error(`${path}: ${res.status} ${body}`);
  }
  // Read it back the way a browser would: a public URL, a byte range.
  const check = await fetch(`${base}/storage/v1/object/public/vsl/${path}`, { headers: { Range: "bytes=0-1023" } });
  const type = check.headers.get("content-type");
  const total = Number((check.headers.get("content-range") ?? "").split("/")[1]);
  const ok = check.status === 206 && type === "video/mp4" && total === size;
  console.log(`${ok ? "ok  " : "FAIL"}  ${path}  ${(size / 1048576).toFixed(1)} MB  ${check.status} ${type}`);
  if (!ok) process.exitCode = 1;
}

await ensureBucket();
for (const f of files) await upload(f);
if (!DRY && version !== APP_VERSION && !process.exitCode) {
  console.log(`uploaded. Move VERSION in src/lib/vsl.ts to "${version}" to start playing these.`);
}
