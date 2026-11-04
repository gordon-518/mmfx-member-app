import { describe, it, expect } from "vitest";
import { INVENTORY, INVENTORY_STATS } from "./deskInventory";
import { MESSAGES } from "@/i18n/messages";

// The numbers on /welcome are counted from the content modules, so this guards
// the counting, not the numbers: a stat that reads 0 means an import broke and
// the page would be telling members the desk is empty.
describe("desk inventory", () => {
  it("counts every kind of content", () => {
    for (const [k, n] of Object.entries(INVENTORY)) {
      expect(n, k).toBeGreaterThan(0);
    }
  });

  it("agrees with the course's own shape", () => {
    expect(INVENTORY.lessons).toBeGreaterThanOrEqual(INVENTORY.modules);
    expect(INVENTORY.levels).toBe(3);
    expect(INVENTORY.dimensions).toBe(6);
  });

  it("gives every headline stat a real number, an in-app link and words in every language", () => {
    expect(INVENTORY_STATS.length).toBeGreaterThan(3);
    for (const s of INVENTORY_STATS) {
      expect(s.n, s.key).toBeGreaterThan(0);
      expect(s.href.startsWith("/"), s.key).toBe(true);
      for (const t of Object.values(MESSAGES)) {
        expect(t.welcome.stats[s.key].label.length, s.key).toBeGreaterThan(0);
      }
    }
  });
});
