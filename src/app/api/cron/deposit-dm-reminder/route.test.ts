import { describe, it, expect, vi, beforeEach } from "vitest";

const { serviceClientMock, sendEmailMock } = vi.hoisted(() => ({
  serviceClientMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));
vi.mock("@/lib/journal/api", () => ({ serviceClient: serviceClientMock }));
vi.mock("@/lib/sendpulse", () => ({ sendEmail: sendEmailMock }));

import { POST } from "./route";
import { EMAIL_MESSAGES } from "@/lib/email/i18n";

const due = [
  { submission_id: "s1", member_id: "u-ms", email: "aminah@example.com", full_name: "Aminah", amount: 120 },
  { submission_id: "s2", member_id: "u-en", email: "wei@example.com", full_name: "Wei", amount: 60 },
];

function db(locales: unknown) {
  return {
    rpc: vi.fn(async (fn: string) =>
      fn === "fn_user_locales" ? locales : { data: due, error: null }
    ),
  };
}

const req = () =>
  new Request("https://app.test/api/cron/deposit-dm-reminder", {
    method: "POST",
    headers: { Authorization: "Bearer secret" },
  });

beforeEach(() => {
  process.env.CRON_SECRET = "secret";
  serviceClientMock.mockReset();
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue({ ok: true });
});

describe("deposit-dm-reminder", () => {
  it("writes each reminder in its member's language, from one lookup", async () => {
    const client = db({ data: [{ user_id: "u-ms", locale: "ms" }], error: null });
    serviceClientMock.mockReturnValue(client);
    const res = await POST(req() as never);
    expect(await res.json()).toEqual({ claimed: 2, sent: 2 });
    expect(client.rpc).toHaveBeenCalledWith("fn_user_locales", { p_ids: ["u-ms", "u-en"] });
    const subjects = sendEmailMock.mock.calls.map((c) => c[0].subject);
    expect(subjects[0]).toBe(EMAIL_MESSAGES.ms.deposit.reminder.subject.replace("{amount}", "$120"));
    expect(subjects[1]).toBe("One last step for your $60 deposit");
  });

  it("still sends, in English, when the lookup fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    serviceClientMock.mockReturnValue(db({ data: null, error: { message: "boom" } }));
    await POST(req() as never);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(sendEmailMock.mock.calls[0][0].subject).toBe("One last step for your $120 deposit");
    spy.mockRestore();
  });
});
