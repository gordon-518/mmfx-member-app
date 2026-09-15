// The review queue's amount box (Gordon, 15 Sep). The admin verifies the
// amount the broker actually shows, which can differ from what the member
// typed. Blank means "what they submitted". The database enforces the $50
// minimum again (fn_review_deposit_submission / fn_verify_deposit); this just
// gives the admin a clear message before the round trip.

export type ReviewAmount = { ok: true; amount: number } | { ok: false; error: string };

const MAX_REVIEW_AMOUNT = 1_000_000;

export function parseReviewAmount(raw: string | null | undefined, submitted: number): ReviewAmount {
  const cleaned = (raw ?? "").trim().replace(/[$,\s]/g, "");
  if (cleaned === "") return { ok: true, amount: submitted };

  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false, error: "Enter the amount as a number, e.g. 159.32" };
  if (n < 50) return { ok: false, error: "The minimum deposit is $50" };
  if (n > MAX_REVIEW_AMOUNT) return { ok: false, error: "That amount looks too large. Check it and try again." };
  return { ok: true, amount: Math.round(n * 100) / 100 };
}
