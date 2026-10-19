// Shared env + Postgres helper for the one-off scripts.
//
//   import { loadEnv, pgClient } from "./lib/env.mjs";
//   const env = loadEnv();            // .env.local, or --env <file> / ENV_FILE
//   const client = pgClient(env);     // pg.Client on the IPv4 pooler
//
// Every tenant of the white-label desk is a different env file, so a script
// that reads its connection from here works against production
// (`node scripts/x.mjs`) and against a tenant (`node scripts/x.mjs --env
// .env.demo.local`) with no other change. Production's DATABASE_URL points at
// the direct host, which is IPv6-only from here, so the pooler host/user are
// taken from DB_POOLER_HOST / DB_POOLER_USER when set and fall back to
// production's known pooler otherwise.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const PROD_POOLER = {
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  user: "postgres.dldrcitoeoxzfctsqlmo",
};

/** The --env <file> argument, if any, stripped out of argv for the caller. */
export function envFileArg(argv = process.argv) {
  const i = argv.indexOf("--env");
  if (i >= 0 && argv[i + 1]) {
    const file = argv[i + 1];
    argv.splice(i, 2);
    return file;
  }
  return process.env.ENV_FILE || ".env.local";
}

export function loadEnv(file = envFileArg()) {
  const raw = readFileSync(resolve(process.cwd(), file), "utf8");
  const env = Object.fromEntries(
    raw
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
  env.__file = file;
  return env;
}

export function pgClient(env) {
  if (!env.DATABASE_URL) throw new Error(`DATABASE_URL missing in ${env.__file}`);
  const url = new URL(env.DATABASE_URL);
  return new pg.Client({
    host: env.DB_POOLER_HOST || PROD_POOLER.host,
    port: 5432,
    user: env.DB_POOLER_USER || PROD_POOLER.user,
    password: decodeURIComponent(url.password),
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
}
