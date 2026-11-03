import { describe, it, expect } from "vitest";
import { resolveTelegramCredentials, supportPingCredentials } from "./telegramCredentials";

const stats = { TELEGRAM_BOT_TOKEN: "stats-token", TELEGRAM_CHAT_ID: "111" };
const admin = { ADMIN_ALERT_BOT_TOKEN: "alert-token", ADMIN_ALERT_CHAT_ID: "222" };

describe("resolveTelegramCredentials", () => {
  it("uses the stats bot by default when it's configured", () => {
    expect(resolveTelegramCredentials({ ...stats, ...admin })).toEqual({ token: "stats-token", chatId: "111" });
  });

  it("falls back to the alert bot when the stats bot isn't configured (production today)", () => {
    expect(resolveTelegramCredentials(admin)).toEqual({ token: "alert-token", chatId: "222" });
  });

  it("prefers the alert bot for admin alerts, even with the stats bot set", () => {
    expect(resolveTelegramCredentials({ ...stats, ...admin }, { preferAdminBot: true })).toEqual({ token: "alert-token", chatId: "222" });
  });

  it("falls back to the stats bot for admin alerts when the alert bot isn't set", () => {
    expect(resolveTelegramCredentials(stats, { preferAdminBot: true })).toEqual({ token: "stats-token", chatId: "111" });
  });

  it("never mixes one bot's token with another bot's chat", () => {
    expect(resolveTelegramCredentials({ TELEGRAM_BOT_TOKEN: "stats-token", ADMIN_ALERT_CHAT_ID: "222" })).toBeNull();
    expect(resolveTelegramCredentials({ TELEGRAM_CHAT_ID: "111", ADMIN_ALERT_BOT_TOKEN: "alert-token" })).toBeNull();
  });

  it("an explicit pair wins", () => {
    expect(resolveTelegramCredentials({ ...stats, ...admin }, { botToken: "x", chatId: "9" })).toEqual({ token: "x", chatId: "9" });
  });

  it("is null when nothing is configured", () => {
    expect(resolveTelegramCredentials({})).toBeNull();
  });
});

describe("supportPingCredentials", () => {
  it("uses the support pair only when both halves are set", () => {
    expect(supportPingCredentials({ SUPPORT_PING_BOT_TOKEN: "s", SUPPORT_PING_CHAT_ID: "1", ADMIN_ALERT_BOT_TOKEN: "a", ADMIN_ALERT_CHAT_ID: "2" }))
      .toEqual({ token: "s", chatId: "1" });
    expect(supportPingCredentials({ SUPPORT_PING_CHAT_ID: "1", ADMIN_ALERT_BOT_TOKEN: "a", ADMIN_ALERT_CHAT_ID: "2" }))
      .toEqual({ token: "a", chatId: "2" });
  });

  it("never falls back to the stats bot", () => {
    expect(supportPingCredentials({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "3" })).toBeNull();
  });
});
