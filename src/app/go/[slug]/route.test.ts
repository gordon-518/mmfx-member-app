import { describe, it, expect, vi, beforeEach } from "vitest";

const { adminDbMock, rpcMock } = vi.hoisted(() => ({ adminDbMock: vi.fn(), rpcMock: vi.fn() }));
vi.mock("@/lib/channel/db", () => ({ adminDb: adminDbMock }));

import { GET } from "./route";

function ctx(slug: string) { return { params: Promise.resolve({ slug }) }; }

beforeEach(() => {
  adminDbMock.mockReset(); rpcMock.mockReset();
  rpcMock.mockResolvedValue({ error: null });
  adminDbMock.mockReturnValue({ rpc: rpcMock });
});

describe("GET /go/[slug]", () => {
  it("302-redirects an allowlisted slug with UTM and logs the click", async () => {
    const res = await GET(new Request("https://app.test/go/signup?p=post-1"), ctx("signup"));
    expect(res.status).toBe(302);
    const loc = res.headers.get("location")!;
    expect(loc).toContain("https://app.marketmakersfx.net/signup");
    expect(loc).toContain("utm_source=telegram");
    expect(loc).toContain("utm_content=post-1");
    expect(rpcMock).toHaveBeenCalledWith("increment_post_clicks", { post_id: "post-1" });
  });

  it("404s an unknown slug and never redirects", async () => {
    const res = await GET(new Request("https://app.test/go/evil?p=x"), ctx("evil"));
    expect(res.status).toBe(404);
  });

  it("still redirects when no post id is present", async () => {
    const res = await GET(new Request("https://app.test/go/indicators"), ctx("indicators"));
    expect(res.status).toBe(302);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("external destination: logs the click but redirects clean (no UTM appended)", async () => {
    const res = await GET(new Request("https://app.test/go/teammm?p=post-9"), ctx("teammm"));
    expect(res.status).toBe(302);
    const loc = res.headers.get("location")!;
    expect(loc).toBe("https://t.me/m/FtwoPlcaMjFl");   // deep link left intact
    expect(loc).not.toContain("utm_");
    expect(rpcMock).toHaveBeenCalledWith("increment_post_clicks", { post_id: "post-9" });
  });

  it("appends the ORG-tg cid to app destinations and stamps the attribution cookie", async () => {
    const res = await GET(new Request("https://app.test/go/signup?p=post-1"), ctx("signup"));
    const loc = res.headers.get("location")!;
    expect(loc).toContain(`cid=${encodeURIComponent("ORG-tg-signup.post-1")}`);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toContain("mmfx_attr=");
    const value = decodeURIComponent(setCookie.match(/mmfx_attr=([^;]+)/)![1]);
    const attr = JSON.parse(value);
    expect(attr.cid).toBe("ORG-tg-signup.post-1");
    expect(attr.feature).toBe("signup");
    expect(typeof attr.ts).toBe("number");
  });

  it("without a post id, the cid is the bare slug form", async () => {
    const res = await GET(new Request("https://app.test/go/upgrade"), ctx("upgrade"));
    expect(res.headers.get("location")).toContain(`cid=${encodeURIComponent("ORG-tg-upgrade")}`);
  });

  it("never overwrites an existing cid (first touch keeps the credit)", async () => {
    const existing = encodeURIComponent(JSON.stringify({ cid: "CRT-meta-ad-7", fbclid: "fb.1" }));
    const res = await GET(
      new Request("https://app.test/go/signup?p=post-1", { headers: { cookie: `mmfx_attr=${existing}` } }),
      ctx("signup")
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("fills in a cookie that has fields but no cid, preserving them", async () => {
    const existing = encodeURIComponent(JSON.stringify({ geo: "MY", fbclid: "fb.2" }));
    const res = await GET(
      new Request("https://app.test/go/signup?p=post-1", { headers: { cookie: `mmfx_attr=${existing}` } }),
      ctx("signup")
    );
    const value = decodeURIComponent(res.headers.get("set-cookie")!.match(/mmfx_attr=([^;]+)/)![1]);
    const attr = JSON.parse(value);
    expect(attr.cid).toBe("ORG-tg-signup.post-1");
    expect(attr.geo).toBe("MY");
    expect(attr.fbclid).toBe("fb.2");
  });

  it("stamps the cookie on external destinations too", async () => {
    const res = await GET(new Request("https://app.test/go/teammm?p=post-9"), ctx("teammm"));
    expect(res.headers.get("set-cookie")).toContain("mmfx_attr=");
  });
});
