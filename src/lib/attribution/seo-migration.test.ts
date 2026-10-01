import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The SEO-attribution migration, in the style of partners/migration.test.ts: this
// repo has no Postgres in CI, so the suite asserts on the migration's SOURCE —
// that every guard the reporting side reads is present and spelled the way it
// reads it. A regression fence, not an execution test; the SQL still has to be
// exercised with a rollback dry run before it is applied to production.

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE = readdirSync(DIR).find((f) => f.endsWith("_seo_attribution.sql"));
const SQL = FILE ? readFileSync(join(DIR, FILE), "utf8") : "";

const squish = (s: string) => s.replace(/\s+/g, " ");

function fn(name: string): string {
  const start = SQL.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} is not in the migration`).toBeGreaterThan(-1);
  const end = SQL.indexOf("\n$$;", start);
  return squish(SQL.slice(start, end === -1 ? undefined : end));
}

describe("seo_attribution migration", () => {
  it("exists, dated after the partner migration it extends", () => {
    expect(FILE).toBe("20261001000001_seo_attribution.sql");
  });

  describe("fn_record_touch — an SEO touch is labelled, not bucketed as 'other'", () => {
    it("classifies SEO-% as 'SEO'", () => {
      expect(fn("fn_record_touch")).toContain("when v_cid like 'SEO-%' then 'SEO'");
    });

    it("still classifies every pre-existing family", () => {
      const f = fn("fn_record_touch");
      for (const p of ["AGY", "CRT", "ORG", "EML"]) {
        expect(f, `${p} classification was dropped`).toContain(`when v_cid like '${p}-%' then '${p}'`);
      }
      expect(f).toContain("else 'other'");
    });

    it("keeps the drop-not-raise contract, so attribution can never break a signup", () => {
      // The charset guard returns rather than raising; losing that would let a
      // malformed cid abort a signup.
      expect(fn("fn_record_touch")).toContain("return;");
    });
  });

  describe("attribution_touches.source — the constraint must admit 'SEO'", () => {
    it("allows SEO alongside the existing values", () => {
      const s = squish(SQL);
      expect(s).toMatch(/check \(source in \([^)]*'SEO'[^)]*\)\)/);
      for (const v of ["AGY", "CRT", "ORG", "EML", "other"]) {
        expect(s, `${v} was dropped from the constraint`).toMatch(
          new RegExp(`check \\(source in \\([^)]*'${v}'[^)]*\\)\\)`),
        );
      }
    });

    it("drops the old constraint before adding the new one", () => {
      // ALTER ... ADD CONSTRAINT fails if the name is taken, so the drop is required.
      const s = squish(SQL);
      expect(s).toContain("drop constraint if exists");
      expect(s.indexOf("drop constraint if exists")).toBeLessThan(s.indexOf("check (source in"));
    });
  });

  describe("organic_signups_by_cid — the brain's weekly report must see SEO rows", () => {
    it("includes SEO-% in the prefix filter", () => {
      expect(fn("organic_signups_by_cid")).toContain("attr_cid like 'SEO-%'");
    });

    it("still includes the three families it already reported", () => {
      const f = fn("organic_signups_by_cid");
      for (const p of ["ORG", "EML", "AGY"]) {
        expect(f, `${p}-% was dropped from the report`).toContain(`attr_cid like '${p}-%'`);
      }
    });

    it("keeps its shape, grants and service-role-only access", () => {
      const s = squish(SQL);
      expect(fn("organic_signups_by_cid")).toContain("returns table (cid text, signups bigint, deposits bigint)");
      expect(s).toContain("grant execute on function public.organic_signups_by_cid(timestamptz) to service_role");
      expect(s).toMatch(/revoke all on function public\.organic_signups_by_cid\(timestamptz\) from public, anon, authenticated/);
    });

    it("drops the old function first, because the body changes", () => {
      expect(squish(SQL)).toContain("drop function if exists public.organic_signups_by_cid(timestamptz)");
    });
  });
});
