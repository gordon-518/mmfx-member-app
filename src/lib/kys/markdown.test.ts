import { describe, it, expect } from "vitest";
import { parseReportMarkdown, parseSpans } from "./markdown";

describe("parseSpans", () => {
  it("marks bold runs", () => {
    expect(parseSpans("a **b** c")).toEqual([
      { text: "a ", bold: false },
      { text: "b", bold: true },
      { text: " c", bold: false },
    ]);
  });

  it("leaves an unbalanced marker as text", () => {
    expect(parseSpans("a **b")).toEqual([
      { text: "a ", bold: false },
      { text: "b", bold: false },
    ]);
  });
});

describe("parseReportMarkdown", () => {
  const md = [
    "## The read",
    "",
    "You trade **gold** on impulse.",
    "Two sentences, one paragraph.",
    "",
    "### A sub-head",
    "- first leak",
    "- second leak",
    "",
    "Closing line.",
  ].join("\n");

  it("parses the shape our prompt produces", () => {
    const blocks = parseReportMarkdown(md);
    expect(blocks.map((b) => b.kind)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "list",
      "paragraph",
    ]);
    expect(blocks[0]).toMatchObject({ kind: "heading", level: 2 });
    expect(blocks[2]).toMatchObject({ kind: "heading", level: 3 });
  });

  it("joins wrapped lines into one paragraph", () => {
    const [, paragraph] = parseReportMarkdown(md);
    const text = paragraph.kind === "paragraph" ? paragraph.spans.map((s) => s.text).join("") : "";
    expect(text).toBe("You trade gold on impulse. Two sentences, one paragraph.");
  });

  it("keeps list items separate", () => {
    const list = parseReportMarkdown(md).find((b) => b.kind === "list");
    expect(list?.kind === "list" && list.items).toHaveLength(2);
  });

  it("never emits raw HTML, whatever the model writes", () => {
    const blocks = parseReportMarkdown("## <script>alert(1)</script>\n<b>hi</b>");
    const flat = JSON.stringify(blocks);
    // The angle brackets survive as TEXT, to be escaped by React on render.
    expect(flat).toContain("<script>alert(1)</script>");
    expect(blocks[0].kind).toBe("heading");
  });

  it("handles an empty report", () => {
    expect(parseReportMarkdown("")).toEqual([]);
  });
});
