import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be hoisted above the route import.
const { getAccessMock, sendEmailMock, addContactToBookMock } = vi.hoisted(() => ({
  getAccessMock: vi.fn(),
  sendEmailMock: vi.fn(),
  addContactToBookMock: vi.fn(),
}));

vi.mock("@/lib/access", () => ({ getAccess: getAccessMock }));
vi.mock("@/lib/sendpulse", () => ({
  sendEmail: sendEmailMock,
  addContactToBook: addContactToBookMock,
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://app.test/api/fundamental/send-copy", {
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

function stubPdfOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
  );
}

beforeEach(() => {
  getAccessMock.mockReset();
  sendEmailMock.mockReset();
  addContactToBookMock.mockReset();
  process.env.SENDPULSE_FA_BOOK_ID = "book123";
  vi.unstubAllGlobals();
});

describe("POST /api/fundamental/send-copy", () => {
  it("unauthenticated → 401", async () => {
    getAccessMock.mockResolvedValue({ signedIn: false });
    const res = await POST(req({ instrument: "XAUUSD" }));
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
    const res = await POST(req({ instrument: "XAUUSD" }));
    expect(res.status).toBe(401);
  });

  it("admin (non-Full tier) is authorized", async () => {
    getAccessMock.mockResolvedValue({
      signedIn: true,
      profile: { email: "admin@example.com", full_name: "Admin", is_admin: true },
      tier: "Limited",
      daysLeft: 0,
    });
    stubPdfOk();
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });
    const res = await POST(req({ instrument: "XAUUSD" }));
    expect(res.status).toBe(200);
    expect(sendEmailMock.mock.calls[0][0].to.email).toBe("admin@example.com");
  });

  it("bad instrument → 400", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    const res = await POST(req({ instrument: "FOO" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad_instrument" });
  });

  it("prototype key is not a valid instrument → 400", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    const res = await POST(req({ instrument: "constructor" }));
    expect(res.status).toBe(400);
  });

  it("happy path → recipient is the session email, attachment present, ok:true", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    stubPdfOk();
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });

    const res = await POST(req({ instrument: "XAUUSD" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.to.email).toBe("me@example.com"); // session email, never client-supplied
    expect(arg.from.email).toBe("hello@marketmakersfx.net");
    expect(arg.subject).toContain("XAU/USD");
    expect(arg.attachments).toHaveLength(1);
    expect(arg.attachments[0].name).toBe("xauusd_thesis.pdf");
    expect(typeof arg.attachments[0].contentBase64).toBe("string");
  });

  it("PDF fetch failure → 502, no email sent", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 }))
    );
    const res = await POST(req({ instrument: "XAUUSD" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, reason: "pdf_unavailable" });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("send failure → 500", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    stubPdfOk();
    sendEmailMock.mockResolvedValue({ ok: false, detail: "boom" });
    const res = await POST(req({ instrument: "EURUSD" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, reason: "send_failed" });
    expect(addContactToBookMock).not.toHaveBeenCalled(); // never tag on a failed send
  });

  it("on success, also tags the contact with the session email + instrument", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    stubPdfOk();
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });
    addContactToBookMock.mockResolvedValue({ ok: true, detail: {} });

    const res = await POST(req({ instrument: "XAUUSD" }));
    expect(res.status).toBe(200);

    expect(addContactToBookMock).toHaveBeenCalledTimes(1);
    const [book, email, vars] = addContactToBookMock.mock.calls[0];
    expect(book).toBe("book123");
    expect(email).toBe("me@example.com"); // same Supabase session email as the email
    expect(vars.fa_last_instrument).toBe("XAUUSD");
    expect(vars.fa_last_used).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("tagging that REJECTS never blocks the email — still ok:true", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    stubPdfOk();
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });
    addContactToBookMock.mockRejectedValue(new Error("tagging down"));

    const res = await POST(req({ instrument: "XAUUSD" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("tagging that returns ok:false still returns ok:true", async () => {
    getAccessMock.mockResolvedValue(fullMember);
    stubPdfOk();
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });
    addContactToBookMock.mockResolvedValue({ ok: false, detail: "nope" });

    const res = await POST(req({ instrument: "BTCUSD" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("skips tagging entirely when SENDPULSE_FA_BOOK_ID is unset", async () => {
    delete process.env.SENDPULSE_FA_BOOK_ID;
    getAccessMock.mockResolvedValue(fullMember);
    stubPdfOk();
    sendEmailMock.mockResolvedValue({ ok: true, detail: {} });

    const res = await POST(req({ instrument: "XAUUSD" }));
    expect(res.status).toBe(200);
    expect(addContactToBookMock).not.toHaveBeenCalled();
  });
});
