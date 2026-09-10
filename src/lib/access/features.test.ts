import { describe, it, expect } from "vitest";
import { FEATURE_KEYS } from "./featureKeys";
import { FEATURE_LEVEL, FEATURE_HREF, canAccess, featureForHref, type Viewer } from "./features";

const FREE: Viewer = { tier: "Limited", isMember: false, isAdmin: false };
const TRIAL: Viewer = { tier: "Full", isMember: false, isAdmin: false };
const MEMBER: Viewer = { tier: "Full", isMember: true, isAdmin: false };
const ADMIN: Viewer = { tier: "Full", isMember: false, isAdmin: true };

describe("feature access map", () => {
  it("covers every feature key with a level and an href", () => {
    for (const k of FEATURE_KEYS) {
      expect(FEATURE_LEVEL[k], k).toBeDefined();
      expect(FEATURE_HREF[k], k).toMatch(/^\/[a-z-/]+$/);
    }
  });

  it("opens exactly the plan's Free surfaces", () => {
    const free = FEATURE_KEYS.filter((k) => FEATURE_LEVEL[k] === "free").sort();
    expect(free).toEqual(["calendar", "course", "daily-analysis", "know-your-style", "news"]);
  });

  it("Free users reach only the free features", () => {
    const open = FEATURE_KEYS.filter((k) => canAccess(k, FREE)).sort();
    expect(open).toEqual(["calendar", "course", "daily-analysis", "know-your-style", "news"]);
  });

  it("trials get everything except the member-only features", () => {
    const shut = FEATURE_KEYS.filter((k) => !canAccess(k, TRIAL)).sort();
    expect(shut).toEqual(["ai-trading-assistant", "team-mm"]);
  });

  it("members and admins reach everything", () => {
    expect(FEATURE_KEYS.every((k) => canAccess(k, MEMBER))).toBe(true);
    expect(FEATURE_KEYS.every((k) => canAccess(k, ADMIN))).toBe(true);
  });

  it("an admin on an expired trial is still Free (Full access is required, as before)", () => {
    expect(canAccess("signals", { tier: "Limited", isMember: false, isAdmin: true })).toBe(false);
    expect(canAccess("daily-analysis", { tier: "Limited", isMember: false, isAdmin: true })).toBe(true);
  });
});

describe("featureForHref", () => {
  it("maps each feature href back to its key", () => {
    for (const k of FEATURE_KEYS) expect(featureForHref(FEATURE_HREF[k])).toBe(k);
  });
  it("returns undefined for pages that aren't features", () => {
    expect(featureForHref("/dashboard")).toBeUndefined();
    expect(featureForHref("/welcome")).toBeUndefined();
    expect(featureForHref("/signals/extra")).toBeUndefined();
  });
});
