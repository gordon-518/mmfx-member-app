import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The three Command Center pillar readers, exposed as security-definer functions so the
// VPS can call them over /rest/v1/rpc with the service-role key it already holds — rather
// than being given a Supabase MANAGEMENT token, which can do anything to the project.
//
// Style follows src/lib/partners/migration.test.ts: this repo has no Postgres in CI, so the
// suite asserts on the migration SOURCE. A regression fence, not an execution test; the SQL
// still has to survive a `begin … rollback` dry run before it is applied.

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE = readdirSync(DIR).find((f) => f.endsWith("_pillar_readers.sql"));
const SQL = FILE ? readFileSync(join(DIR, FILE), "utf8") : "";
const squish = (s: string) => s.replace(/\s+/g, " ");

function fn(name: string): string {
  const start = SQL.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} is not in the migration`).toBeGreaterThan(-1);
  const end = SQL.indexOf("\n$$;", start);
  return squish(SQL.slice(start, end === -1 ? undefined : end));
}

describe("pillar_readers migration", () => {
  it("exists, dated after the seo-attribution migration", () => {
    expect(FILE).toBe("20261001000002_pillar_readers.sql");
  });

  // The column names ARE the contract with the brain's readers. A rename here is a silent
  // break there: rowNum throws on a missing column, the runner turns that into `stale`, and
  // the pillar goes blank with no other signal.
  const CONTRACT: Record<string, string[]> = {
    fn_pillar_webapp: ["signups_7d", "activation_rate", "trials_active", "deposits_7d", "deposits_28d", "deposit_usd_7d"],
    fn_pillar_email: ["sent_7d", "delivered_7d", "clicked_7d", "attributed_signups_7d"],
    fn_pillar_seo: ["organic_signups_7d"],
  };

  for (const [name, cols] of Object.entries(CONTRACT)) {
    describe(name, () => {
      it("exists and returns exactly the columns the reader reads", () => {
        const f = fn(name);
        for (const c of cols) expect(f, `${name} is missing column ${c}`).toContain(c);
        // Each column must be an output name, not just a mention in a comment.
        for (const c of cols) expect(f).toMatch(new RegExp(`as ${c}\\b`));
      });

      it("is security definer with a pinned search_path", () => {
        const f = fn(name);
        expect(f).toContain("security definer");
        expect(f).toContain("set search_path = public");
      });

      it("is callable by service_role and by nobody else", () => {
        const s = squish(SQL);
        expect(s).toMatch(new RegExp(`revoke all on function public\\.${name}\\(\\) from public, anon, authenticated`));
        expect(s).toMatch(new RegExp(`grant execute on function public\\.${name}\\(\\) to service_role`));
      });
    });
  }

  // Each of these guards a defect that was found by querying production during Plan A and
  // must not come back when the query moves into a function.
  describe("the Plan A corrections survive the move", () => {
    it("webapp sources deposits from profiles, not the 4-row deposit_submissions table", () => {
      const f = fn("fn_pillar_webapp");
      expect(f).toContain("deposit_verified_at");
      expect(f, "deposit_submissions has 4 rows lifetime — it must not be the money source")
        .not.toContain("deposit_submissions");
    });

    it("webapp activation is not measured off the near-dead onboarding_step_done event", () => {
      // That event has fired 18 times ever; using it pins activation at ~2.1% forever.
      expect(fn("fn_pillar_webapp")).not.toContain("onboarding_step_done");
    });

    it("webapp activation excludes email_visit, so email cannot inflate webapp's KPI", () => {
      expect(fn("fn_pillar_webapp")).toContain("email_visit");
    });

    it("email counts only successful sends", () => {
      expect(fn("fn_pillar_email")).toContain("ok = true");
    });

    it("email windows delivered and clicked on the SEND's sent_at, not the event time", () => {
      const f = fn("fn_pillar_email");
      expect(f).toContain("es.sent_at >= now() - interval '7 days'");
      expect(f, "windowing on occurred_at inflated click_rate by ~14 points")
        .not.toContain("e.occurred_at >=");
    });

    it("email has no opens KPI — they are MPP-inflated and must never rank anything", () => {
      const f = fn("fn_pillar_email");
      expect(f).not.toContain("'opened'");
      expect(f).not.toContain("open_rate");
    });

    it("email attributes on attr_last_cid, the column that is actually populated", () => {
      expect(fn("fn_pillar_email")).toContain("attr_last_cid like 'EML-%'");
    });

    it("seo attributes on attr_cid — first touch, matching organic_signups_by_cid", () => {
      const f = fn("fn_pillar_seo");
      expect(f).toContain("attr_cid like 'SEO-%'");
      expect(f, "attr_last_cid would count a member who browsed a guide months later")
        .not.toContain("attr_last_cid");
    });
  });
});
