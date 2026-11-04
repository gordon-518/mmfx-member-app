import { describe, it, expect } from "vitest";
import { buildAppGuide, CHAT_APP_PATHS, APP_URL } from "./guide";
import { FEATURE_KEYS } from "@/lib/access/featureKeys";
import { FEATURE_HREF } from "@/lib/access/features";
import { MONEY_CLAIM } from "@/i18n/moneyClaims";

describe("the app guide", () => {
  const guide = buildAppGuide();

  it("describes every page, with its link", () => {
    for (const key of FEATURE_KEYS) expect(guide).toContain(`${APP_URL}${FEATURE_HREF[key]}`);
  });

  it("only links to pages the assistant may link to", () => {
    const appLinks = [...guide.matchAll(/https:\/\/app\.marketmakersfx\.net(\/[\w/-]*)/g)].map((m) => m[1]);
    for (const path of appLinks) expect(CHAT_APP_PATHS, path).toContain(path);
  });

  it("states tiers with their real thresholds", () => {
    expect(guide).toMatch(/Team MM \(\$500 in cumulative deposits\)/);
    expect(guide).toMatch(/Desk \(\$200 in cumulative deposits\)/);
  });

  it("carries the real content counts and the upgrade FAQ", () => {
    expect(guide).toContain("19 lessons");
    expect(guide).toContain("Is the deposit a fee?");
  });

  it("never reads as an earnings promise", () => {
    expect(guide).not.toMatch(MONEY_CLAIM.en);
  });
});
