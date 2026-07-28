import type { LibraryItem } from "@/lib/channel/types";

// Choose the next library item to post. Self-optimizing:
//  1. Exclude the N most-recently-posted (no visible repeats).
//  2. Explore: give a never-posted item its first impression before exploiting.
//  3. Exploit: when engagement scores are supplied, pick the highest scorer;
//     tie-break toward the least-recently-posted so winners still rotate.
//  4. Fallback: with no scores, plain least-recently-used.
// Returns null only when the approved pool is empty.
export function pickNext(
  items: LibraryItem[],
  avoidLastN: number,
  scoreById?: Record<string, number>
): LibraryItem | null {
  const approved = items.filter((i) => i.status === "approved");
  if (approved.length === 0) return null;

  const ts = (i: LibraryItem) => (i.last_posted_at ? Date.parse(i.last_posted_at) : -1);

  const recentlyPosted = new Set(
    [...approved]
      .filter((i) => i.last_posted_at)
      .sort((a, b) => ts(b) - ts(a))
      .slice(0, avoidLastN)
      .map((i) => i.id)
  );

  const eligible = approved.filter((i) => !recentlyPosted.has(i.id));
  const pool = eligible.length ? eligible : approved;

  const neverPosted = pool.filter((i) => !i.last_posted_at);
  if (neverPosted.length) return neverPosted[0];

  if (scoreById) {
    return [...pool].sort(
      (a, b) => (scoreById[b.id] ?? 0) - (scoreById[a.id] ?? 0) || ts(a) - ts(b)
    )[0];
  }

  return [...pool].sort((a, b) => ts(a) - ts(b))[0];
}
