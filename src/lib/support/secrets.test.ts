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

describe("maskSecrets: the formats members actually paste (security review, 4 Nov)", () => {
  it.each([
    ["password abc123", "password [hidden]"],
    ["Login 51234567\nPassword Abc123", "Login 51234567\nPassword [hidden]"],
    ["PIN 1234", "PIN [hidden]"],
    ["pw: hunter", "pw: [hidden]"],
    ["pass Abc123!", "pass [hidden]"],
    ["password - Xy9z", "password - [hidden]"],
    ["密码 abc123", "密码 [hidden]"],
    ["PIN码是4821", "PIN码是[hidden]"],
    ["口令是Qw8!", "口令是[hidden]"],
    ["passwordnya: Rahasia9", "passwordnya: [hidden]"],
    ["password saya adalah Rahasia9", "password saya adalah [hidden]"],
    ["kata laluan saya ialah Rahsia88", "kata laluan saya ialah [hidden]"],
    ["kata sandi saya adalah Sandi77", "kata sandi saya adalah [hidden]"],
    ["pinnya 4821", "pinnya [hidden]"],
  ])("masks %s", (input, out) => {
    expect(maskSecrets(input)).toBe(out);
  });

  it("masks the whole of a seed or recovery phrase", () => {
    expect(maskSecrets("seed phrase: apple banana cherry date")).toBe("seed phrase: [hidden]");
    expect(maskSecrets("助记词：苹果 香蕉 樱桃")).toBe("助记词：[hidden]");
  });

  it("leaves a reference code alone, so the member can still be found", () => {
    expect(maskSecrets("verification code: MM-1A2B3C")).toBe("verification code: MM-1A2B3C");
  });

  it.each([
    "my password isn't working",
    "my password is wrong",
    "Is there a secret to trading?",
    "密码是对的吗",
    "I passed the test",
  ])("leaves %s alone", (q) => {
    expect(maskSecrets(q)).toBe(q);
  });
});
