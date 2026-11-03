import { describe, it, expect } from "vitest";
import { maskSecrets, HIDDEN } from "./secrets";

describe("maskSecrets", () => {
  it("hides a password typed with its label, in any of the app's languages", () => {
    expect(maskSecrets("login 1234567 investor pass: Abc12345!")).toBe(`login 1234567 investor pass: ${HIDDEN}`);
    expect(maskSecrets("my password is Hunter2")).toBe(`my password is ${HIDDEN}`);
    expect(maskSecrets("OTP: 482913")).toBe(`OTP: ${HIDDEN}`);
    expect(maskSecrets("kata laluan: rahsia123")).toBe(`kata laluan: ${HIDDEN}`);
    expect(maskSecrets("kata sandi: Rahasia99")).toBe(`kata sandi: ${HIDDEN}`);
    expect(maskSecrets("我的密码是abc123，请帮我看看")).toBe(`我的密码是${HIDDEN}，请帮我看看`);
    expect(maskSecrets("投資者密碼：Xy9!")).toBe(`投資者密碼：${HIDDEN}`);
  });

  it("leaves ordinary questions alone", () => {
    for (const q of [
      "I forgot my password",
      "How do I reset my password?",
      "Where is the investor password in MT5?",
      "我忘记了密码",
      "密码忘了怎么办",
      "我的投资者密码是什么？",
      "密碼重設在哪裡",
      "How do the tiers work?",
    ]) {
      expect(maskSecrets(q)).toBe(q);
    }
  });
});
