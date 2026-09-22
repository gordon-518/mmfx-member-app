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

  it("guard 2 — skips anyone emailed today (SGT), in ANY lane", () => {
    const body = squish(CLAIM_FN);
    expect(body).toContain(
      "not exists ( select 1 from public.email_sends s where s.user_id = p.id and s.sent_at >= v_day_start)"
    );
    // The journal's coaching emails share the cap — that's the point of §1.5.
    expect(body).toContain(
      "not exists ( select 1 from public.journal_interventions ji where ji.user_id = p.id and ji.sent_at >= v_day_start)"
    );
  });

  it("guard 2 also covers the deposit-dm-reminder lane", () => {
    expect(squish(CLAIM_FN)).toContain(
      "not exists ( select 1 from public.deposit_submissions ds where ds.user_id = p.id and ds.dm_reminder_sent_at >= v_day_start)"
    );
  });

  it("leaves admins out of the audience", () => {
    expect(squish(CLAIM_FN)).toContain("not coalesce(p.is_admin, false)");
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

  it("resolves OUT-column name clashes to the column (42702 in the rollback dry run)", () => {
    expect(CLAIM_FN).toContain("#variable_conflict use_column");
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
    expect(squish(CLAIM_FN)).toContain("p_digest_days integer[] default array[1, 2, 3, 4, 5]");
    expect(squish(CLAIM_FN)).toContain("p_spotlight_day integer default 6");
    expect(squish(CLAIM_FN)).toContain("v_dow = any(p_digest_days)");
    expect(squish(CLAIM_FN)).toContain("v_dow = p_spotlight_day");
  });

  it("unwinds claims stranded by a run that died mid-batch", () => {
    const body = squish(CLAIM_FN);
    expect(body).toContain(
      "delete from public.email_sends where ok is null and sent_at < now() - interval '1 hour'"
    );
  });

  it("reads only PUBLISHED analysis, within a day of today", () => {
    const da = CLAIM_FN.slice(CLAIM_FN.indexOf("with da as ("), CLAIM_FN.indexOf("ev as ("));
    expect(squish(da)).toContain("d.is_published");
    // published_on defaults to current_date in UTC while the desk is on SGT,
    // so an equality match drops the read for the first eight hours of the day.
    expect(squish(da)).not.toContain("d.published_on = v_today");
    expect(squish(da)).toContain("d.published_on <= v_today");
    expect(squish(da)).toContain("d.published_on >= v_today - 1");
  });

  it("only digests a read WRITTEN today (SGT): the desk publishes 12:00–19:00", () => {
    const da = CLAIM_FN.slice(CLAIM_FN.indexOf("with da as ("), CLAIM_FN.indexOf("ev as ("));
    expect(squish(da)).toContain("and d.created_at >= v_day_start");
  });

  it("caps one email per user per SGT CALENDAR day, not a rolling 24h", () => {
    const body = squish(CLAIM_FN);
    expect(body).toContain(
      "v_day_start timestamptz := (v_today::timestamp) at time zone 'Asia/Singapore'"
    );
    expect(body).not.toContain("sent_at > now() - interval '24 hours'");
    expect(body).not.toContain("dm_reminder_sent_at > now() - interval '24 hours'");
  });

  it("is scheduled every five minutes so a daily digest clears after publish", () => {
    expect(SQL).toContain("'*/5 * * * *'");
    expect(SQL).not.toContain("'0 * * * *'");
  });

  it("never sends rescue to anyone deposit-dm-reminder already owns", () => {
    // That flow owns everyone who filed a submission (§3C: never duplicate it).
    expect(squish(CLAIM_FN)).toContain(
      "exists (select 1 from public.deposit_submissions sub where sub.user_id = p.id) as has_submission"
    );
    for (const step of ["'broker-clicked'", "'upgrade-seen'"]) {
      const branch = CLAIM_FN.slice(CLAIM_FN.indexOf(`${step}::text`));
      expect(squish(branch.slice(0, 500)), step).toContain("not b.has_submission");
    }
  });

  it("counts only a DEPLOYED assistant as connected for member-d3", () => {
    const branch = CLAIM_FN.slice(CLAIM_FN.indexOf("'member-d3'::text"));
    expect(squish(branch.slice(0, 900))).toContain("ja.state = 'deployed'");
    expect(squish(branch.slice(0, 900))).not.toContain("ja.state <> 'disconnected'");
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
    expect(SQL).toContain("'*/5 * * * *',");
    expect(SQL).toContain("/api/cron/email-lifecycle");
    expect(SQL).toContain("Bearer CRON_SECRET_VALUE");
    // Nothing live is ever committed.
    expect(SQL).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/);
  });
});
