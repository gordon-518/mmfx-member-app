import { describe, it, expect } from "vitest";
import { MM_INDICATORS_DISCLAIMER } from "./disclaimer";
import { en } from "@/i18n/messages/en";

describe("compliance wording", () => {
  it("keeps the indicators disclaimer verbatim", () => {
    expect(MM_INDICATORS_DISCLAIMER).toBe(
      "MM Indicators are educational decision-support tools. They do not provide investment advice, do not guarantee profitable trades, and do not execute orders. Trading XAU/USD carries substantial risk of loss. Past performance does not indicate future results."
    );
  });

  it("keeps the risk warning verbatim", () => {
    expect(en.common.riskNotice).toBe(
      "Trading involves risk, including the possible loss of capital. No returns are guaranteed."
    );
    expect(en.common.pastPerformance).toBe("Past performance is not indicative of future results.");
  });
});
