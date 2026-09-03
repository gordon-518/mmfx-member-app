// Check whether a TradingView username actually has access to the MM scripts,
// using the stored tv_session cookie. Usage: node scripts/check-tv-access.mjs <tvusername>
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const pw = (env.match(/DATABASE_URL=postgresql:\/\/postgres:([^@]+)@/) || [])[1];
const password = decodeURIComponent(pw);
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo", password, database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const { rows } = await client.query(`select sessionid, sessionid_sign, updated_at from tv_session where id=1`);
await client.end();
if (!rows[0]) { console.error("no tv_session stored"); process.exit(1); }
console.log("session updated_at:", rows[0].updated_at);
const cookie = `sessionid=${rows[0].sessionid}; sessionid_sign=${rows[0].sessionid_sign}`;

const SCRIPTS = {
  "MM Squeeze Pulse": "PUB;41d2f3b7fae44c14bfab0d22bec0f505",
  "MM Wave Pressure": "PUB;7f434f4387434370836935be9c1819fa",
  "MM Structure Map": "PUB;572153158d8842aaa2396307167b76d7",
  "MM Echo Predictor": "PUB;b1018950d6bc4976b8f6825e68376ded",
  "MM Trend Rail": "PUB;b2de17981051404c8e8ade2a3ee6e72d",
  "MM Pivot Trend": "PUB;d23dd231cccf41c78bdcd724f6f75944",
  "MM MTF Minicharts": "PUB;70324481134b40d88fda8e7395b7bf86",
  "MM Auto Trendlines": "PUB;e50f629cc688408ab3cd6909d967e2cc",
  "MM Adaptive MA": "PUB;fa91f1ea10094377ba9f1202abe14183",
  "MM Reversion Bands": "PUB;bed766d1aeb74b31b3265c7feb622723",
  "MM AMA SuperTrend": "PUB;2ab95f2f25244bc6981df19f89f16b81",
  "MM System 5m Entry": "PUB;3ea622da843d4fb9ae41c30d8332f854",
};
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const target = (process.argv[2] || "SBunge").toLowerCase();

for (const [name, pine] of Object.entries(SCRIPTS)) {
  const body = new URLSearchParams({ pine_id: pine, username: target, limit: "10" }).toString();
  const res = await fetch("https://www.tradingview.com/pine_perm/list_users/?limit=10", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie, "User-Agent": UA, Referer: "https://www.tradingview.com/", Origin: "https://www.tradingview.com" },
    body,
  });
  const j = await res.json().catch(() => ({}));
  const users = j.results || [];
  const match = users.find((u) => (u.username || "").toLowerCase() === target);
  console.log(`${match ? "✅" : "❌"} ${name.padEnd(20)} status=${res.status} found=${match ? `${match.username} exp=${match.expiration ?? "never"}` : "NOT GRANTED"}`);
}
