import { describe, it, expect, vi, beforeEach } from "vitest";
import { draftLibraryPosts } from "@/lib/channel/draft";

function anthropicReply(text: string) {
  return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.ANTHROPIC_API_KEY = "k";
});

describe("draftLibraryPosts", () => {
  it("parses a JSON array of drafts out of the model text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      anthropicReply('Here you go: [{"kind":"educational","body":"⚜️ **Discipline**"},{"kind":"cta","body":"Try the desk free"}] done')
    ));
    const drafts = await draftLibraryPosts(2);
    expect(drafts).toHaveLength(2);
    expect(drafts[0].kind).toBe("educational");
    expect(drafts[1].kind).toBe("cta");
  });
  it("returns [] when the API key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await draftLibraryPosts(2)).toEqual([]);
  });
  it("returns [] on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect(await draftLibraryPosts(2)).toEqual([]);
  });
  it("defaults an unknown kind to educational", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => anthropicReply('[{"kind":"weird","body":"x"}]')));
    const drafts = await draftLibraryPosts(1);
    expect(drafts[0].kind).toBe("educational");
  });
  it("injects winner examples into the prompt", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => anthropicReply('[{"kind":"cta","body":"x"}]'));
    vi.stubGlobal("fetch", fetchMock);
    await draftLibraryPosts(1, ["WINNER POST ONE"]);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages[0].content).toContain("WINNER POST ONE");
    expect(body.model).toBe("claude-sonnet-5");
  });
});
