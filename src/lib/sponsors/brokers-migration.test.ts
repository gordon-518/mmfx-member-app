import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The sponsor-brokers follow-up (5 Nov 2026): GTC sponsors Singapore and Weby
// sponsors Indonesia, neither yet a partnered broker in the app. The sponsor
// list is widened so their dashboards can exist; the funnel's own broker lists
// are untouched. Source assertions, as for the other migrations.

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE = readdirSync(DIR).find((f) => f.endsWith("_sponsor_brokers.sql"));
const SQL = FILE ? readFileSync(join(DIR, FILE), "utf8") : "";
const squish = (s: string) => s.replace(/\s+/g, " ");

describe("sponsor_brokers migration", () => {
  it("exists, dated after the sponsor-dashboard migration", () => {
    expect(FILE).toBe("20261105000002_sponsor_brokers.sql");
  });
  it("widens the sponsor broker list to gtc and weby, keeping the ledger's three", () => {
    const s = squish(SQL);
    expect(s).toContain("drop constraint if exists partners_brokers_check");
    expect(s).toContain("brokers <@ array['octa', 'dupoin', 'elev8', 'gtc', 'weby']::text[]");
    expect(s).toContain("if not (v_brokers <@ array['octa', 'dupoin', 'elev8', 'gtc', 'weby']::text[]) then");
  });
  it("leaves profiles.broker and deposit_events.broker alone", () => {
    expect(SQL).not.toMatch(/alter table public\.(profiles|deposit_events)/);
  });
  it("keeps fn_sponsor_set service-role only", () => {
    const s = squish(SQL);
    expect(s).toContain("revoke all on function public.fn_sponsor_set(text, text[]) from public, anon, authenticated");
    expect(s).toContain("grant execute on function public.fn_sponsor_set(text, text[]) to service_role");
  });
});
