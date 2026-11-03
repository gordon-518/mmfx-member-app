// Content counts for client components. The syllabus itself is server-only
// (courseData.ts holds the slide filenames), so client copy that says "all 19
// lessons" reads these instead — and contentCounts.test.ts fails the build the
// moment any of them drifts from the real content.
export const LESSON_COUNT = 19;
export const EBOOK_COUNT = 4;
export const INDICATOR_COUNT = 10;

/** The same counts as message variables, for copy like "all {lessons} lessons". */
export const CONTENT_VARS = { lessons: LESSON_COUNT, ebooks: EBOOK_COUNT, indicators: INDICATOR_COUNT } as const;
