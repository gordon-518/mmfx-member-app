import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendTelegram = vi.fn<(html: string, opts: { chatId?: string }) => Promise<{ ok: boolean; detail: unknown }>>(
  async () => ({ ok: true, detail: null })
);
const sendAdminAlert = vi.fn<(subject: string, text: string) => Promise<{ ok: boolean; detail: unknown }>>(
  async () => ({ ok: true, detail: null })
);
vi.mock("@/lib/telegram", () => ({ sendTelegram: (html: string, opts: { chatId?: string }) => sendTelegram(html, opts) }));
vi.mock("@/lib/notify", () => ({ sendAdminAlert: (s: string, t: string) => sendAdminAlert(s, t) }));

import { defaultNotify } from "./run";
import type { ChatMember } from "./types";

const member: ChatMember = {
  userId: "11111111-2222-3333-4444-555555555555", email: "m@example.com", tier: "desk",
  trialEndsAt: null, depositTotal: 200, submission: null, locale: "id",
};

const KEYS = ["SUPPORT_PING_BOT_TOKEN", "SUPPORT_PING_CHAT_ID", "ADMIN_ALERT_BOT_TOKEN", "ADMIN_ALERT_CHAT_ID", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];

describe("defaultNotify", () => {
  beforeEach(() => {
    sendTelegram.mockClear();
    sendAdminAlert.mockClear();
    for (const k of KEYS) vi.stubEnv(k, "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("pings the alert bot and emails the admin in production, with the member's words defused", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_ALERT_BOT_TOKEN", "alert-token");
    vi.stubEnv("ADMIN_ALERT_CHAT_ID", "alert-chat");
    await defaultNotify({ member, question: "<b>where is my money?</b> see https://evil.example/x", reason: "missing or pending funds" });
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    const [html, opts] = sendTelegram.mock.calls[0];
    expect(opts).toEqual({ botToken: "alert-token", chatId: "alert-chat" });
    expect(html).toContain("&lt;b&gt;where is my money?&lt;/b&gt;");
    expect(html).toContain("<code>");
    expect(html).not.toContain("https://evil");
    expect(html).toContain(`/admin/chat?user=${member.userId}`);
    expect(sendAdminAlert).toHaveBeenCalledWith("In-app chat: a member needs a person", expect.stringContaining("m@example.com"));
  });

  it("uses a dedicated support bot when one is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPPORT_PING_BOT_TOKEN", "support-token");
    vi.stubEnv("SUPPORT_PING_CHAT_ID", "-100123");
    vi.stubEnv("ADMIN_ALERT_BOT_TOKEN", "alert-token");
    vi.stubEnv("ADMIN_ALERT_CHAT_ID", "alert-chat");
    await defaultNotify({ member, question: "hi", reason: "x" });
    expect(sendTelegram.mock.calls[0][1]).toEqual({ botToken: "support-token", chatId: "-100123" });
  });

  it("never falls back to the stats bot's chat", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "stats-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "stats-chat");
    await defaultNotify({ member, question: "hi", reason: "x" });
    expect(sendTelegram).not.toHaveBeenCalled();
    expect(sendAdminAlert).toHaveBeenCalledTimes(1);
  });

  it("sends nothing outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_ALERT_BOT_TOKEN", "alert-token");
    vi.stubEnv("ADMIN_ALERT_CHAT_ID", "alert-chat");
    await defaultNotify({ member, question: "hi", reason: "x" });
    expect(sendTelegram).not.toHaveBeenCalled();
    expect(sendAdminAlert).not.toHaveBeenCalled();
  });

  it("trims a long question and a long reason for the alert", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await defaultNotify({ member, question: "a".repeat(500), reason: "r".repeat(400) });
    const body = sendAdminAlert.mock.calls[0][1];
    expect(body).toContain(`${"a".repeat(300)}…`);
    expect(body).toContain(`${"r".repeat(120)}…`);
    expect(body).not.toContain("r".repeat(121));
  });
});
