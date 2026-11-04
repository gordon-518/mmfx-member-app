import { describe, it, expect } from "vitest";
import { LESSON_COUNT, EBOOK_COUNT, INDICATOR_COUNT } from "./contentCounts";
import { LESSONS } from "@/app/course/courseData";
import { EBOOKS } from "@/app/library/ebooks";
import { INDICATORS } from "@/app/indicators/data";

describe("client-safe content counts", () => {
  it("match the real syllabus, library and indicator set", () => {
    expect(LESSON_COUNT).toBe(LESSONS.length);
    expect(EBOOK_COUNT).toBe(EBOOKS.length);
    expect(INDICATOR_COUNT).toBe(INDICATORS.length);
  });
});
