import { describe, it, expect } from "vitest";
import { buildFactSheet, TRIAL_DAYS } from "./facts";
import type { SupportSettings } from "./types";
import { TIER_THRESHOLDS } from "@/lib/tiers";
import { LIFETIME_PLANS } from "@/lib/lifetimePlans";

const settings: SupportSettings = {
  enabled: true, bonus_code: "TeamMM001", bonus_code_expires: "2026-12-15",
  official_accounts: [{ handle: "MM_3000", label: "Admin Amelia" }, { handle: "MMFX_BOSS", label: "Gordon" }],
  office_hours: "during Singapore office hours", trade_cadence: "around 2–3 trades a day", notes: "",
  approved_flows: [{ label: "bot", link: "https://t.me/marketmakersfx18bot_not_real", use_when: "x" },
                   { label: "join flow", flow_id: "69d626007041a05eea073a86", use_when: "y" }],
};
const NOW = new Date("2026-09-15T04:00:00Z");

describe("buildFactSheet", () => {
  const f = buildFactSheet(settings, NOW);

  it("allows exactly the tier thresholds and plan prices from code", () => {
    for (const v of Object.values(TIER_THRESHOLDS)) expect(f.allow.amounts.has(v)).toBe(true);
    for (const p of Object.values(LIFETIME_PLANS)) expect(f.allow.amounts.has(p.priceUsd)).toBe(true);
    expect(f.allow.amounts.has(100)).toBe(false);
    expect(f.allow.amounts.has(388)).toBe(false);
  });

  it("states the live numbers in the prompt text", () => {
    expect(f.text).toContain("$50");
    expect(f.text).toContain("$200");
    expect(f.text).toContain("$500");
    expect(f.text).toContain("USD 588");
    expect(f.text).toContain("USD 1,588");
    expect(f.text).toContain(`${TRIAL_DAYS} days`);
    expect(f.text).toContain("47807426");
    expect(f.text).toContain("@MM_3000");
  });

  it("lists approved flow links and ids", () => {
    expect(f.allow.urls).toContain("https://t.me/marketmakersfx18bot_not_real");
    expect(f.allow.flowIds.has("69d626007041a05eea073a86")).toBe(true);
  });

  it("carries the bonus code while it's valid, and drops it after expiry", () => {
    expect(f.allow.bonusCode).toBe("TeamMM001");
    expect(buildFactSheet(settings, new Date("2026-12-16T00:00:00Z")).allow.bonusCode).toBeNull();
  });

  it("allows the official handles only", () => {
    expect([...f.allow.handles].sort()).toEqual(["marketmakers18bot", "mm_3000", "mmfx_boss"]);
  });
});
