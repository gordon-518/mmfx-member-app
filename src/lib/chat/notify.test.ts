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

describe("defaultNotify", () => {
  beforeEach(() => {
    sendTelegram.mockClear();
    sendAdminAlert.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("pings the support chat and emails the admin in production, escaping the member's words", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPPORT_PING_CHAT_ID", "-100123");
    await defaultNotify({ member, question: "<b>where is my money?</b>", reason: "missing or pending funds" });
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    const [html, opts] = sendTelegram.mock.calls[0];
    expect(opts.chatId).toBe("-100123");
    expect(html).toContain("&lt;b&gt;where is my money?&lt;/b&gt;");
    expect(html).toContain(`/admin/chat?user=${member.userId}`);
    expect(sendAdminAlert).toHaveBeenCalledWith("In-app chat: missing or pending funds", expect.stringContaining("m@example.com"));
  });

  it("never falls back to another chat when the support chat isn't configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPPORT_PING_CHAT_ID", "");
    await defaultNotify({ member, question: "hi", reason: "x" });
    expect(sendTelegram).not.toHaveBeenCalled();
    expect(sendAdminAlert).toHaveBeenCalledTimes(1);
  });

  it("sends nothing outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SUPPORT_PING_CHAT_ID", "-100123");
    await defaultNotify({ member, question: "hi", reason: "x" });
    expect(sendTelegram).not.toHaveBeenCalled();
    expect(sendAdminAlert).not.toHaveBeenCalled();
  });

  it("trims a long question for the alert", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPPORT_PING_CHAT_ID", "-100123");
    await defaultNotify({ member, question: "a".repeat(500), reason: "x" });
    expect(sendAdminAlert.mock.calls[0][1]).toContain(`${"a".repeat(300)}…`);
  });
});
