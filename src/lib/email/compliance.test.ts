import { describe, it, expect } from "vitest";
import { emailLintText, lintEmail } from "./compliance";

describe("lintEmail", () => {
  it("passes ordinary desk copy", () => {
    expect(lintEmail("The desk posts its read on gold every trading morning.").verdict).toBe("pass");
  });

  it("blocks the claims the brain's gate blocks", () => {
    for (const s of [
      "results guaranteed",
      "a risk-free trial",
      "double your account",
      "consistent monthly returns",
      "a 70% win rate",
      "earn $500 a week",
      "ask for our IB link",
      "rebates on every lot",
    ]) {
      expect(lintEmail(s).verdict, s).toBe("block");
    }
  });

  it("blocks pressure framing, which the brain's public gate does not cover", () => {
    for (const s of ["Last chance to join", "hurry, the trial ends", "Your trial expires tonight", "act now", "only 3 spots left"]) {
      const r = lintEmail(s);
      expect(r.verdict, s).toBe("block");
      expect(r.hits.some((h) => h.rule === "pressure"), s).toBe(true);
    }
  });

  it("holds results language for review rather than blocking it", () => {
    const r = lintEmail("All three targets paid.");
    expect(r.verdict).toBe("review");
    expect(r.hits[0].rule).toBe("results_paid");
  });

  it("does not lint what only lives in markup", () => {
    expect(emailLintText('<p><a href="https://x.test/?guaranteed=1">Open it</a></p>')).toBe("Open it");
  });
});
