import { describe, it, expect } from "vitest";
import { parseAccounts, parseFlows, accountsText, flowsText } from "./settingsForm";

describe("parseAccounts", () => {
  it("reads 'handle | label' lines, dropping @ and blank lines", () => {
    expect(parseAccounts("@MM_3000 | Admin Amelia\n\nMMFX_BOSS | Gordon's line\n")).toEqual([
      { handle: "MM_3000", label: "Admin Amelia" }, { handle: "MMFX_BOSS", label: "Gordon's line" },
    ]);
  });

  it("round-trips", () => {
    const a = [{ handle: "MM_3000", label: "Admin Amelia" }];
    expect(parseAccounts(accountsText(a))).toEqual(a);
  });

  it("keeps extra pipes in the label", () => {
    expect(parseAccounts("MM_3000 | Admin Amelia | the desk")).toEqual([
      { handle: "MM_3000", label: "Admin Amelia | the desk" },
    ]);
  });

  it("strips repeated @ so the guard's allowlist can match the handle", () => {
    expect(parseAccounts("@@MM_3000 | Admin Amelia")).toEqual([{ handle: "MM_3000", label: "Admin Amelia" }]);
  });

  it("ignores a line with no label", () => {
    expect(parseAccounts("MM_3000")).toEqual([]);
  });
});

describe("parseFlows", () => {
  it("reads 'label | link or flow:ID | use when' lines", () => {
    expect(parseFlows("Bot | https://t.me/marketmakers18bot | someone wants to join\nJoin flow | flow:69d626007041a05eea073a86 | bot chats")).toEqual([
      { label: "Bot", link: "https://t.me/marketmakers18bot", use_when: "someone wants to join" },
      { label: "Join flow", flow_id: "69d626007041a05eea073a86", use_when: "bot chats" },
    ]);
  });

  it("ignores lines without three parts", () => {
    expect(parseFlows("just a label")).toEqual([]);
  });

  it("round-trips", () => {
    const f = [{ label: "Bot", link: "https://t.me/marketmakers18bot", use_when: "x" }];
    expect(parseFlows(flowsText(f))).toEqual(f);
  });

  it("round-trips a flow-id entry", () => {
    const f = [{ label: "Join flow", flow_id: "69d626007041a05eea073a86", use_when: "bot chats" }];
    expect(parseFlows(flowsText(f))).toEqual(f);
  });
});
