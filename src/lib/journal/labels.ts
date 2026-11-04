// Display labels for the journal's data keys. The keys themselves (the session
// names sessionOf returns, the weekday codes, emotion ids, trading styles) are
// what the database and the rules config store, so they never change; only the
// label shown to the reader does. A key with no label shows as stored.

import { en } from "@/i18n/messages/en";
import type { Messages } from "@/i18n/messages/types";

export type JournalEngineMessages = Messages["journalEngine"];

function lookup(labels: object, key: string): string {
  return (labels as Record<string, string | undefined>)[key] ?? key;
}

/** "London" → "伦敦盘". */
export function sessionLabel(session: string, m: JournalEngineMessages = en.journalEngine): string {
  return lookup(m.sessions, session);
}

/** "Mon" → "周一". */
export function weekdayLabel(day: string, m: JournalEngineMessages = en.journalEngine): string {
  return lookup(m.weekdays, day);
}

/** "fomo" → "FOMO". */
export function emotionLabel(emotion: string, m: JournalEngineMessages = en.journalEngine): string {
  return lookup(m.emotions, emotion);
}

/** "swing" → "Swing trader". */
export function styleLabel(style: string, m: JournalEngineMessages = en.journalEngine): string {
  return lookup(m.styles, style);
}

/** "buy" → "Buy". */
export function directionLabel(direction: string, m: JournalEngineMessages = en.journalEngine): string {
  return lookup(m.directions, direction);
}
