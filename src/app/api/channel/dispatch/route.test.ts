import { describe, it, expect, vi, beforeEach } from "vitest";

const { adminDbMock, sendTextMock, sendPhotoMock } = vi.hoisted(() => ({
  adminDbMock: vi.fn(),
  sendTextMock: vi.fn(),
  sendPhotoMock: vi.fn(),
}));
vi.mock("@/lib/channel/db", () => ({ adminDb: adminDbMock }));
vi.mock("@/lib/channel/sender", () => ({
  sendChannelText: sendTextMock,
  sendChannelPhoto: sendPhotoMock,
}));

import { POST } from "./route";

function req(auth = "Bearer testsecret") {
  return new Request("https://app.test/api/channel/dispatch", {
    method: "POST",
    headers: { Authorization: auth },
  });
}

// Minimal chainable Supabase stub. `queued` = the rows returned by the select;
// `claim` = what the queued→posting update returns (non-empty = we won the row).
function stubDb({ queued, claim }: { queued: unknown[]; claim: unknown[] }) {
  const updates: Record<string, unknown>[] = [];
  const api = {
    from() { return api; },
    select() { return api; },
    eq() { return api; },
    lte() { return api; },
    order() { return api; },
    limit() { return Promise.resolve({ data: queued }); },
    update(payload: Record<string, unknown>) {
      updates.push(payload);
      const isClaim = payload.status === "posting";
      return {
        eq() { return this; },
        select() { return Promise.resolve({ data: isClaim ? claim : [] }); },
        then(res: (v: { data: unknown[] }) => void) { return Promise.resolve({ data: [] }).then(res); },
      };
    },
    _updates: updates,
  };
  return api;
}

beforeEach(() => {
  adminDbMock.mockReset(); sendTextMock.mockReset(); sendPhotoMock.mockReset();
  process.env.CHANNEL_CRON_SECRET = "testsecret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supa.test";
});

describe("POST /api/channel/dispatch", () => {
  it("rejects a bad secret with 401", async () => {
    const res = await POST(req("Bearer wrong") as never);
    expect(res.status).toBe(401);
  });

  it("posts a text row and marks it posted", async () => {
    const row = { id: "r1", kind: "library", status: "queued", body: "**hi**",
      image_url: null, link_url: null, attempts: 0 };
    const db = stubDb({ queued: [row], claim: [{ id: "r1" }] });
    adminDbMock.mockReturnValue(db);
    sendTextMock.mockResolvedValue({ ok: true, messageId: 9 });

    const res = await POST(req() as never);
    expect(res.status).toBe(200);
    expect(sendTextMock).toHaveBeenCalledOnce();
    expect(sendTextMock.mock.calls[0][0]).toContain("<b>hi</b>");
    expect(db._updates.some((u) => u.status === "posted" && u.telegram_message_id === 9)).toBe(true);
  });

  it("uses sendPhoto when image_url is present and appends the link", async () => {
    const row = { id: "r2", kind: "analysis_daily", status: "queued", body: "read",
      image_url: "https://img/c.png", link_url: "https://app.x/daily", attempts: 0 };
    const db = stubDb({ queued: [row], claim: [{ id: "r2" }] });
    adminDbMock.mockReturnValue(db);
    sendPhotoMock.mockResolvedValue({ ok: true, messageId: 3 });

    await POST(req() as never);
    expect(sendPhotoMock).toHaveBeenCalledOnce();
    expect(sendPhotoMock.mock.calls[0][1]).toContain("Full breakdown in the app");
  });

  it("long caption: posts photo then text reply, marks posted with the photo id", async () => {
    const longBody = "x".repeat(1200);
    const row = { id: "r4", kind: "analysis_macro", status: "queued", body: longBody,
      image_url: "https://img/m.png", link_url: null, attempts: 0 };
    const db = stubDb({ queued: [row], claim: [{ id: "r4" }] });
    adminDbMock.mockReturnValue(db);
    sendPhotoMock.mockResolvedValue({ ok: true, messageId: 5 });
    sendTextMock.mockResolvedValue({ ok: true, messageId: 6 });

    await POST(req() as never);
    expect(sendPhotoMock).toHaveBeenCalledOnce();
    expect(sendTextMock.mock.calls[0][1]).toMatchObject({ replyTo: 5 });
    // tracked message id is the photo (the visible post), and it is not re-queued
    expect(db._updates.some((u) => u.status === "posted" && u.telegram_message_id === 5)).toBe(true);
  });

  it("long caption: re-queues (no duplicate) when the photo itself fails", async () => {
    const row = { id: "r5", kind: "analysis_macro", status: "queued", body: "y".repeat(1200),
      image_url: "https://img/m.png", link_url: null, attempts: 0 };
    const db = stubDb({ queued: [row], claim: [{ id: "r5" }] });
    adminDbMock.mockReturnValue(db);
    sendPhotoMock.mockResolvedValue({ ok: false, detail: "photo boom" });

    await POST(req() as never);
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(db._updates.some((u) => u.status === "queued" && u.attempts === 1)).toBe(true);
  });

  it("re-queues a row on send failure and records the error", async () => {
    const row = { id: "r3", kind: "library", status: "queued", body: "x",
      image_url: null, link_url: null, attempts: 0 };
    const db = stubDb({ queued: [row], claim: [{ id: "r3" }] });
    adminDbMock.mockReturnValue(db);
    sendTextMock.mockResolvedValue({ ok: false, detail: "boom" });

    await POST(req() as never);
    expect(db._updates.some((u) => u.status === "queued" && u.attempts === 1)).toBe(true);
  });
});
