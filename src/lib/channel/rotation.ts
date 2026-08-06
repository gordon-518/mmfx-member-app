import type { LibraryItem, VisualItem } from "@/lib/channel/types";

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

// Least-recently-used pick from the reusable visual pool, avoiding the N most
// recently used so the same image doesn't reappear back-to-back. Prefers a
// never-used image first. Returns null when there are no active visuals (the
// post then goes out text-only).
//
// When `preferTag` is given (the post's feature slug), only visuals tagged for
// that feature are considered — so an Indicators CTA gets an indicators
// creative, not a generic gold bar. Falls back to untagged/'generic' visuals,
// and finally to the whole pool, so a feature with no artwork still gets an
// image rather than nothing.
export function pickVisual(
  visuals: VisualItem[],
  avoidLastN: number,
  preferTag?: string | null
): VisualItem | null {
  const allActive = visuals.filter((v) => v.status === "active");
  if (allActive.length === 0) return null;

  let active = allActive;
  if (preferTag) {
    const matched = allActive.filter((v) => v.tag === preferTag);
    const generic = allActive.filter((v) => !v.tag || v.tag === "generic");
    active = matched.length ? matched : generic.length ? generic : allActive;
  }

  const ts = (v: VisualItem) => (v.last_used_at ? Date.parse(v.last_used_at) : -1);

  const recentlyUsed = new Set(
    [...active]
      .filter((v) => v.last_used_at)
      .sort((a, b) => ts(b) - ts(a))
      .slice(0, avoidLastN)
      .map((v) => v.id)
  );

  const eligible = active.filter((v) => !recentlyUsed.has(v.id));
  const pool = eligible.length ? eligible : active;

  const neverUsed = pool.filter((v) => !v.last_used_at);
  if (neverUsed.length) return neverUsed[0];

  return [...pool].sort((a, b) => ts(a) - ts(b))[0];
}
