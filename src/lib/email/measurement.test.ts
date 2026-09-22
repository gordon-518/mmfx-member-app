import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FLOWS } from "./lifecycle/index";

// The measurement migration (design doc 2026-09-22 §4) in the same style as
// claim.test.ts: this repo has no Postgres in CI, so the suite asserts on the
// migration's SOURCE — that every table, column, guard and goal the routes and
// the brain depend on is present and spelled the way they read it. It is a
// regression fence, not an execution test; the SQL still has to be exercised
// against a Supabase branch before EMAIL_LIFECYCLE_ENABLED is flipped on.

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE = readdirSync(DIR).find((f) => f.endsWith("_email_measurement.sql"));
const SQL = readFileSync(join(DIR, FILE!), "utf8");

function squish(s: string): string {
  return s.replace(/\s+/g, " ");
}

/** One function's body, so a match elsewhere in the file can't satisfy a test. */
function fn(name: string): string {
  const start = SQL.indexOf(`create or replace function public.${name}`);
  expect(start, `${name} is not in the migration`).toBeGreaterThan(-1);
  const end = SQL.indexOf("\n$$;", start);
  return SQL.slice(start, end === -1 ? undefined : end);
}

const CLAIM_FN = fn("fn_claim_email_sends");
const KPI_FN = fn("fn_email_kpis");
const INSERT_FN = fn("fn_app_event_insert");

describe("email_measurement migration", () => {
  it("exists, dated after the lifecycle rail it extends", () => {
    expect(FILE).toBe("20260922000001_email_measurement.sql");
  });

  it("widens email_sends with the provider id, the arm and the subject", () => {
    const s = squish(SQL);
    expect(s).toContain("alter table public.email_sends add column if not exists provider_id text");
    expect(s).toContain("add column if not exists variant text not null default 'A'");
    expect(s).toContain("add column if not exists subject text");
    expect(s).toContain(
      "create index if not exists email_sends_provider_idx on public.email_sends(provider_id)"
    );
  });

  it("creates email_events with the nine SendPulse events and an idempotency key", () => {
    const s = squish(SQL);
    expect(s).toContain("create table if not exists public.email_events (");
    expect(s).toContain(
      "event text not null check (event in ('delivered','undelivered','opened','clicked','spam','unsubscribed','resubscribed','hard_bounce','soft_bounce'))"
    );
    expect(s).toContain("send_id uuid references public.email_sends(id) on delete set null");
    expect(s).toContain("occurred_at timestamptz not null");
    expect(s).toContain("raw jsonb not null default '{}'::jsonb");
    // The webhook re-posts on retry; this is what makes a duplicate a no-op.
    expect(s).toContain("unique (provider_id, event, occurred_at)");
    expect(s).toContain(
      "create index if not exists email_events_send_idx on public.email_events(send_id, event)"
    );
  });

  it("creates email_variants with the weight range and one row per arm", () => {
    const s = squish(SQL);
    expect(s).toContain("create table if not exists public.email_variants (");
    expect(s).toContain("copy jsonb not null");
    expect(s).toContain("weight int not null default 50 check (weight between 0 and 100)");
    expect(s).toContain("active boolean not null default true");
    expect(s).toContain("created_by text not null default 'brain'");
    expect(s).toContain("unique (flow, step, variant_key)");
  });

  it("keeps all three out of every browser's reach", () => {
    for (const t of ["email_events", "email_variants"]) {
      expect(SQL).toContain(`alter table public.${t} enable row level security;`);
      expect(SQL).not.toMatch(new RegExp(`create policy[^;]*on public\\.${t}`));
    }
  });
});

