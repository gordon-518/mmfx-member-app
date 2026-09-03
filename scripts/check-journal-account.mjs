import pg from "pg"; import fs from "node:fs";
const env = fs.readFileSync(".env.local", "utf8");
const pw = decodeURIComponent((env.match(/DATABASE_URL=postgresql:\/\/postgres:([^@]+)@/) || [])[1]);
const c = new pg.Client({ host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432, user: "postgres.dldrcitoeoxzfctsqlmo", password: pw, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const login = process.argv[2] || "2167136";
const { rows } = await c.query(
  `select ja.id, ja.mt5_login, ja.broker_id, ja.broker_server, ja.state, ja.state_detail,
          ja.ib_review, ja.metaapi_account_id, ja.sync_error, ja.connect_failures,
          ja.created_at, ja.disconnected_at, ja.last_synced_at,
          p.email, p.full_name, p.account_status, p.trading_account_number
     from public.journal_accounts ja
     join public.profiles p on p.id = ja.user_id
    where ja.mt5_login = $1 order by ja.created_at desc`, [login]);
console.log("ACCOUNT ROWS:\n", JSON.stringify(rows, null, 2));
const { rows: brokers } = await c.query(`select id, display_name, enforcement_mode, parse_config from public.ib_brokers order by id`);
console.log("\nBROKERS:\n", JSON.stringify(brokers, null, 2));
await c.end();
