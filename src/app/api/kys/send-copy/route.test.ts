import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAccessMock, sendEmailMock, addContactToBookMock, rpcMock } = vi.hoisted(() => ({
  getAccessMock: vi.fn(),
  sendEmailMock: vi.fn(),
  addContactToBookMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/access", () => ({ getAccess: getAccessMock }));
vi.mock("@/lib/sendpulse", () => ({
  sendEmail: sendEmailMock,
  addContactToBook: addContactToBookMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://app.test/api/kys/send-copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const fullMember = {
  signedIn: true,
  profile: { email: "me@example.com", full_name: "Me", is_admin: false },
  tier: "Full",
  daysLeft: 5,
};

const validBody = {
  archetype: "The Sniper",
  resultHtml: "<html><body><h1>The Sniper</h1></body></html>",
};

beforeEach(() => {
  getAccessMock.mockReset();
  sendEmailMock.mockReset();
  addContactToBookMock.mockReset();
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ error: null });
  process.env.SENDPULSE_KYS_BOOK_ID = "kysbook";
});

describe("POST /api/kys/send-copy", () => {
  it("unauthenticated → 401", async () => {
    getAccessMock.mockResolvedValue({ signedIn: false });
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("signed in but not Full and not admin → 401", async () => {
    getAccessMock.mockResolvedValue({
      signedIn: true,
      profile: { email: "x@example.com", full_name: null, is_admin: false },
      tier: "Limited",
      daysLeft: 0,
    });
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
  });

  it("admin (non-Full tier) is authorized", async () => {
    getAccessMock.mockResolvedValue({
      signedIn: true,
      profile: { email: "admin@example.com", full_name: "Admin", is_admin: true },
      tier: "Limited",
      daysLeft: 0,
    });
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(sendEmailMock.mock.calls[0][0].to.email).toBe("admin@example.com");
  });

  it("missing resultHtml → 400", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    const res = await POST(req({ archetype: "The Sniper" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad_payload" });
  });

  it("empty resultHtml → 400", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    const res = await POST(req({ archetype: "X", resultHtml: "   " }));
    expect(res.status).toBe(400);
  });

  it("happy path → emails session user the result HTML as-is, ok:true", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });

    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.to.email).toBe("me@example.com"); // session email, never the payload
    expect(arg.from.email).toBe("hello@marketmakersfx.net");
    expect(arg.subject).toBe("Your Know Your Style result — The Sniper");
    expect(arg.html).toBe(validBody.resultHtml); // resultHtml used directly
    expect(arg.attachments).toBeUndefined();
  });

  it("also tags the user in the KYS Users book with the archetype", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });
    addContactToBookMock.mockResolvedValue({ ok: true, detail: {} });

    await POST(req(validBody));
    expect(addContactToBookMock).toHaveBeenCalledTimes(1);
    const [book, email, vars] = addContactToBookMock.mock.calls[0];
    expect(book).toBe("kysbook");
    expect(email).toBe("me@example.com");
    expect(vars.kys_archetype).toBe("The Sniper");
    expect(vars.kys_last_used).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("records completion on the profile via fn_mark_kys_completed", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });

    await POST(req(validBody));
    expect(rpcMock).toHaveBeenCalledWith("fn_mark_kys_completed", {
      p_archetype: "The Sniper",
    });
  });

  it("completion-recording failure never blocks the email — still ok:true", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });
    rpcMock.mockRejectedValue(new Error("db down"));
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("does not record completion when the email fails", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    sendEmailMock.mockResolvedValue({ ok: false, detail: "boom" });
    await POST(req(validBody));
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("send failure → 500, no tagging", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    sendEmailMock.mockResolvedValue({ ok: false, detail: "boom" });
    const res = await POST(req(validBody));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, reason: "send_failed" });
    expect(addContactToBookMock).not.toHaveBeenCalled();
  });

  it("tagging failure never blocks the email — still ok:true", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });
    addContactToBookMock.mockRejectedValue(new Error("tagging down"));
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects an oversized HTML body → 400", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    const huge = "<p>" + "x".repeat(300_001) + "</p>";
    const res = await POST(req({ archetype: "X", resultHtml: huge }));
    expect(res.status).toBe(400);
  });
});
