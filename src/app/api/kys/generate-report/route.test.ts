import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAccessMock, rpcMock, createMock, localeMock } = vi.hoisted(() => ({
  getAccessMock: vi.fn(),
  rpcMock: vi.fn(),
  createMock: vi.fn(),
  localeMock: vi.fn(),
}));

vi.mock("@/lib/access", () => ({ getAccess: getAccessMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));
// Never the real API: the model's reply is whatever the test hands back.
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));
vi.mock("@/i18n/server", async () => {
  const { messagesFor } = await vi.importActual<typeof import("@/i18n/server")>("@/i18n/server");
  return { getLocale: localeMock, messagesFor };
});

import { POST } from "./route";
import { reportHeadings, staticSystemPrompt } from "@/lib/kys/prompt";
import { MESSAGES } from "@/i18n/messages";
import type { Locale } from "@/i18n/config";

// The same answers for every question: option "a" exists on all fourteen.
const ANSWERS = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`q${i + 1}`, "a"]));

function req(body: unknown) {
  return new Request("https://app.test/api/kys/generate-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function modelReport(locale: Locale): string {
  const body =
    locale === "en"
      ? "This is body text that pads the report to a realistic length so the word count gate passes cleanly. ".repeat(6)
      : "你说你通常因为想有单在手而入场，这说明你的问题不在于知识，而在于决策。".repeat(7);
  return [...reportHeadings(locale).map((h) => `## ${h}\n${body}`), `---\n*${MESSAGES[locale].kysReport.footer}*`].join("\n\n");
}

beforeEach(() => {
  getAccessMock.mockReset().mockResolvedValue({
    signedIn: true,
    profile: { id: "u1", email: "me@example.com", is_admin: false },
    memberTier: "free",
  });
  rpcMock.mockReset().mockResolvedValue({ error: null });
  createMock.mockReset();
  localeMock.mockReset();
});

describe("POST /api/kys/generate-report", () => {
  it("writes an English report exactly as before", async () => {
    localeMock.mockResolvedValue("en");
    createMock.mockResolvedValue({ content: [{ type: "text", text: modelReport("en") }] });

    const res = await POST(req({ answers: ANSWERS }));
    expect(res.status).toBe(200);
    const call = createMock.mock.calls[0][0];
    expect(call.system[0].text).toBe(staticSystemPrompt("en"));
    expect(call.max_tokens).toBe(1500);
    const json = await res.json();
    expect(json.report_text).toBe(modelReport("en"));
  });

  it("writes the report in the reader's language, and saves it with both footers", async () => {
    localeMock.mockResolvedValue("zh-Hans");
    createMock.mockResolvedValue({ content: [{ type: "text", text: modelReport("zh-Hans") }] });

    const res = await POST(req({ answers: ANSWERS }));
    expect(res.status).toBe(200);
    expect(createMock).toHaveBeenCalledTimes(1); // valid first time: no retry
    const call = createMock.mock.calls[0][0];
    expect(call.system[0].text).toBe(staticSystemPrompt("zh-Hans"));
    expect(call.system[1].text).toContain("Write it in Simplified Chinese");
    expect(call.max_tokens).toBe(3500);

    const json = await res.json();
    expect(json.report_text.endsWith(`*${MESSAGES.en.kysReport.footer}*`)).toBe(true);
    expect(json.moves[0].label).toBe(MESSAGES["zh-Hans"].archetypes[json.archetype as "news_trader"].keystoneLabel);
    // The profile row gets the archetype ID and the finished report.
    expect(rpcMock).toHaveBeenCalledWith("fn_save_kys_result", {
      p_archetype: json.archetype,
      p_dimensions: json.dimensions,
      p_report: json.report_text,
    });
  });

  it("retries on the stronger model when the first report is in the wrong language", async () => {
    localeMock.mockResolvedValue("zh-Hans");
    createMock
      .mockResolvedValueOnce({ content: [{ type: "text", text: modelReport("en") }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: modelReport("zh-Hans") }] });

    const res = await POST(req({ answers: ANSWERS }));
    expect(res.status).toBe(200);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock.mock.calls[1][0].model).not.toBe(createMock.mock.calls[0][0].model);
  });

  it("fails cleanly when neither model writes a valid report", async () => {
    localeMock.mockResolvedValue("ms");
    createMock.mockResolvedValue({ content: [{ type: "text", text: "## Bacaan\nterlalu pendek" }] });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(req({ answers: ANSWERS }));
    expect(res.status).toBe(502);
    expect(rpcMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
