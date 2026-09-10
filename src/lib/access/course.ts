// Per-lesson course gating (conversion-fix 2.3). Pure: courseData.ts is
// server-only, so callers pass MODULES in. Free users get Module 1; everyone
// with Full access gets every lesson.

import { canAccess, type Viewer } from "./features";

/** The one module Free users can watch ("Foundations", lessons 0–2). */
export const FREE_COURSE_MODULE_ID = 1;

interface ModuleRange {
  id: number;
  from: number;
  to: number;
}

export function isLessonFree(lessonNumber: number, modules: readonly ModuleRange[]): boolean {
  const m = modules.find((x) => x.id === FREE_COURSE_MODULE_ID);
  return m != null && lessonNumber >= m.from && lessonNumber <= m.to;
}

/** Whether this viewer may watch the lesson and download its slides. */
export function canWatchLesson(
  lessonNumber: number,
  modules: readonly ModuleRange[],
  viewer: Viewer
): boolean {
  // "library" stands in for the Full level: the full course is a Full feature.
  return canAccess("library", viewer) || isLessonFree(lessonNumber, modules);
}
