import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceClientMock, partnerDbMock, sendEmailMock } = vi.hoisted(() => ({
  serviceClientMock: vi.fn(),
  partnerDbMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));
vi.mock("@/lib/partners/client", () => ({ partnerDb: partnerDbMock }));
vi.mock("@/lib/sendpulse", () => ({ sendEmail: sendEmailMock }));

import { NextRequest } from "next/server";
import { GET, parseSender } from "./route";

const ROWS = [
  {
    week: "2026-09-14",
    label: "Gold Hook 03",
    signups: 40,
    activated: 22,
    funded: 3,
    deposit_total: 1500,
    first_touch_signups: 38,
    first_touch_funded: 4,
  },
];

type Partner = { slug: string; name: string; report_email: string | null };

let rpc: ReturnType<typeof vi.fn>;

function stub(partners: Partner[], readError: { message: string } | null = null) {
  serviceClientMock.mockReturnValue({
    from: () => ({
      select: () => ({ eq: async () => ({ data: readError ? null : partners, error: readError }) }),
    }),
  });
  rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    void fn;
    void args;
    return { data: ROWS, error: null };
  });
  partnerDbMock.mockReturnValue({ rpc });
}

function req(auth?: string) {
  return new NextRequest("https://app.test/api/cron/partner-weekly", {
    headers: auth ? { authorization: auth } : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  sendEmailMock.mockResolvedValue({ ok: true, id: "sp-1" });
});

describe("GET /api/cron/partner-weekly", () => {
  it("refuses an unauthenticated call", async () => {
    stub([]);
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("refuses everything when no CRON_SECRET is configured", async () => {
    delete process.env.CRON_SECRET;
    stub([]);
    expect((await GET(req("Bearer undefined"))).status).toBe(401);
  });

  it("sends one report per active partner that has an address", async () => {
    stub([{ slug: "ren", name: "Ren", report_email: "ops@ren.example" }]);
    const res = await GET(req("Bearer s3cret"));
    expect(await res.json()).toEqual({ sent: 1, failed: 0, skipped: 0 });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const mail = sendEmailMock.mock.calls[0][0];
    expect(mail.to).toEqual({ name: "Ren", email: "ops@ren.example" });
    expect(mail.subject).toContain("Ren");
    expect(mail.html).toContain("PARTNER REPORT");
    expect(mail.text).toContain("Gold Hook 03");
  });

  it("asks for seven days on the rule the contract pays on", async () => {
    stub([{ slug: "ren", name: "Ren", report_email: "ops@ren.example" }]);
    await GET(req("Bearer s3cret"));
    const args = rpc.mock.calls[0][1] as Record<string, string>;
    expect(args.p_slug).toBe("ren");
    expect(args.p_rule).toBe("last_paid_7d");
    const span = Date.parse(args.p_until) - Date.parse(args.p_since);
    expect(span).toBe(7 * 86_400_000);
  });

  it("skips a partner with no address, so the job is safe to schedule early", async () => {
    stub([
      { slug: "ren", name: "Ren", report_email: null },
      { slug: "other", name: "Other", report_email: "   " },
    ]);
    const res = await GET(req("Bearer s3cret"));
    expect(await res.json()).toEqual({ sent: 0, skipped: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("counts a failed send without losing the other partners", async () => {
    stub([
      { slug: "ren", name: "Ren", report_email: "ops@ren.example" },
      { slug: "two", name: "Two", report_email: "ops@two.example" },
    ]);
    sendEmailMock.mockResolvedValueOnce({ ok: false, detail: "bounced" });
    const res = await GET(req("Bearer s3cret"));
    expect(await res.json()).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("answers 500 when the partner read itself fails", async () => {
    stub([], { message: "denied" });
    expect((await GET(req("Bearer s3cret"))).status).toBe(500);
  });
});

describe("parseSender", () => {
  it("reads a Name <address> pair", () => {
    expect(parseSender("Desk <desk@marketmakersfx.net>")).toEqual({
      name: "Desk",
      email: "desk@marketmakersfx.net",
    });
  });

  it("falls back to the house address", () => {
    expect(parseSender(undefined).email).toBe("hello@marketmakersfx.net");
    expect(parseSender("   ").email).toBe("hello@marketmakersfx.net");
  });
});
