import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The partner-attribution migration (design doc 2026-09-25 §2) in the style of
// claim.test.ts / measurement.test.ts: this repo has no Postgres in CI, so the
// suite asserts on the migration's SOURCE — that every table, column, guard
// and grant the app and the dashboard depend on is present and spelled the way
// they read it. A regression fence, not an execution test; the SQL still has
// to be exercised against a Supabase branch (rollback dry run) before it is
// applied to production.

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE = readdirSync(DIR).find((f) => f.endsWith("_partner_attribution.sql"));
const SQL = readFileSync(join(DIR, FILE!), "utf8");

function squish(s: string): string {
  return s.replace(/\s+/g, " ");
}

/** One function's body, so a match elsewhere in the file can't satisfy a test. */
function fn(name: string): string {
  // The "(" matters: fn_log_event would otherwise match fn_log_event_as.
  const start = SQL.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} is not in the migration`).toBeGreaterThan(-1);
  const end = SQL.indexOf("\n$$;", start);
  return SQL.slice(start, end === -1 ? undefined : end);
}

const TOUCH_FN = fn("fn_record_touch");
const CREATE_FN = fn("fn_partner_create");
const FUNNEL_FN = fn("fn_partner_funnel");
const INSERT_FN = fn("fn_app_event_insert");
const SIGNUP_FN = fn("fn_set_signup_attribution");

describe("partner_attribution migration", () => {
  it("exists, dated after the measurement rail it extends", () => {
    expect(FILE).toBe("20260925000001_partner_attribution.sql");
  });

  it("creates attribution_touches with the columns the touch log needs", () => {
    const s = squish(SQL);
    expect(s).toContain("create table if not exists public.attribution_touches (");
    expect(s).toContain("id bigint generated always as identity primary key");
    expect(s).toContain("user_id uuid references public.profiles(id) on delete cascade");
    expect(s).toContain("anon_id text");
    expect(s).toContain("cid text not null");
    expect(s).toContain("geo text");
    expect(s).toContain("source text not null check (source in ('AGY','CRT','ORG','EML','other'))");
    expect(s).toContain("landed_at timestamptz not null default now()");
    expect(s).toContain("path text");
  });

  it("indexes the touch log the way the funnel reads it", () => {
    expect(squish(SQL)).toContain(
      "create index if not exists attribution_touches_user_idx on public.attribution_touches (user_id, landed_at desc)"
    );
  });

  it("keeps the touch log and partners out of every browser's reach", () => {
    expect(SQL).toContain("alter table public.attribution_touches enable row level security;");
    expect(SQL).toContain("alter table public.partners enable row level security;");
    // RLS with no policies: service_role bypasses, everyone else sees nothing.
    expect(SQL).not.toMatch(/create policy[^;]*on public\.attribution_touches/);
    expect(SQL).not.toMatch(/create policy[^;]*on public\.partners/);
  });

  it("adds the latest-touch columns and stamps them from a trigger", () => {
    const s = squish(SQL);
    expect(s).toContain("add column if not exists attr_last_cid text");
    expect(s).toContain("add column if not exists attr_last_at timestamptz");
    expect(s).toContain("create or replace trigger attribution_touches_stamp");
    expect(s).toContain("after insert on public.attribution_touches");
    // Never walks a later touch backwards.
    expect(squish(fn("fn_stamp_attr_last"))).toContain(
      "p.attr_last_at is null or p.attr_last_at <= new.landed_at"
    );
  });
});

describe("fn_record_touch", () => {
  it("derives the source from the cid prefix", () => {
    const s = squish(TOUCH_FN);
    expect(s).toContain("when v_cid like 'AGY-%' then 'AGY'");
    expect(s).toContain("when v_cid like 'CRT-%' then 'CRT'");
    expect(s).toContain("when v_cid like 'ORG-%' then 'ORG'");
    expect(s).toContain("when v_cid like 'EML-%' then 'EML'");
    expect(s).toContain("else 'other'");
  });

  it("trims the cid to 120 characters and drops anything malformed", () => {
    const s = squish(TOUCH_FN);
    expect(s).toContain("left(btrim(coalesce(p_cid, '')), 120)");
    expect(s).toContain("if v_cid !~ '^[A-Za-z0-9._%~ -]{1,120}$' then return; end if;");
  });

  it("is a service-role door only", () => {
    const s = squish(SQL);
    expect(s).toContain(
      "revoke all on function public.fn_record_touch(uuid, text, text, text, text) from public, anon, authenticated"
    );
    expect(s).toContain(
      "grant execute on function public.fn_record_touch(uuid, text, text, text, text) to service_role"
    );
  });
});

describe("partners + fn_partner_create", () => {
  it("creates partners with a slug check, a key hash and the report address", () => {
    const s = squish(SQL);
    expect(s).toContain("create table if not exists public.partners (");
    expect(s).toContain("slug text primary key check (slug ~ '^[a-z0-9]{2,24}$')");
    expect(s).toContain("key_hash text not null");
    expect(s).toContain("active boolean not null default true");
    expect(s).toContain("report_email text");
  });

  it("refuses a hyphen in the slug — AGY-<slug>-<label> must split one way", () => {
    // The label half is a Meta ad name and carries hyphens freely. A
    // hyphenated slug would make "who gets paid" ambiguous, so the brain's
    // parser and the site's /a/<slug> route refuse one too.
    expect(SQL).not.toContain("[a-z0-9-]{2,24}");
    expect(squish(SQL)).toContain("slug text primary key check (slug ~ '^[a-z0-9]{2,24}$')");
  });

  it("mints a 32-byte key and stores only its sha256", () => {
    const s = squish(CREATE_FN);
    // Core functions only: no pgcrypto in this project, and search_path = ''.
    expect(s).toContain("pg_catalog.gen_random_uuid()");
    expect(s).toContain("encode(pg_catalog.sha256(v_key::bytea), 'hex')");
    expect(s).not.toContain("gen_random_bytes");
  });

  it("returns the raw key and is service-role only", () => {
    expect(squish(CREATE_FN)).toContain("return v_key");
    const s = squish(SQL);
    expect(s).toContain(
      "revoke all on function public.fn_partner_create(text, text) from public, anon, authenticated"
    );
    expect(s).toContain(
      "grant execute on function public.fn_partner_create(text, text) to service_role"
    );
  });
});

describe("fn_partner_funnel", () => {
  it("returns the eight columns the dashboard and the CSV read", () => {
    const s = squish(FUNNEL_FN);
    expect(s).toContain(
      "returns table ( week date, label text, signups int, activated int, funded int, deposit_total numeric, first_touch_signups int, first_touch_funded int )"
    );
    expect(s).toContain("p_rule text default 'last_paid_7d'");
  });

  it("declares the variable_conflict pragma a RETURNS TABLE plpgsql body needs", () => {
    expect(FUNNEL_FN).toContain("#variable_conflict use_column");
  });

  it("only ever looks at cids carrying this partner's prefix", () => {
    const s = squish(FUNNEL_FN);
    expect(s).toContain("v_prefix := 'AGY-' || v_slug || '-'");
    expect(s).toContain("if v_slug !~ '^[a-z0-9]{2,24}$'");
  });

  it("implements both rules: first touch and last paid touch within 7 days", () => {
    const s = squish(FUNNEL_FN);
    expect(s).toContain("when lower(btrim(coalesce(p_rule, ''))) = 'first' then 'first'");
    expect(s).toContain("t.source in ('AGY', 'CRT')");
    // Signups anchor on signup_at, funded clients on the verified deposit.
    expect(s).toContain("t.landed_at >= c.signup_at - interval '7 days'");
    expect(s).toContain("t.landed_at >= c.deposit_verified_at - interval '7 days'");
  });

  it("counts the four activation signals from §2.5", () => {
    const s = squish(FUNNEL_FN);
    expect(s).toContain("c.tradingview_username is not null");
    expect(s).toContain("c.kys_completed_at is not null");
    expect(s).toContain("e.props ->> 'feature' = 'daily-analysis'");
    expect(s).toContain("e.event = 'onboarding_step_done'");
  });

  it("counts verified deposits only", () => {
    expect(squish(FUNNEL_FN)).toContain("c.deposit_verified_at is not null");
  });

  it("never selects a name, an email, an IB id or a rate", () => {
    // The partner sees funnel counts. Anything else is a leak (§2.5).
    expect(FUNNEL_FN).not.toMatch(/\bpr?\.(email|full_name|first_name|ib_|broker_account)/);
    expect(FUNNEL_FN).not.toMatch(/select[^;]*\bemail\b/i);
  });

  it("is service-role only", () => {
    const s = squish(SQL);
    expect(s).toContain(
      "revoke all on function public.fn_partner_funnel(text, timestamptz, timestamptz, text) from public, anon, authenticated"
    );
    expect(s).toContain(
      "grant execute on function public.fn_partner_funnel(text, timestamptz, timestamptz, text) to service_role"
    );
  });
});

describe("app_events allowlist", () => {
  it("adds cid_visit and keeps every name already on the list", () => {
    const s = squish(INSERT_FN);
    for (const e of [
      "'feature_view'",
      "'tv_username_set'",
      "'upgrade_viewed'",
      "'upgrade_broker_link_clicked'",
      "'upgrade_contact_clicked'",
      "'deposit_verified'",
      "'tier_changed'",
      "'onboarding_step_done'",
      "'deposit_submitted'",
      "'email_visit'",
      "'cid_visit'",
    ]) {
      expect(s).toContain(e);
    }
  });

  it("dedupes a cid_visit per cid per day, like email_visit", () => {
    expect(squish(INSERT_FN)).toContain(
      "if p_event in ('email_visit', 'cid_visit') and exists ("
    );
  });

  it("does NOT let a browser forge a cid_visit", () => {
    const client = fn("fn_log_event");
    expect(client).not.toContain("cid_visit");
    expect(squish(client)).toContain(
      "'upgrade_broker_link_clicked', 'upgrade_contact_clicked', 'onboarding_step_done'"
    );
  });
});

describe("fn_set_signup_attribution", () => {
  it("accepts the AGY- cid shape (ad names carry spaces and run past 64 chars)", () => {
    const s = squish(SIGNUP_FN);
    expect(s).toContain("left(btrim(p_cid), 120)");
    expect(s).toContain("if cid is not null and cid !~ '^[A-Za-z0-9._%~ -]{1,120}$' then cid := null");
  });

  it("still writes first touch only, within 24h of signup", () => {
    const s = squish(SIGNUP_FN);
    expect(s).toContain("and p.attr_cid is null");
    expect(s).toContain("and p.signup_at > now() - interval '24 hours'");
  });
});

describe("organic_signups_by_cid", () => {
  it("widens to AGY- so the brain's weekly report sees partner rows", () => {
    const s = squish(SQL);
    expect(s).toContain(
      "attr_cid like 'ORG-%' or attr_cid like 'EML-%' or attr_cid like 'AGY-%'"
    );
    expect(s).toContain("returns table (cid text, signups bigint, deposits bigint)");
  });
});

describe("ops comment", () => {
  it("carries the partner-weekly pg_cron snippet Gordon runs by hand", () => {
    expect(SQL).toContain("cron.schedule(");
    expect(SQL).toContain("'partner-weekly'");
    expect(SQL).toContain("'0 1 * * 1'");
    expect(SQL).toContain("/api/cron/partner-weekly");
    expect(SQL).toContain("timeout_milliseconds := 290000");
    // The secret and the app URL stay out of the repo: placeholders only.
    expect(SQL).toContain("Bearer CRON_SECRET_VALUE");
    expect(SQL).toContain("https://APP_URL/api/cron/partner-weekly");
  });
});
