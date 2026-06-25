import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, addContactToBook } from "./sendpulse";

describe("sendEmail", () => {
  beforeEach(() => {
    process.env.SENDPULSE_API_ID = "id";
    process.env.SENDPULSE_API_SECRET = "secret";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts base64 html + attachment keyed by filename to /smtp/emails", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/oauth/access_token")) {
        return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendEmail({
      to: { name: "U", email: "u@example.com" },
      from: { name: "F", email: "f@example.com" },
      subject: "Hi",
      html: "<p>Body</p>",
      attachments: [{ name: "thesis.pdf", contentBase64: "QUJD" }],
    });

    expect(res.ok).toBe(true);

    const smtp = calls.find((c) => c.url.includes("/smtp/emails"));
    expect(smtp).toBeTruthy();
    const payload = JSON.parse(String(smtp!.init.body));

    // html is base64-encoded
    expect(payload.email.html).toBe(
      Buffer.from("<p>Body</p>", "utf8").toString("base64")
    );
    // attachment keyed by filename
    expect(payload.email.attachments_binary).toEqual({ "thesis.pdf": "QUJD" });
    // recipient + sender threaded through
    expect(payload.email.to).toEqual([{ name: "U", email: "u@example.com" }]);
    expect(payload.email.from).toEqual({ name: "F", email: "f@example.com" });
    // authorized with the bearer token from the OAuth step
    expect((smtp!.init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok"
    );
  });

  it("returns ok:false when SendPulse credentials are absent", async () => {
    delete process.env.SENDPULSE_API_ID;
    delete process.env.SENDPULSE_API_SECRET;
    const res = await sendEmail({
      to: { name: "U", email: "u@example.com" },
      from: { name: "F", email: "f@example.com" },
      subject: "Hi",
      html: "<p>x</p>",
    });
    expect(res.ok).toBe(false);
  });
});

describe("addContactToBook", () => {
  beforeEach(() => {
    process.env.SENDPULSE_API_ID = "id";
    process.env.SENDPULSE_API_SECRET = "secret";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to /addressbooks/{book}/emails with emails[].variables", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/oauth/access_token")) {
        return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await addContactToBook("book123", "u@example.com", {
      fa_last_used: "2026-06-22",
      fa_last_instrument: "XAUUSD",
    });

    expect(res.ok).toBe(true);
    const call = calls.find((c) => c.url.includes("/addressbooks/book123/emails"));
    expect(call).toBeTruthy();
    expect(JSON.parse(String(call!.init.body))).toEqual({
      emails: [
        {
          email: "u@example.com",
          variables: { fa_last_used: "2026-06-22", fa_last_instrument: "XAUUSD" },
        },
      ],
    });
  });
});
