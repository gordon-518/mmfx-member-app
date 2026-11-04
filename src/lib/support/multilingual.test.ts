import { describe, it, expect } from "vitest";
import { checkMultilingual } from "./multilingual";

const pending = { depositVerified: false };
const verified = { depositVerified: true };

describe("checkMultilingual: deposit claims", () => {
  it("catches an approval claim on an unverified deposit, in every language", () => {
    for (const reply of [
      "Your deposit has been cleared and Team MM is open.",
      "Your top-up went through.",
      "Deposit Anda sudah disetujui, selamat!",
      "Deposit anda telah diluluskan.",
      "您的入金已批准。",
      "你的入金已經確認，可以開始使用了。",
    ]) {
      expect(checkMultilingual(reply, pending), reply).toContain(
        "says a deposit is approved or credited, but the latest submission isn't verified"
      );
    }
  });

  it("lets the honest 'in review' answer through", () => {
    for (const reply of [
      "Your deposit is still in review. The team emails you once it's approved.",
      "Deposit Anda masih ditinjau. Tim akan mengirim email setelah disetujui.",
      "你的入金还在审核中，一旦通过会通过邮件通知你。",
      "Deposit anda belum diluluskan lagi.",
    ]) {
      expect(checkMultilingual(reply, pending), reply).toEqual([]);
    }
  });

  it("allows the claim when the submission really is verified", () => {
    expect(checkMultilingual("Your deposit has been verified.", verified)).toEqual([]);
  });
});

describe("checkMultilingual: money safe, profits, advice, links", () => {
  it("catches 'your money is safe' and profit promises", () => {
    expect(checkMultilingual("Dana Anda aman bersama kami.", verified)).toContain("says money is safe or protected");
    expect(checkMultilingual("您的资金是安全的。", verified)).toContain("says money is safe or protected");
    expect(checkMultilingual("Anda pasti dapat untung setiap bulan.", verified)).toContain("reads as a profit or return promise");
    expect(checkMultilingual("跟着信号做，稳赚不赔。", verified)).toContain("reads as a profit or return promise");
  });

  it("lets the risk notice through in every language", () => {
    for (const reply of [
      "交易涉及风险，包括可能损失本金。不保证任何回报。",
      "Trading melibatkan risiko. Tidak ada imbal hasil yang dijamin.",
      "Dagangan melibatkan risiko. Tiada pulangan yang dijamin.",
      "Selamat datang! Tahap anda ialah Desk.",
    ]) {
      expect(checkMultilingual(reply, verified), reply).toEqual([]);
    }
  });

  it("catches a price with a buy/sell instruction", () => {
    expect(checkMultilingual("Buy gold at 3,950 with a stop at 3,920.", verified)).toContain(
      "gives a price with a buy/sell instruction (trading advice)"
    );
    expect(checkMultilingual("在 3950 附近做多。", verified)).toContain("gives a price with a buy/sell instruction (trading advice)");
    expect(checkMultilingual("Desk starts at $200, and Team MM at $500.", verified)).toEqual([]);
  });

  it("refuses app links with a query or fragment", () => {
    expect(checkMultilingual("Sign in: https://app.marketmakersfx.net/login?next=https://evil.example", verified)).toContain(
      "links to an app page with a query or fragment; link the page itself"
    );
    expect(checkMultilingual("Open https://app.marketmakersfx.net/indicators", verified)).toEqual([]);
  });
});
