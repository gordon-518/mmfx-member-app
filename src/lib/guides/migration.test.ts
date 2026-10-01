import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The guides store (design doc 2026-10-01 "Daily guides" §2) in the same style
// as claim.test.ts and measurement.test.ts: this repo has no Postgres in CI, so
// the suite asserts on the migration's SOURCE — that every column, check,
// index and grant the routes depend on is present and spelled the way they
// read it. A regression fence, not an execution test; the SQL still has to be
// applied through the Management API (rollback dry run first) before the
// marketing site is pointed at these routes.

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE = readdirSync(DIR).find((f) => f.endsWith("_guides.sql"));
const SQL = readFileSync(join(DIR, FILE!), "utf8");

function squish(s: string): string {
  return s.replace(/\s+/g, " ");
}

const S = squish(SQL);

describe("guides migration", () => {
  it("exists, dated after the SEO attribution migration that named /guides", () => {
    expect(FILE).toBe("20261001000003_guides.sql");
  });

  it("creates public.guides with the slug as its primary key", () => {
    expect(S).toContain("create table if not exists public.guides (");
    expect(S).toContain("slug text primary key");
  });

  it("constrains the slug to the kebab-case form the URL uses", () => {
    // The same regex the validator enforces, so a row can only exist for a
    // slug the site can actually route to.
    expect(S).toContain("check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')");
  });

  it("carries every v2 key as its own column", () => {
    for (const col of [
      "feature text not null",
      "title text not null",
      "description text not null",
      "published_on date not null",
      "cid text not null",
      "h2s jsonb not null",
      "body_markdown text not null",
      "takeaways jsonb not null",
      "pull_quote text",
      "cover jsonb not null",
      "visuals jsonb not null",
    ]) {
      expect(S).toContain(col);
    }
  });

  it("makes pull_quote the one nullable v2 key", () => {
    // `pullQuote` is optional in the contract; the other three are not.
    expect(S).not.toContain("pull_quote text not null");
  });

  it("defaults status to published and admits only the two states", () => {
    expect(S).toContain("status text not null default 'published'");
    expect(S).toContain("check (status in ('published','unpublished'))");
  });

  it("stamps created_at and updated_at", () => {
    expect(S).toContain("created_at timestamptz not null default now()");
    expect(S).toContain("updated_at timestamptz not null default now()");
  });

  it("keeps updated_at honest with the shared trigger", () => {
    // DELETE /api/guides/[slug] only flips status; the export's updatedAt is
    // what tells the nightly job the row moved, so it cannot be left to the
    // route to remember.
    expect(S).toContain("create trigger guides_set_updated_at before update on public.guides");
    expect(S).toContain("execute function public.set_updated_at()");
  });

  it("indexes the list query and the feature lookup", () => {
    expect(S).toContain(
      "create index if not exists guides_status_published_idx on public.guides (status, published_on desc)"
    );
    expect(S).toContain(
      "create index if not exists guides_feature_idx on public.guides (feature)"
    );
  });

  it("is service-role only — no browser ever reads the table", () => {
    expect(SQL).toContain("alter table public.guides enable row level security;");
    expect(SQL).not.toMatch(/create policy[^;]*on public\.guides/);
    expect(S).toContain("revoke all on table public.guides from public, anon, authenticated");
    expect(S).toContain(
      "grant select, insert, update, delete on table public.guides to service_role"
    );
  });

  it("documents the table and the columns whose shape is a contract", () => {
    expect(S).toContain("comment on table public.guides is");
    for (const col of ["h2s", "takeaways", "cover", "visuals", "status"]) {
      expect(S).toContain(`comment on column public.guides.${col} is`);
    }
  });

  it("creates nothing destructively", () => {
    expect(SQL).not.toMatch(/drop table/i);
    expect(SQL).not.toMatch(/\bdelete from\b/i);
  });
});
