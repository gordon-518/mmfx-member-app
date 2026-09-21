import { describe, it, expect } from "vitest";
import { buildDepositAlert } from "./depositAlert";

const base = {
  email: "ahmad@example.com",
  amount: 59,
  broker: "elev8",
  account: "1022350684",
  tradingview: "Ahmadusmamusa3xa8g",
  telegram: "Ahmadmelafiyah",
  ref: "MM-59844A",
};

describe("buildDepositAlert", () => {
  it("puts the trading account number in the subject, the text and the Telegram message", () => {
    const a = buildDepositAlert(base);
    expect(a.subject).toBe("New deposit: $59.00 · elev8 · account 1022350684");
    expect(a.text).toContain("Trading account: 1022350684");
    expect(a.html).toContain("<code>1022350684</code>");
  });

  it("carries the amount, broker, handle, ref and the review link", () => {
    const a = buildDepositAlert(base);
    expect(a.text).toContain("Amount: $59.00");
    expect(a.text).toContain("Broker: elev8");
    expect(a.text).toContain("Telegram: @Ahmadmelafiyah · ref MM-59844A");
    expect(a.text).toContain("https://app.marketmakersfx.net/admin");
    expect(a.html).toContain("ref <code>MM-59844A</code>");
  });

  it("leaves out TradingView when there isn't one", () => {
    const a = buildDepositAlert({ ...base, tradingview: null });
    expect(a.text).not.toMatch(/TradingView/);
    expect(a.html).not.toMatch(/TradingView/);
  });

  it("escapes HTML in the Telegram message but not the email text", () => {
    const a = buildDepositAlert({ ...base, email: "a<b>&c@x.com" });
    expect(a.html).toContain("a&lt;b&gt;&amp;c@x.com");
    expect(a.text).toContain("a<b>&c@x.com");
  });
});
