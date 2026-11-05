import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TIER_THRESHOLDS } from "@/lib/tiers";

// fn_enqueue_due_sync_jobs re-states in SQL who may use the AI Trading
// Assistant (canAccess + accessTierFor), so the sync cron skips everyone else.
// Pin the SQL to the TypeScript rules so a threshold change can't drift.

const DIR = join(process.cwd(), "supabase/migrations");
const latest = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .filter((f) => readFileSync(join(DIR, f), "utf8").includes("function public.fn_enqueue_due_sync_jobs"))
  .at(-1)!;
const sql = readFileSync(join(DIR, latest), "utf8");

describe(`sync owners (${latest})`, () => {
  it("uses the Team MM deposit threshold from tiers.ts", () => {
    const n = Number(sql.match(/deposit_amount, 0\) >= (\d+)/)?.[1]);
    expect(n).toBe(TIER_THRESHOLDS.team);
  });

  it("keeps syncing inside a running trial clock, including a mid-trial depositor", () => {
    expect(sql).toMatch(/account_status in \('trial_active', 're_trial_active', 'member_active'\) and p\.trial_ends_at > now\(\)/);
  });

  it("covers the other Team MM routes: grandfathered, lifetime plan, admin", () => {
    expect(sql).toContain("coalesce(p.grandfathered, false)");
    expect(sql).toContain("nullif(p.lifetime_plan, '') is not null");
    expect(sql).toContain("coalesce(p.is_admin, false)");
  });
});
