import { describe, it, expect } from "vitest";
import { LESSONS, MODULES, LEVELS } from "@/app/course/courseData";
import { LOCALES } from "./config";
import { MESSAGES } from "./messages";
import { lessonText, levelLabel, moduleText } from "./course";

describe("the syllabus in every language", () => {
  it("has every module, lesson and level", () => {
    for (const locale of LOCALES) {
      const t = MESSAGES[locale];
      for (const m of MODULES) {
        expect(Object.keys(t.courseContent.modules), `${locale} m${m.id}`).toContain(`m${m.id}`);
      }
      for (const l of LESSONS) {
        expect(Object.keys(t.courseContent.lessons), `${locale} ${l.slug}`).toContain(l.slug);
      }
      for (const level of LEVELS) expect(levelLabel(t, level), locale).toBeTruthy();
    }
  });

  it("reads the English back for English", () => {
    const l = LESSONS[0];
    expect(lessonText(MESSAGES.en, l.slug, l).title).toBe(l.title);
    expect(moduleText(MESSAGES.en, MODULES[0].id, MODULES[0]).title).toBe(MODULES[0].title);
  });

  it("falls back to the English for an unknown slug", () => {
    const fallback = { title: "X", description: "Y" };
    expect(lessonText(MESSAGES["zh-Hans"], "no-such-lesson", fallback)).toEqual(fallback);
  });
});
