import { describe, expect, it } from "vitest";
import { reconcile } from "./ibReconcile";

describe("reconcile", () => {
  it("computes added / removed / flaggedConnected", () => {
    const r = reconcile({
      currentAllowlist: ["100", "200", "300"],
      newList: ["200", "300", "400"],
      connectedLogins: ["100", "300"],
    });
    expect(r.added).toEqual(["400"]);
    expect(r.removed.sort()).toEqual(["100"]);
    expect(r.flaggedConnected).toEqual(["100"]); // connected but not in newList
  });

  it("flags the >20% removal guardrail", () => {
    const current = Array.from({ length: 100 }, (_, i) => String(i));
    const next = current.slice(0, 75); // drop 25%
    const r = reconcile({ currentAllowlist: current, newList: next, connectedLogins: [] });
    expect(r.removalPct).toBe(25);
    expect(r.guardRemoval).toBe(true);
  });

  it("flags the addition guardrail when the list balloons", () => {
    const r = reconcile(
      { currentAllowlist: ["1", "2"], newList: ["1", "2", "3", "4", "5", "6"], connectedLogins: [] },
      { additionThreshold: 100 }
    );
    expect(r.additionPct).toBe(200);
    expect(r.guardAddition).toBe(true);
  });

  it("first import (empty current) trips no guardrails", () => {
    const r = reconcile({ currentAllowlist: [], newList: ["1", "2", "3"], connectedLogins: [] });
    expect(r.guardRemoval).toBe(false);
    expect(r.guardAddition).toBe(false);
  });
});
