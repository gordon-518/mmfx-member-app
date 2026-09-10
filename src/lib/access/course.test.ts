import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isLessonFree, canWatchLesson, FREE_COURSE_MODULE_ID } from "./course";
import type { Viewer } from "./features";

const MODULES = [
  { id: 1, from: 0, to: 2 },
  { id: 2, from: 3, to: 5 },
  { id: 6, from: 15, to: 18 },
];
const FREE: Viewer = { tier: "Limited", isMember: false, isAdmin: false };
const TRIAL: Viewer = { tier: "Full", isMember: false, isAdmin: false };

describe("course gating", () => {
  it("Module 1 lessons are free, nothing else is", () => {
    expect([0, 1, 2].every((n) => isLessonFree(n, MODULES))).toBe(true);
    expect([3, 5, 15, 18].some((n) => isLessonFree(n, MODULES))).toBe(false);
  });

  it("Free users watch Module 1 only; Full users watch everything", () => {
    expect(canWatchLesson(2, MODULES, FREE)).toBe(true);
    expect(canWatchLesson(3, MODULES, FREE)).toBe(false);
    expect(canWatchLesson(18, MODULES, TRIAL)).toBe(true);
  });

  it("nothing is free if the free module is missing (fail closed)", () => {
    expect(isLessonFree(0, [{ id: 2, from: 0, to: 5 }])).toBe(false);
  });
});

// The slides bucket's Free policy (20260910000004_free_tier_access.sql) names
// Module 1's deck files literally. courseData.ts is server-only and can't be
// imported here, so both files are read as text and compared.
describe("Module 1 decks: courseData.ts and the storage policy agree", () => {
  it("lists the same pptFiles", () => {
    const root = resolve(__dirname, "../../..");
    const data = readFileSync(resolve(root, "src/app/course/courseData.ts"), "utf8");
    const sql = readFileSync(
      resolve(root, "supabase/migrations/20260910000004_free_tier_access.sql"),
      "utf8"
    );

    const mod = data.match(new RegExp(`\\{ id: ${FREE_COURSE_MODULE_ID},[^}]*from: (\\d+), to: (\\d+) \\}`));
    expect(mod, "module 1 range in courseData.ts").not.toBeNull();
    const [from, to] = [Number(mod![1]), Number(mod![2])];

    const fromData = [...data.matchAll(/number: (\d+),[^\n]*pptFile: "([^"]+)"/g)]
      .filter((m) => Number(m[1]) >= from && Number(m[1]) <= to)
      .map((m) => m[2])
      .sort();

    const policy = sql.slice(sql.indexOf("slides_module1_signed_in_read"));
    const fromSql = [...policy.matchAll(/'([^']+\.pptx)'/g)].map((m) => m[1]).sort();

    expect(fromData).toHaveLength(to - from + 1);
    expect(fromSql).toEqual(fromData);
  });
});