describe("fn_claim_email_sends — the two additions", () => {
  it("drops before it re-creates: RETURNS TABLE gained two columns", () => {
    // create or replace cannot widen a function's return type.
    expect(squish(SQL)).toContain(
      "drop function if exists public.fn_claim_email_sends(integer, integer[], integer)"
    );
    expect(SQL.indexOf("drop function if exists public.fn_claim_email_sends")).toBeLessThan(
      SQL.indexOf("create or replace function public.fn_claim_email_sends")
    );
  });

  it("returns the arm and the cover path", () => {
    const s = squish(CLAIM_FN);
    expect(s).toContain("variant text");
    expect(s).toContain("cover_path text");
  });

  it("assigns the arm by a stable hash of the user and the step", () => {
    const s = squish(CLAIM_FN);
    expect(s).toContain("abs(pg_catalog.hashtext(k.user_id::text || ':' || k.step)) % 100 < ev.weight");
    expect(s).toContain("coalesce(v.variant_key, 'A')");
    // Only live arms compete.
    expect(s).toContain("ev.active");
    expect(s).toContain("ev.retired_at is null");
  });

  it("reads the cover off the same published row the digest already reads", () => {
    const da = CLAIM_FN.slice(CLAIM_FN.indexOf("with da as ("), CLAIM_FN.indexOf("ev as ("));
    expect(squish(da)).toContain("select d.title, d.bias, d.description, d.cover_path");
    expect(squish(da)).toContain("d.is_published");
    expect(squish(da)).toContain("and d.created_at >= v_day_start");
  });

  it("keeps every guard the rail depends on", () => {
    const s = squish(CLAIM_FN);
    expect(s).toContain("pr.marketing_opted_out = false");
    expect(s).toContain(
      "not exists ( select 1 from public.email_sends s where s.user_id = p.id and s.sent_at >= v_day_start)"
    );
    expect(s).toContain(
      "not exists ( select 1 from public.journal_interventions ji where ji.user_id = p.id and ji.sent_at >= v_day_start)"
    );
    expect(s).toContain(
      "not exists ( select 1 from public.deposit_submissions ds where ds.user_id = p.id and ds.dm_reminder_sent_at >= v_day_start)"
    );
    expect(s).toContain("not coalesce(p.is_admin, false)");
    expect(s).toContain("select distinct on (c.user_id) c.* from cand c");
    expect(s).toContain(
      "where not exists (select 1 from public.email_sends s where s.dedupe_key = c.dedupe_key)"
    );
    expect(s).toContain("on conflict (dedupe_key) do nothing");
  });

  it("keeps the reaper and the advisory lock", () => {
    const s = squish(CLAIM_FN);
    expect(s).toContain(
      "delete from public.email_sends where ok is null and sent_at < now() - interval '1 hour'"
    );
    expect(CLAIM_FN).toContain("pg_catalog.pg_advisory_xact_lock(");
  });

  it("still emits exactly the (flow, step) pairs the TS registry can render", () => {
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

  it("is still service_role only after the drop", () => {
    const s = squish(SQL);
    expect(s).toContain(
      "revoke all on function public.fn_claim_email_sends(integer, integer[], integer) from public, anon, authenticated;"
    );
    expect(s).toContain(
      "grant execute on function public.fn_claim_email_sends(integer, integer[], integer) to service_role;"
    );
  });
});

describe("fn_email_kpis", () => {
  it("takes the window and returns one row per (flow, step, variant)", () => {
    const s = squish(KPI_FN);
    expect(s).toContain("fn_email_kpis( p_since timestamptz");
    expect(s).toContain("p_until timestamptz");
    for (const col of [
      "flow text",
      "step text",
      "variant text",
      "sends int",
      "delivered int",
      "opened int",
      "clicked int",
      "visited int",
      "goal_done int",
      "unsubscribed int",
      "complaints int",
      "bounced int",
      "open_p50_min numeric",
      "click_p50_min numeric",
    ]) {
      expect(s, col).toContain(col);
    }
  });

  it("counts DISTINCT sends per event, not raw events", () => {
    // A send opened five times by Apple's pre-fetcher is one open.
    const s = squish(KPI_FN);
    expect(s).toContain("group by e.send_id, e.event");
    expect(s).toContain("count(*) filter (where p.opened)::int");
    expect(s).toContain("count(*) filter (where p.clicked)::int");
  });

  it("measures latency in minutes from the send, as a median", () => {
    const s = squish(KPI_FN);
    expect(s).toContain(
      "percentile_cont(0.5) within group ( order by extract(epoch from (p.opened_at - p.sent_at)) / 60 )"
    );
    expect(s).toContain(
      "percentile_cont(0.5) within group ( order by extract(epoch from (p.clicked_at - p.sent_at)) / 60 )"
    );
  });

  it("ties a visit to the email through the cid, inside 72 hours", () => {
    const s = squish(KPI_FN);
    expect(s).toContain("a.event = 'email_visit'");
    expect(s).toContain("a.props ->> 'cid' = 'EML-' || s.flow || '-' || s.step");
    expect(s).toContain("s.sent_at + interval '72 hours'");
  });

  it("encodes the goal table from spec §4.3, step by step", () => {
    const s = squish(KPI_FN);
    // The read is the goal for the three analysis-shaped steps.
    expect(s).toContain("when s.flow || '/' || s.step in ('trial/welcome', 'trial/analysis', 'nurture/digest')");
    expect(s).toContain("a2.props ->> 'feature' = 'daily-analysis'");
    // kys is a profile column, not an event.
    expect(s).toContain("p.kys_completed_at > s.sent_at");
    expect(s).toContain("a2.event = 'tv_username_set'");
    expect(s).toContain("a2.event = 'onboarding_step_done' and a2.props ->> 'step' = 'lesson-1'");
    expect(s).toContain("when s.step in ('ladder', 'day12', 'upgrade-seen')");
    expect(s).toContain("a2.event = 'upgrade_viewed'");
    expect(s).toContain("a2.event = 'deposit_submitted'");
    // member-d3's goal is a connected assistant, in the one state that means running.
    expect(s).toContain("ja.state = 'deployed'");
    expect(s).toContain("a2.props ->> 'feature' in ('live-classes', 'fundamental-desk')");
    // The spotlight's goal is the click AND the landing, per §4.3.
    expect(s).toContain("when s.step = 'spotlight' then coalesce(a.clicked, false) and v.visited");
  });

  it("is service_role only — it reads every member's behaviour", () => {
    const s = squish(SQL);
    expect(s).toContain(
      "revoke all on function public.fn_email_kpis(timestamptz, timestamptz) from public, anon, authenticated;"
    );
    expect(s).toContain(
      "grant execute on function public.fn_email_kpis(timestamptz, timestamptz) to service_role;"
    );
  });
});

describe("the app_events allowlist", () => {
  it("adds email_visit without dropping anything already allowed", () => {
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
    ]) {
      expect(s, e).toContain(e);
    }
  });

  it("logs one email_visit per cid per user — a refresh is not a second visit", () => {
    const s = squish(INSERT_FN);
    expect(s).toContain("p_event = 'email_visit'");
    expect(s).toContain("e.props ->> 'cid' = v_props ->> 'cid'");
  });

  it("keeps the feature_view and checklist dedupes", () => {
    const s = squish(INSERT_FN);
    expect(s).toContain("p_event = 'feature_view' and exists (");
    expect(s).toContain("p_event = 'onboarding_step_done' and exists (");
  });

  it("leaves email_visit off the client-originated list", () => {
    // Only the server logs it; a browser must not be able to forge one.
    const logEvent = fn("fn_log_event");
    expect(squish(logEvent)).not.toContain("'email_visit'");
    expect(squish(fn("fn_log_event_as"))).toContain("perform public.fn_app_event_insert");
  });

  it("keeps fn_app_event_insert unreachable from a browser", () => {
    expect(squish(SQL)).toContain(
      "revoke all on function public.fn_app_event_insert(uuid, text, jsonb) from public, anon, authenticated;"
    );
    expect(squish(SQL)).toContain(
      "grant execute on function public.fn_log_event_as(uuid, text, jsonb) to service_role;"
    );
  });
});

describe("the ops notes", () => {
  it("tells Gordon the exact webhook URL and the env vars it needs", () => {
    expect(SQL).toContain("/api/email/events?k=EMAIL_EVENTS_SECRET");
    expect(SQL).toContain("EMAIL_EVENTS_SECRET");
    expect(SQL).toContain("CRON_SECRET");
    expect(SQL).toContain("click.marketmakersfx.net");
    // Nothing live is ever committed.
    expect(SQL).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/);
  });
});
