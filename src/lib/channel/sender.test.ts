import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendChannelText, sendChannelPhoto, sendApproverDM } from "@/lib/channel/sender";

function okResponse(messageId = 42) {
  return new Response(JSON.stringify({ ok: true, result: { message_id: messageId } }), { status: 200 });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.CHANNEL_BOT_TOKEN = "TESTTOKEN";
  process.env.CHANNEL_CHAT_ID = "-100999";
  process.env.APPROVER_CHAT_ID = "555";
});

describe("channel sender", () => {
  it("sendChannelText posts HTML to the channel and returns the message id", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => okResponse(7));
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendChannelText("<b>hi</b>");
    expect(res.ok).toBe(true);
    expect(res.messageId).toBe(7);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/botTESTTOKEN/sendMessage");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.chat_id).toBe("-100999");
    expect(body.parse_mode).toBe("HTML");
  });

  it("sendChannelPhoto passes photo + caption", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => okResponse());
    vi.stubGlobal("fetch", fetchMock);
    await sendChannelPhoto("https://img/x.png", "cap");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.photo).toBe("https://img/x.png");
    expect(body.caption).toBe("cap");
  });

  it("sendApproverDM targets the approver and includes the inline keyboard", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => okResponse());
    vi.stubGlobal("fetch", fetchMock);
    await sendApproverDM("hey", [[{ text: "OK", callback_data: "approve:1" }]]);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.chat_id).toBe("555");
    expect(body.reply_markup.inline_keyboard[0][0].callback_data).toBe("approve:1");
  });

  it("returns ok:false when the token is missing", async () => {
    delete process.env.CHANNEL_BOT_TOKEN;
    const res = await sendChannelText("x");
    expect(res.ok).toBe(false);
  });
});
