import { describe, it, expect } from "vitest";
import { buildFactSheet, TRIAL_DAYS } from "./facts";
import type { SupportSettings } from "./types";
import { TIER_THRESHOLDS } from "@/lib/tiers";
import { LIFETIME_PLANS } from "@/lib/lifetimePlans";
import { DUPOIN_COUNTRIES } from "@/lib/brokerRegion";
import { SWITCH_REASON } from "@/lib/brokerLinks";

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

  it("always allows the admin and bot handles, and normalises messy handles", () => {
    const noAccounts = buildFactSheet({ ...settings, official_accounts: [] }, NOW);
    expect(noAccounts.allow.handles.has("mm_3000")).toBe(true);
    expect(noAccounts.allow.handles.has("marketmakers18bot")).toBe(true);

    const messy = buildFactSheet(
      { ...settings, official_accounts: [{ handle: "@@MMFX_Boss ", label: "Gordon" }] },
      NOW
    );
    expect(messy.allow.handles.has("mmfx_boss")).toBe(true);
  });

  it("has no double punctuation and quotes the switch reason exactly", () => {
    expect(f.text).not.toMatch(/\.\s*"\.|\.\./);
    expect(f.text).toContain(`"${SWITCH_REASON}"`);
  });

  it("derives the Dupoin country list from DUPOIN_COUNTRIES, with no hand-copied list", () => {
    for (const name of ["Iran", "Israel", "North Korea", "Canada", "Germany", "Singapore"]) {
      expect(f.text).toContain(name);
    }
    expect(f.text).not.toContain("a few others");

    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    for (const code of DUPOIN_COUNTRIES) {
      expect(f.text).toContain(regionNames.of(code) ?? code);
    }
  });

  it("states an accurate Desk-level trial and never claims the money is safe", () => {
    expect(f.text).toContain("Desk");
    expect(f.text).toContain("the AI Trading Assistant");
    expect(f.text).toContain("the private Team MM channel");
    expect(f.text).toContain("Trading involves risk, including the possible loss of capital.");
    expect(f.text).not.toContain("money stays theirs");
  });

  it("trims the bonus code and checks its expiry against Singapore time, not UTC", () => {
    expect(buildFactSheet(settings, new Date("2026-12-15T15:59:00Z")).allow.bonusCode).toBe("TeamMM001");
    expect(buildFactSheet(settings, new Date("2026-12-15T16:01:00Z")).allow.bonusCode).toBeNull();

    const spaced = buildFactSheet(
      { ...settings, bonus_code: "  TeamMM001 " },
      new Date("2026-12-15T15:59:00Z")
    );
    expect(spaced.allow.bonusCode).toBe("TeamMM001");

    const malformed = buildFactSheet({ ...settings, bonus_code_expires: "15/12/2026" }, NOW);
    expect(malformed.allow.bonusCode).toBeNull();
  });

  it("only lists flows with a real link, normalises bare links, and keeps flow ids separately", () => {
    const s2: SupportSettings = {
      ...settings,
      approved_flows: [
        { label: "empty", use_when: "never" },
        { label: "bot", link: "t.me/marketmakers18bot", use_when: "z" },
        { label: "join flow", flow_id: "69d626007041a05eea073a86", use_when: "y" },
      ],
    };
    const f2 = buildFactSheet(s2, NOW);
    expect(f2.text).not.toContain("empty");
    expect(f2.allow.urls).toContain("https://t.me/marketmakers18bot");
    expect(f2.text).toContain("https://t.me/marketmakers18bot");
    expect(f2.text).not.toContain("join flow");
    expect(f2.allow.flowIds.has("69d626007041a05eea073a86")).toBe(true);
  });

  it("lists each lifetime plan's first include", () => {
    expect(f.text).toContain(LIFETIME_PLANS.team.includes[0]);
    expect(f.text).toContain(LIFETIME_PLANS.team_mentorship.includes[0]);
  });
});
