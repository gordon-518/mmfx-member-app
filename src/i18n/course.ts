import type { Messages } from "./messages/types";

// The syllabus in the reader's language. courseData.ts (server-only) holds the
// structure and the English; these look the words up by module id and lesson
// slug, and fall back to the English if a translation is ever missing.

type Text = { title: string; summary?: string; description?: string };

export function moduleText(t: Messages, id: number, fallback: { title: string; summary: string }): { title: string; summary: string } {
  const found = (t.courseContent.modules as Record<string, Text | undefined>)[`m${id}`];
  return found ? { title: found.title, summary: found.summary ?? fallback.summary } : fallback;
}

export function lessonText(t: Messages, slug: string, fallback: { title: string; description: string }): { title: string; description: string } {
  const found = (t.courseContent.lessons as Record<string, Text | undefined>)[slug];
  return found ? { title: found.title, description: found.description ?? fallback.description } : fallback;
}

export function levelLabel(t: Messages, level: keyof Messages["courseContent"]["levels"]): string {
  return t.courseContent.levels[level];
}
