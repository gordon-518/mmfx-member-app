import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FLOWS } from "./index";

// fn_claim_email_sends is where the §1.5 hard rule actually lives, so these
// are the guards that matter most in the whole rail. They run in Postgres,
// and this repo has no Postgres in CI — so this suite asserts on the
// migration's SOURCE: that each guard is present and spelled the way the
// route depends on, and that the step names in the SQL and in the TS registry
// have not drifted apart. It is a regression fence, not an execution test:
// the SQL itself still has to be exercised against a Supabase branch before
// EMAIL_LIFECYCLE_ENABLED is flipped on.

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE = readdirSync(DIR).find((f) => f.endsWith("_email_lifecycle.sql"));
const SQL = readFileSync(join(DIR, FILE!), "utf8");

/** The body of fn_claim_email_sends, so a guard elsewhere can't satisfy a test. */
const CLAIM_FN = SQL.slice(SQL.indexOf("create or replace function public.fn_claim_email_sends"));

function squish(s: string): string {
  return s.replace(/\s+/g, " ");
}

describe("email_lifecycle migration", () => {
  it("ships the three tables the rail needs", () => {
    for (const t of ["email_prefs", "email_sends", "email_spotlights"]) {
      expect(SQL).toContain(`create table if not exists public.${t} (`);
    }
  });

  it("makes dedupe_key the unique anti-double-send key", () => {
    expect(squish(SQL)).toContain("dedupe_key text not null unique");
    expect(squish(CLAIM_FN)).toContain("on conflict (dedupe_key) do nothing");
  });

  it("gives email_sends the ok/error columns the route stamps", () => {
    expect(squish(SQL)).toContain("ok boolean");
    expect(squish(SQL)).toContain("error text");
  });

  it("mirrors journal_email_prefs: own-row RLS and a unique unsub token", () => {
    expect(squish(SQL)).toContain("unsub_token text not null unique default gen_random_uuid()::text");
    expect(SQL).toContain("alter table public.email_prefs enable row level security;");
    expect(squish(SQL)).toContain("using (user_id = auth.uid()) with check (user_id = auth.uid())");
  });

  it("keeps email_sends and email_spotlights out of every browser's reach", () => {
    expect(SQL).toContain("alter table public.email_sends enable row level security;");
    expect(SQL).toContain("alter table public.email_spotlights enable row level security;");
    expect(SQL).not.toMatch(/create policy[^;]*on public\.email_sends/);
    expect(SQL).not.toMatch(/create policy[^;]*on public\.email_spotlights/);
  });
});

describe("fn_claim_email_sends guards", () => {
  it("guard 1 — skips anyone who opted out of marketing", () => {
    expect(squish(CLAIM_FN)).toContain("pr.marketing_opted_out = false");
  });

  it("guard 2 — skips anyone emailed in the last 24h, in ANY lane", () => {
    const body = squish(CLAIM_FN);
    expect(body).toContain(
      "not exists ( select 1 from public.email_sends s where s.user_id = p.id and s.sent_at > now() - interval '24 hours')"
    );
    // The journal's coaching emails share the cap — that's the point of §1.5.
    expect(body).toContain(
      "not exists ( select 1 from public.journal_interventions ji where ji.user_id = p.id and ji.sent_at > now() - interval '24 hours')"
    );
  });

  it("guard 3 — at most one row per user per run", () => {
    const body = squish(CLAIM_FN);
    expect(body).toContain("select distinct on (c.user_id) c.* from cand c");
    expect(body).toContain("order by c.user_id, c.priority");
  });

  it("never re-sends a step already in the log", () => {
    expect(squish(CLAIM_FN)).toContain(
      "where not exists (select 1 from public.email_sends s where s.dedupe_key = c.dedupe_key)"
    );
  });

  it("claims before sending: the insert stamps ok as null", () => {
    // ok/error are left to the route; the insert names neither column.
    expect(squish(CLAIM_FN)).toContain(
      "insert into public.email_sends as es (user_id, flow, step, dedupe_key)"
    );
  });

  it("serialises overlapping runs with an advisory lock", () => {
    expect(CLAIM_FN).toContain("pg_catalog.pg_advisory_xact_lock(");
  });

  it("is service_role only", () => {
    expect(squish(SQL)).toContain(
      "revoke all on function public.fn_claim_email_sends(integer, integer[], integer) from public, anon, authenticated;"
    );
    expect(squish(SQL)).toContain(
      "grant execute on function public.fn_claim_email_sends(integer, integer[], integer) to service_role;"
    );
  });

  it("takes DIGEST_DAYS and the spotlight day as parameters", () => {
    expect(squish(CLAIM_FN)).toContain("p_digest_days integer[] default array[1, 3, 5]");
    expect(squish(CLAIM_FN)).toContain("p_spotlight_day integer default 4");
    expect(squish(CLAIM_FN)).toContain("v_dow = any(p_digest_days)");
    expect(squish(CLAIM_FN)).toContain("v_dow = p_spotlight_day");
  });

  it("only offers digest and spotlight to the Free tier", () => {
    for (const step of ["'digest'", "'spotlight'"]) {
      const branch = CLAIM_FN.slice(CLAIM_FN.indexOf(`${step}::text`));
      expect(squish(branch.slice(0, 400))).toContain("b.audience = 'expired'");
    }
  });

  it("emits exactly the (flow, step) pairs the TS registry can render", () => {
    const inSql = new Set(
      [...CLAIM_FN.matchAll(/'([a-z]+)'::text[\s,]*(?:as flow,\s*)?'([a-z0-9-]+)'::text/g)].map(
        (m) => `${m[1]}/${m[2]}`
      )
    );
    const inTs = new Set(
      Object.entries(FLOWS).flatMap(([flow, steps]) => Object.keys(steps).map((s) => `${flow}/${s}`))
    );
    expect([...inSql].sort()).toEqual([...inTs].sort());
  });
});

describe("the pg_cron snippet", () => {
  it("documents the hourly email-lifecycle job with placeholders, not secrets", () => {
    expect(SQL).toContain("create extension if not exists pg_cron;");
    expect(SQL).toContain("create extension if not exists pg_net;");
    expect(SQL).toContain("'email-lifecycle',");
    expect(SQL).toContain("'0 * * * *',");
    expect(SQL).toContain("/api/cron/email-lifecycle");
    expect(SQL).toContain("Bearer CRON_SECRET_VALUE");
    // Nothing live is ever committed.
    expect(SQL).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/);
  });
});
