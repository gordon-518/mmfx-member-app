import { describe, it, expect } from "vitest";
import { parseReviewAmount } from "./depositReview";

describe("parseReviewAmount", () => {
  it("blank means the submitted amount", () => {
    expect(parseReviewAmount("", 50.03)).toEqual({ ok: true, amount: 50.03 });
    expect(parseReviewAmount(null, 60)).toEqual({ ok: true, amount: 60 });
  });

  it("takes the amount the admin typed, tolerating $ and commas", () => {
    expect(parseReviewAmount("159.32", 50.03)).toEqual({ ok: true, amount: 159.32 });
    expect(parseReviewAmount(" $1,250 ", 50)).toEqual({ ok: true, amount: 1250 });
  });

  it("rounds to cents", () => {
    expect(parseReviewAmount("100.005", 50)).toEqual({ ok: true, amount: 100.01 });
  });

  it("refuses below $50, non-numbers and silly amounts", () => {
    expect(parseReviewAmount("49.99", 50)).toEqual({ ok: false, error: "The minimum deposit is $50" });
    expect(parseReviewAmount("abc", 50).ok).toBe(false);
    expect(parseReviewAmount("5000000", 50).ok).toBe(false);
  });
});
