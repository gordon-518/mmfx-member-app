// Configure a sponsor and print its private link ONCE.
//
//   node scripts/sponsor-setup.mjs octa --name "Octa" --brokers octa,elev8 --window MY:2026-11-01
//   node scripts/sponsor-setup.mjs octa --window ID:2026-12-01:2027-05-31     # add or correct a window
//   node scripts/sponsor-setup.mjs octa --rotate                              # new key; the old link dies
//
// The key is minted when the partner does not exist yet, or with --rotate.
// The link is printed and never stored: only its sha256 lives in the database.
import { readFileSync } from "node:fs";
import pg from "pg";

const [slug, ...rest] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]{2,24}$/.test(slug)) {
  console.error("usage: node scripts/sponsor-setup.mjs <slug> [--name N] [--brokers a,b] [--window CC:YYYY-MM-DD[:YYYY-MM-DD]]... [--rotate]");
  process.exit(2);
}
const opt = (flag) => { const i = rest.indexOf(flag); return i === -1 ? undefined : rest[i + 1]; };
const windows = rest.flatMap((a, i) => (a === "--window" && rest[i + 1] ? [rest[i + 1]] : []));
const name = opt("--name");
const brokers = opt("--brokers")?.split(",").map((s) => s.trim()).filter(Boolean);
const rotate = rest.includes("--rotate");

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://app.marketmakersfx.net").replace(/\/$/, "");
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres", ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query("begin");

  const exists = (await client.query("select name, kind from public.partners where slug = $1", [slug])).rows[0];
  let key = null;
  if (!exists || rotate) {
    key = (await client.query("select public.fn_partner_create($1, $2) k", [slug, name ?? exists?.name ?? slug])).rows[0].k;
  } else if (name) {
    await client.query("update public.partners set name = $2 where slug = $1", [slug, name]);
  }

  if (brokers?.length) {
    await client.query("select public.fn_sponsor_set($1, $2::text[])", [slug, brokers]);
  } else if (!exists || exists.kind !== "sponsor") {
    throw new Error("--brokers is required the first time (for example --brokers octa,elev8)");
  }

  for (const w of windows) {
    const [country, since, until] = w.split(":");
    if (!country || !since) throw new Error(`bad --window ${w}; expected CC:YYYY-MM-DD[:YYYY-MM-DD]`);
    await client.query(
      "select public.fn_sponsor_window_set($1, $2, $3::timestamptz, $4::timestamptz)",
      [slug, country.toUpperCase(), `${since}T00:00:00Z`, until ? `${until}T00:00:00Z` : null]
    );
  }

  await client.query("commit");

  const row = (await client.query(
    `select p.name, p.brokers,
            coalesce(json_agg(json_build_object('country', c.country, 'since', c.since, 'until', c.until) order by c.since)
                     filter (where c.slug is not null), '[]') as windows
       from public.partners p
       left join public.partner_countries c on c.slug = p.slug
      where p.slug = $1
      group by p.slug`,
    [slug]
  )).rows[0];
  console.log(`${row.name} (${slug}) · brokers ${(row.brokers ?? []).join(", ")}`);
  for (const w of row.windows) {
    console.log(`  ${w.country}  from ${String(w.since).slice(0, 10)}${w.until ? ` until ${String(w.until).slice(0, 10)}` : ""}`);
  }
  if (key) {
    console.log(`\nPrivate link — shown once, send it to the sponsor's contact:\n  ${appUrl}/partners/${slug}?key=${key}\n`);
  } else {
    console.log("\nKey unchanged. Add --rotate for a new link.");
  }
} catch (e) {
  try { await client.query("rollback"); } catch { /* not in a transaction */ }
  console.error("FAIL", e.message);
  process.exit(1);
} finally {
  await client.end();
}
