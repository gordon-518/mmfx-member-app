import { describe, it, expect } from "vitest";
import { depositVerifiedEmail, depositRejectedEmail, depositDmReminderEmail } from "./depositEmails";

const RISK = "No returns are guaranteed.";
// Whole words: the risk line itself says "returns", so it's stripped first.
const CLAIM = /\b(profits?|profitable|earns?|earnings|income|guaranteed? (?:profit|return))\b/i;

describe("depositVerifiedEmail", () => {
  const e = depositVerifiedEmail({ name: "Alex Rivera", amount: 150, cumulative: 200, tier: "desk", topUp: true });

  it("names the tier, the amount and the running total", () => {
    expect(e.subject).toBe("Verified: you're on Desk");
    expect(e.text).toContain("Hi Alex,");
    expect(e.text).toContain("$150 top-up is verified");
    expect(e.text).toContain("$200 in deposits so far");
  });

  it("carries the risk line and makes no earnings claim", () => {
    expect(e.text).toContain(RISK);
    expect(e.html).toContain(RISK);
    expect(e.text.replace(RISK, "")).not.toMatch(CLAIM);
  });

  it("calls a first deposit a deposit", () => {
    expect(depositVerifiedEmail({ name: null, amount: 60, cumulative: 60, tier: "foundation", topUp: false }).text)
      .toContain("Hi,\n\nYour $60 deposit is verified. You're on Foundation");
  });
});

describe("depositDmReminderEmail", () => {
  const e = depositDmReminderEmail({ name: "Alex Rivera", amount: 120, ref: "MM-9FBDA4" });

  it("asks for the message to Admin Amelia, with the ref prefilled in the chat link", () => {
    expect(e.subject).toBe("One last step for your $120 deposit");
    expect(e.text).toContain("Hi Alex,");
    expect(e.text).toContain("send Admin Amelia a message on Telegram");
    expect(e.text).toContain("https://t.me/MM_3000?text=");
    expect(e.text).toContain(encodeURIComponent("My reference is MM-9FBDA4."));
    expect(e.html).toContain("MM-9FBDA4");
  });

  it("carries the risk line and makes no earnings claim", () => {
    expect(e.text).toContain(RISK);
    expect(e.html).toContain(RISK);
    expect(e.text.replace(RISK, "")).not.toMatch(CLAIM);
  });

  it("escapes the name in HTML", () => {
    expect(depositDmReminderEmail({ name: "<b>Sam</b>", amount: 50, ref: "MM-000000" }).html).toContain("Hi &lt;b&gt;Sam&lt;/b&gt;,");
  });
});

describe("depositRejectedEmail", () => {
  it("shows the reason and escapes it in HTML", () => {
    const e = depositRejectedEmail({ name: "Sam", amount: 100, reason: "Amount <$50> not visible" });
    expect(e.text).toContain("We couldn't verify your $100 deposit yet: Amount <$50> not visible");
    expect(e.html).toContain("Amount &lt;$50&gt; not visible");
    expect(e.html).not.toContain("<$50>");
    expect(e.text.replace(RISK, "")).not.toMatch(CLAIM);
  });
});
