import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The sponsor-dashboard migration (design doc 2026-11-05 §2), in the style of
// partners/migration.test.ts: this repo has no Postgres in CI, so the suite
// asserts on the migration's SOURCE. A regression fence, not an execution
// test; the SQL still has to survive the rollback dry run in
// scripts/apply-sponsor-dashboard-migration.mjs before it is applied.

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE = readdirSync(DIR).find((f) => f.endsWith("_sponsor_dashboard.sql"));
const SQL = FILE ? readFileSync(join(DIR, FILE), "utf8") : "";
const squish = (s: string) => s.replace(/\s+/g, " ");

function fn(name: string): string {
  const start = SQL.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} is not in the migration`).toBeGreaterThan(-1);
  const end = SQL.indexOf("\n$$;", start);
  return squish(SQL.slice(start, end === -1 ? undefined : end));
}

const READERS = ["fn_sponsor_windows", "fn_sponsor_funnel", "fn_sponsor_clients"] as const;
const WRITERS = ["fn_sponsor_set", "fn_sponsor_window_set"] as const;

describe("sponsor_dashboard migration", () => {
  it("exists, dated after the course-progress migration", () => {
    expect(FILE).toBe("20261105000001_sponsor_dashboard.sql");
  });

  describe("partners — kind and brokers", () => {
    it("adds kind, defaulting every existing row (Ren) to agency", () => {
      expect(squish(SQL)).toContain("add column if not exists kind text not null default 'agency'");
    });
    it("allows only agency or sponsor", () => {
      expect(squish(SQL)).toContain("check (kind in ('agency', 'sponsor'))");
    });
    it("limits brokers to the three the ledger knows", () => {
      expect(squish(SQL)).toContain("brokers <@ array['octa', 'dupoin', 'elev8']::text[]");
    });
    it("refuses a sponsor with no broker", () => {
      expect(squish(SQL)).toContain("kind <> 'sponsor' or coalesce(array_length(brokers, 1), 0) > 0");
    });
  });

  describe("partner_countries — the sponsorship windows", () => {
    it("is keyed by sponsor, country and start", () => {
      const s = squish(SQL);
      expect(s).toContain("create table if not exists public.partner_countries (");
      expect(s).toContain("slug text not null references public.partners(slug) on delete cascade");
      expect(s).toContain("country text not null check (country ~ '^[A-Z]{2}$')");
      expect(s).toContain("since timestamptz not null");
      expect(s).toContain("until timestamptz check (until is null or until > since)");
      expect(s).toContain("primary key (slug, country, since)");
    });
    it("is out of every browser's reach", () => {
      const s = squish(SQL);
      expect(s).toContain("alter table public.partner_countries enable row level security");
      expect(s).toContain("revoke all on public.partner_countries from anon, authenticated");
      expect(s).not.toContain("create policy");
    });
  });

  describe("the SPN cid family", () => {
    it("widens attribution_touches.source without dropping a value", () => {
      const s = squish(SQL);
      expect(s).toContain("drop constraint if exists attribution_touches_source_check");
      for (const v of ["AGY", "CRT", "ORG", "EML", "SEO", "SPN", "other"]) {
        expect(s, `${v} missing from the constraint`).toMatch(
          new RegExp(`check \\(source in \\([^)]*'${v}'[^)]*\\)\\)`)
        );
      }
    });
    it("buckets SPN- touches in fn_record_touch and keeps every earlier family", () => {
      const f = fn("fn_record_touch");
      for (const p of ["AGY", "CRT", "ORG", "EML", "SEO", "SPN"]) {
        expect(f, `${p} classification missing`).toContain(`when v_cid like '${p}-%' then '${p}'`);
      }
      expect(f).toContain("else 'other'");
      expect(f).toContain("return;");
    });
    it("lets the brain's weekly report see SPN rows", () => {
      const f = fn("organic_signups_by_cid");
      for (const p of ["ORG", "EML", "AGY", "SEO", "SPN"]) {
        expect(f, `${p}-% missing from the report`).toContain(`attr_cid like '${p}-%'`);
      }
    });
  });

  describe("fn_sponsor_window_set — one sponsor per country at a time", () => {
    it("refuses another sponsor's overlapping window", () => {
      const f = fn("fn_sponsor_window_set");
      expect(f).toContain("pc.slug <> v_slug");
      expect(f).toContain("already sponsors");
    });
    it("replaces the same sponsor's overlapping windows", () => {
      const f = fn("fn_sponsor_window_set");
      expect(f).toContain("delete from public.partner_countries pc");
      expect(f).toContain("pc.slug = v_slug");
    });
    it("only accepts a partner that is already a sponsor", () => {
      expect(fn("fn_sponsor_window_set")).toContain("p.kind = 'sponsor'");
    });
  });

  describe("fn_sponsor_funnel — the headline cohort and the traced subset", () => {
    const f = () => fn("fn_sponsor_funnel");
    it("builds the cohort from the sponsor's country windows", () => {
      expect(f()).toContain("join public.partner_countries pc");
      expect(f()).toContain("pc.country = pr.country");
      expect(f()).toContain("pr.signup_at >= pc.since");
      expect(f()).toContain("pr.signup_at < coalesce(pc.until, 'infinity'::timestamptz)");
    });
    it("excludes admin accounts", () => {
      expect(f()).toContain("not coalesce(pr.is_admin, false)");
    });
    it("traces on first touch with the SPN-<slug>- prefix", () => {
      expect(f()).toContain("v_prefix := 'SPN-' || v_slug || '-'");
      expect(f()).toContain("c.attr_cid like v_prefix || '%'");
      expect(f()).not.toContain("attr_last_cid");
    });
    it("counts clicks, submissions and funding against the sponsor's brokers only", () => {
      expect(f()).toContain("e.event = 'upgrade_broker_link_clicked' and e.props ->> 'broker' = any (v_brokers)");
      expect(f()).toContain("e.event = 'deposit_submitted' and e.props ->> 'broker' = any (v_brokers)");
      expect(f()).toContain("c.deposit_verified_at is not null and c.broker = any (v_brokers)");
      expect(f()).toContain("d.broker = any (v_brokers)");
    });
    it("uses the partner page's activation definition", () => {
      expect(f()).toContain("c.tradingview_username is not null");
      expect(f()).toContain("c.kys_completed_at is not null");
      expect(f()).toContain("e.props ->> 'feature' = 'daily-analysis'");
      expect(f()).toContain("e.event = 'onboarding_step_done'");
    });
  });

  describe("fn_sponsor_clients — the masked rows", () => {
    const f = () => fn("fn_sponsor_clients");
    it("returns exactly the masked columns and nothing else", () => {
      expect(f()).toContain(
        "returns table ( total bigint, signed_up date, country text, display text, stage text, ad_label text, account_number text, deposit_total numeric )"
      );
    });
    it("never mentions a contact column", () => {
      for (const col of ["email", "phone", "telegram", "signup_ip", "attr_geo"]) {
        expect(f(), `${col} must not appear`).not.toContain(col);
      }
    });
    it("shows the trading account number only once funded with the sponsor's broker", () => {
      expect(f()).toContain("case when s.funded then s.trading_account_number end");
    });
    it("masks the name to first name and last initial", () => {
      expect(f()).toContain("upper(left(regexp_replace(s.nm, '^.*\\s', ''), 1)) || '.'");
    });
    it("orders stages furthest-first", () => {
      // Scoped to the final select: the stage names also appear as event
      // names in the CTE above it.
      const body = f().slice(f().indexOf("select count(*) over ()"));
      const order = ["'funded'", "'submitted'", "'broker_clicked'", "'upgrade_viewed'", "'activated'", "else 'signed_up'"];
      const idx = order.map((o) => body.indexOf(o));
      expect(idx.every((i) => i > -1)).toBe(true);
      expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    });
    it("caps a page at 200 rows", () => {
      expect(f()).toContain("least(greatest(coalesce(p_limit, 50), 1), 200)");
    });
  });

  describe("grants — service role and nobody else", () => {
    const s = squish(SQL);
    for (const name of [...READERS, ...WRITERS, "fn_record_touch", "organic_signups_by_cid"]) {
      it(`${name} is revoked from public, anon and authenticated`, () => {
        expect(s).toMatch(
          new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`)
        );
      });
      it(`${name} is granted to service_role`, () => {
        expect(s).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role`));
      });
    }
    for (const name of [...READERS, ...WRITERS]) {
      it(`${name} is security definer with an empty search_path`, () => {
        const f = fn(name);
        expect(f).toContain("security definer");
        expect(f).toContain("set search_path = ''");
      });
    }
  });
});
