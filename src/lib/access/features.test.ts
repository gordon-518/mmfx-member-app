import { describe, it, expect } from "vitest";
import { FEATURE_KEYS } from "./featureKeys";
import { FEATURE_MIN_TIER, FEATURE_HREF, canAccess, featureForHref, type Viewer } from "./features";
import type { MemberTier } from "@/lib/tiers";

const as = (tier: MemberTier, isAdmin = false): Viewer => ({ tier, isAdmin });
const open = (v: Viewer) => FEATURE_KEYS.filter((k) => canAccess(k, v)).sort();

const FREE = ["calendar", "course", "daily-analysis", "know-your-style", "news"];
const FOUNDATION = [...FREE, "indicators", "library", "strategies"].sort();
const DESK = [...FOUNDATION, "fundamental-desk", "live-classes", "signals"].sort();

describe("feature access map — the plan's tier feature matrix", () => {
  it("covers every feature key with a minimum tier and an href", () => {
    for (const k of FEATURE_KEYS) {
      expect(FEATURE_MIN_TIER[k], k).toBeDefined();
      expect(FEATURE_HREF[k], k).toMatch(/^\/[a-z-/]+$/);
    }
  });

  it("Free: calendar, news, Know Your Style, Daily Analysis, course (Module 1)", () => {
    expect(open(as("free"))).toEqual(FREE);
  });

  it("Foundation adds the library, indicators and strategies", () => {
    expect(open(as("foundation"))).toEqual(FOUNDATION);
  });

  it("Desk adds signals, live classes and the Fundamental Desk", () => {
    expect(open(as("desk"))).toEqual(DESK);
  });

  it("a trial is Desk-equivalent: everything but the AI assistant and Team MM", () => {
    expect(open(as("trial"))).toEqual(DESK);
  });

  it("Team MM reaches everything", () => {
    expect(open(as("team"))).toEqual([...FEATURE_KEYS].sort());
  });

  it("an admin on any non-free tier reaches everything; a lapsed admin is Free", () => {
    expect(open(as("trial", true))).toEqual([...FEATURE_KEYS].sort());
    expect(open(as("free", true))).toEqual(FREE);
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
