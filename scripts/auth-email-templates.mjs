// The two code emails Supabase Auth sends — sign-up and password reset — in
// the member's language. Supabase renders them as Go templates with the
// account's user_metadata as .Data, so one template carries all five languages
// and picks one by .Data.locale (saved at sign-up, by the language switcher,
// or by the proxy for a member who never picked one). No saved language gets
// the English, word for word what the project sends today.
//
// The words live in supabase/templates/auth-emails.json.
//
//   node scripts/auth-email-templates.mjs            # show what would change (nothing is sent)
//   node scripts/auth-email-templates.mjs --apply    # save the live templates (once), push these, read them back
//   node scripts/auth-email-templates.mjs --restore  # put back what --apply saved
//
// Talks to the Management API with SUPABASE_ACCESS_TOKEN from .env.local
// (never printed). Only the confirmation and recovery subject + body change.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const LOCALES = ["en", "zh-Hans", "zh-Hant", "ms", "id"];
export const KINDS = ["confirmation", "recovery"];
const FIELDS = KINDS.flatMap((k) => [`mailer_subjects_${k}`, `mailer_templates_${k}_content`]);

// printf "%v" makes the value a string whatever is stored there (a missing
// key, a number someone wrote into their own metadata), so `eq` can never
// fail and take the email down with it: anything unknown falls to English.
const PICK = '{{ $l := printf "%v" .Data.locale }}';

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** One Go template that renders `render(locale)` for the reader's locale, English otherwise. */
function chain(render) {
  const others = LOCALES.filter((l) => l !== "en")
    .map((l, i) => `{{ ${i ? "else if" : "if"} eq $l "${l}" }}${render(l)}`)
    .join("");
  return `${PICK}${others}{{ else }}${render("en")}{{ end }}`;
}

function body(w, locale) {
  const html =
    `<h2>${esc(w.heading)}</h2>\n` +
    `<p>${esc(w.body)}</p>\n` +
    `<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>\n` +
    `<p>${esc(w.expiry)}</p>`;
  // English stays byte-for-byte what is live; the others name their language.
  return locale === "en" ? html : `<div lang="${locale}">\n${html}\n</div>`;
}

/**
 * The four Management API fields, built from the words file.
 * @param {Record<string, Record<string, { subject: string; heading: string; body: string; expiry: string }>>} words
 * @returns {Record<string, string>}
 */
export function buildAuthTemplates(words) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const kind of KINDS) {
    out[`mailer_subjects_${kind}`] = chain((l) => words[kind][l].subject);
    out[`mailer_templates_${kind}_content`] = chain((l) => body(words[kind][l], l));
  }
  return out;
}

const ROOT = new URL("..", import.meta.url);
const WORDS = new URL("supabase/templates/auth-emails.json", ROOT);
const BACKUP = new URL("supabase/templates/auth-emails.backup.json", ROOT);

function env() {
  const raw = readFileSync(new URL(".env.local", ROOT), "utf8");
  return Object.fromEntries(
    raw.split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
  );
}

async function api(method, body) {
  const e = env();
  const ref = new URL(e.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method,
    headers: { Authorization: `Bearer ${e.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} config/auth: ${res.status} ${await res.text()}`);
  const cfg = await res.json();
  return Object.fromEntries(FIELDS.map((f) => [f, cfg[f]]));
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--restore") ? "restore" : "show";
  const live = await api("GET");

  if (mode === "restore") {
    if (!existsSync(BACKUP)) throw new Error("no backup: --apply writes one before it pushes anything");
    const saved = JSON.parse(readFileSync(BACKUP, "utf8"));
    const after = await api("PATCH", saved);
    const same = FIELDS.every((f) => after[f] === saved[f]);
    console.log(same ? "restored the saved templates" : "FAIL: the project doesn't match the backup");
    process.exit(same ? 0 : 1);
  }

  const built = buildAuthTemplates(JSON.parse(readFileSync(WORDS, "utf8")));
  for (const f of FIELDS) {
    console.log(`${live[f] === built[f] ? "same   " : "change "} ${f}  (${live[f]?.length ?? 0} -> ${built[f].length} chars)`);
  }
  if (mode === "show") {
    console.log("\nnothing sent. --apply to push (the live templates are saved first).");
    return;
  }

  // The first --apply keeps what was live before this script ever ran; a
  // second one must not replace that with the chain it pushed itself.
  if (existsSync(BACKUP)) {
    console.log(`\nkeeping the earlier backup at ${fileURLToPath(BACKUP)}`);
  } else {
    writeFileSync(BACKUP, JSON.stringify(live, null, 2) + "\n");
    console.log(`\nsaved the live templates to ${fileURLToPath(BACKUP)}`);
  }
  const after = await api("PATCH", built);
  const same = FIELDS.every((f) => after[f] === built[f]);
  console.log(same ? "pushed, and read back identical" : "FAIL: what the project returned differs from what was sent");
  process.exit(same ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("error:", e.message);
    process.exit(1);
  });
}
