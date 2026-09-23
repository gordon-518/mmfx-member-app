import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(join(__dirname, "../../../supabase/migrations/20260923000001_email_bounce_suppression.sql"), "utf8");
const squish = (s: string) => s.replace(/\s+/g, " ").trim();
const CLAIM = SQL.slice(SQL.indexOf("create or replace function public.fn_claim_email_sends"));

describe("bounce suppression migration", () => {
  it("adds bounced_at to email_prefs", () => {
    expect(squish(SQL)).toContain("alter table public.email_prefs add column if not exists bounced_at timestamptz");
  });
  it("backfills from hard bounces and from send-time recipient refusals", () => {
    expect(squish(SQL)).toContain("where e.event in ('hard_bounce', 'undelivered') group by s.user_id");
    expect(squish(SQL)).toContain("where s.ok = false and s.error ilike '%Recipient email is invalid%'");
  });
  it("marks on webhook bounce events and on send-time refusals via triggers", () => {
    expect(SQL).toContain("create trigger trg_email_event_mark_bounce");
    expect(SQL).toContain("after insert on public.email_events");
    expect(SQL).toContain("create trigger trg_email_send_mark_invalid");
    expect(SQL).toContain("after update of ok on public.email_sends");
  });
  it("re-creates the claim function with the bounced_at guard next to the opt-out guard", () => {
    const body = squish(CLAIM);
    expect(body).toContain("and pr.marketing_opted_out = false");
    expect(body).toContain("and pr.bounced_at is null");
    expect(body).toContain("#variable_conflict use_column");
    expect(SQL).toContain("drop function if exists public.fn_claim_email_sends(integer, integer[], integer);");
    expect(squish(SQL)).toContain("grant execute on function public.fn_claim_email_sends(integer, integer[], integer) to service_role;");
  });
  it("never clears a mark on its own", () => {
    expect(squish(SQL)).not.toMatch(/set bounced_at = null/);
  });
});
