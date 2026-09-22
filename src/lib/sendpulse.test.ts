import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, addContactToBook, _resetSendpulseTokenCache } from "./sendpulse";

describe("sendEmail", () => {
  beforeEach(() => {
    process.env.SENDPULSE_API_ID = "id";
    process.env.SENDPULSE_API_SECRET = "secret";
    _resetSendpulseTokenCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mailParams = {
    to: { name: "U", email: "u@example.com" },
    from: { name: "F", email: "f@example.com" },
    subject: "Hi",
    html: "<p>Body</p>",
  };

  it("fetches the OAuth token once and reuses it across a batch", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        if (url.includes("/oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: true }), { status: 200 });
      })
    );

    await sendEmail(mailParams);
    await sendEmail(mailParams);
    await sendEmail(mailParams);

    expect(urls.filter((u) => u.includes("/oauth/access_token"))).toHaveLength(1);
    expect(urls.filter((u) => u.includes("/smtp/emails"))).toHaveLength(3);
  });

  it("refreshes a cached token SendPulse rejects with 401, once", async () => {
    let issued = 0;
    const bearers: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.includes("/oauth/access_token")) {
          issued += 1;
          return new Response(JSON.stringify({ access_token: `tok${issued}` }), { status: 200 });
        }
        const b = (init.headers as Record<string, string>).Authorization;
        bearers.push(b);
        if (b === "Bearer tok1" && bearers.length > 1) {
          return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
        }
        return new Response(JSON.stringify({ result: true }), { status: 200 });
      })
    );

    expect((await sendEmail(mailParams)).ok).toBe(true); // tok1, fresh
    const second = await sendEmail(mailParams); // cached tok1 → 401 → tok2
    expect(second.ok).toBe(true);
    expect(issued).toBe(2);
    expect(bearers).toEqual(["Bearer tok1", "Bearer tok1", "Bearer tok2"]);
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

  it("passes List-Unsubscribe headers through onto the email object", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (url.includes("/oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: true }), { status: 200 });
      })
    );

    await sendEmail({
      to: { name: "U", email: "u@example.com" },
      from: { name: "F", email: "f@example.com" },
      subject: "Hi",
      html: "<p>Body</p>",
      headers: {
        "List-Unsubscribe": "<https://app.test/api/email/unsubscribe?token=t>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    const smtp = calls.find((c) => c.url.includes("/smtp/emails"));
    expect(JSON.parse(String(smtp!.init.body)).email.headers).toEqual({
      "List-Unsubscribe": "<https://app.test/api/email/unsubscribe?token=t>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("omits the headers field entirely when a caller passes none", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (url.includes("/oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: true }), { status: 200 });
      })
    );

    await sendEmail({
      to: { name: "U", email: "u@example.com" },
      from: { name: "F", email: "f@example.com" },
      subject: "Hi",
      html: "<p>Body</p>",
    });

    const smtp = calls.find((c) => c.url.includes("/smtp/emails"));
    expect(JSON.parse(String(smtp!.init.body)).email).not.toHaveProperty("headers");
  });

  it("returns SendPulse's send id, the join key for every webhook event", async () => {
    // {"result":true,"id":"tlr7m5-1bve4z-ik"} — email_sends.provider_id.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/oauth/access_token")
          ? new Response(JSON.stringify({ access_token: "tok" }), { status: 200 })
          : new Response(JSON.stringify({ result: true, id: "tlr7m5-1bve4z-ik" }), { status: 200 })
      )
    );
    const res = await sendEmail(mailParams);
    expect(res.ok).toBe(true);
    expect(res.id).toBe("tlr7m5-1bve4z-ik");
  });

  it("stringifies a numeric id — the KB shows one, the API returns strings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/oauth/access_token")
          ? new Response(JSON.stringify({ access_token: "tok" }), { status: 200 })
          : new Response(JSON.stringify({ result: true, id: 481516 }), { status: 200 })
      )
    );
    expect((await sendEmail(mailParams)).id).toBe("481516");
  });

  it("has no id when SendPulse returns none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/oauth/access_token")
          ? new Response(JSON.stringify({ access_token: "tok" }), { status: 200 })
          : new Response(JSON.stringify({ result: true }), { status: 200 })
      )
    );
    expect((await sendEmail(mailParams)).id).toBeUndefined();
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
    _resetSendpulseTokenCache();
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
