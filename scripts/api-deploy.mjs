// Deploy the working tree to Vercel via the REST API (the sandbox can't run the
// Vercel CLI, but HTTPS works). Mirrors `vercel --prod`: uploads every
// non-git-ignored file (tracked + untracked), then creates a production
// deployment. Content-addressed uploads are deduped by Vercel.
import { execSync } from "node:child_process";
import { readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = "team_QyqQQdF00KHaGKW4r7eYzTx1";
const PROJECT = "prj_TC6MX20GQAUl4NSN5mFnelDQNL9C";
const TARGET = process.env.DEPLOY_TARGET || "production"; // or "" for preview
const ROOT = process.cwd();

if (!TOKEN) { console.error("VERCEL_TOKEN missing"); process.exit(1); }

// Files the CLI would upload: tracked + untracked, honoring .gitignore.
const list = execSync("git ls-files --cached --others --exclude-standard", { cwd: ROOT })
  .toString().split("\n").map((s) => s.trim()).filter(Boolean)
  .filter((f) => !f.startsWith(".vercel/") && !f.startsWith(".env") && !f.endsWith(".log"));

const files = [];
for (const rel of list) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs) || !statSync(abs).isFile()) continue; // skip deletions
  const data = readFileSync(abs);
  const sha = createHash("sha1").update(data).digest("hex");
  files.push({ file: rel, sha, size: data.length, data });
}
const totalMB = (files.reduce((a, f) => a + f.size, 0) / 1e6).toFixed(1);
console.log(`uploading ${files.length} files (${totalMB} MB)…`);

async function upload(f) {
  const r = await fetch(`https://api.vercel.com/v2/files?teamId=${TEAM}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/octet-stream",
      "x-vercel-digest": f.sha,
      "Content-Length": String(f.size),
    },
    body: f.data,
  });
  if (!r.ok && r.status !== 409) {
    throw new Error(`upload ${f.file} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
}

// Upload with limited concurrency.
let i = 0, done = 0;
async function worker() {
  while (i < files.length) {
    const f = files[i++];
    await upload(f);
    if (++done % 40 === 0) console.log(`  ${done}/${files.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log("uploads complete");

const body = {
  name: "mmfx-member-app",
  project: PROJECT,
  files: files.map((f) => ({ file: f.file, sha: f.sha, size: f.size })),
  ...(TARGET ? { target: TARGET } : {}),
};
const cr = await fetch(`https://api.vercel.com/v13/deployments?teamId=${TEAM}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const dep = await cr.json();
if (!cr.ok) { console.error("create deployment failed:", cr.status, JSON.stringify(dep).slice(0, 500)); process.exit(1); }
console.log(`deployment created: id=${dep.id} url=https://${dep.url} target=${TARGET || "preview"}`);
console.log(`inspect: https://vercel.com/${dep.ownerId || ""}`);

// Poll until terminal.
const id = dep.id;
for (let n = 0; n < 120; n++) {
  await new Promise((r) => setTimeout(r, 5000));
  const sr = await fetch(`https://api.vercel.com/v13/deployments/${id}?teamId=${TEAM}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const s = await sr.json();
  const state = s.readyState || s.status;
  process.stdout.write(`  [${n}] ${state}\n`);
  if (["READY", "ERROR", "CANCELED"].includes(state)) {
    console.log(`FINAL: ${state}  url=https://${s.url}  alias=${JSON.stringify(s.alias || [])}`);
    process.exit(state === "READY" ? 0 : 2);
  }
}
console.log("timed out polling");
