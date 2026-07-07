// Verify + seed: generate a real AI coaching report for one user's seeded
// trades by calling Anthropic exactly the way src/lib/journal/coach.ts does,
// then insert it into journal_reports. Doubles as an end-to-end check that the
// ANTHROPIC_API_KEY + structured-output path work.
//
// Usage: node scripts/seed-journal-report.mjs [user-email]
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const email = process.argv[2] || "gordon@marketmakersfx.net";
const KEY = env.ANTHROPIC_API_KEY;
if (!KEY) throw new Error("ANTHROPIC_API_KEY missing from .env.local");

const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["ahead", "on_track", "behind", "at_risk"] },
    habits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["good", "bad"] },
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["kind", "title", "detail"],
        additionalProperties: false,
      },
    },
    tips: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "status", "habits", "tips"],
  additionalProperties: false,
};

function buildPrompt(rows, goals) {
  const closed = rows.filter((r) => r.status === "closed");
  const net = closed.reduce((s, r) => s + Number(r.net_profit), 0);
  const wins = closed.filter((r) => Number(r.net_profit) > 0);
  const grossWin = wins.reduce((s, r) => s + Number(r.net_profit), 0);
  const grossLoss = -closed
    .filter((r) => Number(r.net_profit) < 0)
    .reduce((s, r) => s + Number(r.net_profit), 0);
  const emotions = {};
  for (const r of closed) if (r.emotion) emotions[r.emotion] = (emotions[r.emotion] ?? 0) + 1;
  const bySymbol = {};
  for (const r of closed) {
    bySymbol[r.symbol] ??= { n: 0, net: 0 };
    bySymbol[r.symbol].n += 1;
    bySymbol[r.symbol].net += Number(r.net_profit);
  }
  const notes = closed
    .filter((r) => r.note || r.emotion)
    .slice(0, 15)
    .map(
      (r) =>
        `  • ${r.symbol} ${r.direction} net ${Number(r.net_profit).toFixed(0)}` +
        `${r.emotion ? ` · felt ${r.emotion}` : ""}${r.note ? ` · "${r.note}"` : ""}`
    )
    .join("\n");

  return [
    "You are an elite trading coach reviewing one trader's recent performance.",
    "Be direct and grounded ONLY in the data below — never invent numbers or trades.",
    "Judge habits against THEIR stated plan, not a generic ideal.",
    "",
    "THEIR GOALS:",
    `- Style: ${goals?.style ?? "n/a"} · monthly target ${goals?.monthly_target_pct ?? "n/a"}% · max DD ${goals?.max_drawdown_pct ?? "n/a"}% · risk/trade ${goals?.risk_per_trade_pct ?? "n/a"}%`,
    `- Instruments: ${goals?.instruments?.join(", ") ?? "n/a"}`,
    `- Working on: "${goals?.focus_text ?? "not stated"}"`,
    "",
    "PERFORMANCE (closed trades):",
    `- Net P&L: ${net.toFixed(0)} over ${closed.length} trades`,
    `- Win rate: ${Math.round((wins.length / closed.length) * 100)}% · profit factor: ${(grossWin / (grossLoss || 1)).toFixed(2)}`,
    `- By symbol: ${Object.entries(bySymbol)
      .map(([s, v]) => `${s} (${v.n} trades, net ${v.net.toFixed(0)})`)
      .join("; ")}`,
    `- Emotions logged: ${JSON.stringify(emotions)}`,
    "",
    notes ? `THEIR NOTES:\n${notes}` : "No notes logged.",
    "",
    "Return JSON: a 3-5 sentence `summary` (lead with the most important thing, reference goals),",
    "a `status` (ahead|on_track|behind|at_risk), 2-5 `habits` (good & bad, each grounded in a",
    "number or note above), and 2-4 actionable trade-management `tips`. No preamble.",
  ].join("\n");
}

async function main() {
  await client.connect();
  const { rows: users } = await client.query(
    "select id from auth.users where email=$1",
    [email]
  );
  if (!users.length) throw new Error(`No user for ${email}`);
  const userId = users[0].id;

  const { rows } = await client.query(
    "select symbol, direction, status, net_profit, volume, emotion, note from public.journal_trades where user_id=$1",
    [userId]
  );
  if (!rows.some((r) => r.status === "closed")) throw new Error("No closed trades to report on");
  const { rows: g } = await client.query(
    "select * from public.journal_goals where user_id=$1",
    [userId]
  );

  console.log(`Calling Anthropic (claude-haiku-4-5) for ${email}…`);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: buildPrompt(rows, g[0]) }],
      output_config: { format: { type: "json_schema", schema: REPORT_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const report = JSON.parse(text);

  const today = new Date().toISOString().slice(0, 10);
  await client.query(
    `insert into public.journal_reports
       (user_id, report_date, status, summary, habits, tips, model)
     values ($1,$2,$3,$4,$5,$6,'claude-haiku-4-5')
     on conflict (user_id, report_date) do update set
       status=excluded.status, summary=excluded.summary,
       habits=excluded.habits, tips=excluded.tips, model=excluded.model,
       created_at=now()`,
    [
      userId,
      today,
      report.status,
      report.summary,
      JSON.stringify(report.habits),
      JSON.stringify(report.tips),
    ]
  );

  console.log("\n✔ AI report generated and saved:\n");
  console.log(`STATUS: ${report.status}`);
  console.log(`SUMMARY: ${report.summary}\n`);
  console.log("HABITS:");
  for (const h of report.habits) console.log(`  [${h.kind}] ${h.title} — ${h.detail}`);
  console.log("\nTIPS:");
  for (const t of report.tips) console.log(`  → ${t}`);
}

main()
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
