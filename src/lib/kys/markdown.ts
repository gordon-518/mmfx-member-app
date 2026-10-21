// The KYS report is markdown written by the model. The standalone app rendered
// it with react-markdown; nothing else in this app renders markdown, so rather
// than take the dependency we parse the small subset our own prompt produces
// (headings, paragraphs, bold, bullet lists) into plain data. The renderer
// turns that into React elements, so model output can never become raw HTML.

export interface Span {
  text: string;
  bold: boolean;
}

export type Block =
  | { kind: "heading"; level: 2 | 3; spans: Span[] }
  | { kind: "paragraph"; spans: Span[] }
  | { kind: "list"; items: Span[][] };

/** Split on **bold** markers. Unbalanced markers stay literal text. */
export function parseSpans(line: string): Span[] {
  const spans: Span[] = [];
  const parts = line.split("**");
  // An even number of markers means every opener has a closer; otherwise the
  // trailing marker is just text the member should still see.
  const balanced = parts.length % 2 === 1;
  parts.forEach((part, i) => {
    if (!part) return;
    spans.push({ text: part, bold: balanced && i % 2 === 1 });
  });
  return spans.length ? spans : [{ text: "", bold: false }];
}

export function parseReportMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ kind: "paragraph", spans: parseSpans(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (!items.length) return;
    blocks.push({ kind: "list", items: items.map(parseSpans) });
    items = [];
  };

  for (const rawLine of (markdown ?? "").split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1].length === 2 ? 2 : 3,
        spans: parseSpans(heading[2]),
      });
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      items.push(bullet[1]);
      continue;
    }
    // A horizontal rule carries no meaning in this report; drop it.
    if (/^-{3,}$/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}
