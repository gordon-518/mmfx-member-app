import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GUIDE_FEATURES,
  ICON_NAMES,
  guideErrors,
  summarize,
  validateGuide,
  type GuideV2,
} from "./validate";

// One failing fixture per rule in the guide v2 contract (guide-v2 design §2),
// plus the three guides that are actually live on the site — the whole point of
// porting the site's validator is that a guide which renders there validates
// here and the other way round, so the live three are the port's proof.

/* ===== fixtures =========================================================== */

const BODY = [
  "The intro paragraph, before any heading.",
  "",
  "## First heading",
  "",
  "A sentence under the first heading.",
  "",
  "## Second heading",
  "",
  "A sentence under the second heading.",
].join("\n");

function base(): Record<string, unknown> {
  return {
    slug: "a-test-guide",
    title: "A test guide",
    description: "A guide used only by the validator's tests.",
    feature: "daily-analysis",
    publishedOn: "2026-10-01",
    cid: "EML-spotlight-daily-analysis",
    h2s: ["First heading", "Second heading"],
    bodyMarkdown: BODY,
    takeaways: ["The first thing.", "The second thing.", "The third thing."],
    pullQuote: "One line of the guide's own argument.",
    cover: {
      kind: "chart",
      title: "Building a daily bias",
      label: "GUIDE 01 · DAILY BIAS",
      candles: ["up", "down", "up", "up", "down", "up", "down", "up"],
      levels: [{ price: "2,380", label: "Supply", style: "zone" }],
    },
    visuals: [
      { section: 0, position: "end", type: "quote", text: "A line worth setting apart." },
      {
        section: 1,
        position: "start",
        type: "cards",
        kicker: "THREE INPUTS",
        items: [
          { icon: "chart", title: "Structure", text: "Where price has turned before." },
          { icon: "scale", title: "Weight", text: "How much each input is worth." },
          { icon: "clock", title: "Session", text: "When the move is likely to come." },
        ],
        caption: "The three inputs, side by side.",
      },
    ],
  };
}

/** A guide with `patch` applied at the top level (deep-cloned first). */
function guide(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...structuredClone(base()), ...patch };
}

/** The base guide with one visual block replaced by `block`. */
function withVisual(block: unknown): Record<string, unknown> {
  const g = structuredClone(base());
  (g.visuals as unknown[])[1] = block;
  return g;
}

/** The base guide with a second block of `type` appended — the singleton probe. */
function twice(block: Record<string, unknown>): Record<string, unknown> {
  const g = structuredClone(base());
  (g.visuals as unknown[]).push(structuredClone(block), structuredClone(block));
  return g;
}

const COMPARE = {
  section: 1,
  position: "end",
  type: "compare",
  kicker: "TWO READINGS",
  left: { label: "With the trend", quote: "Buy the pullback.", note: "The higher-probability side.", highlight: true },
  right: { label: "Against it", quote: "Sell the rally.", note: "Needs more evidence.", highlight: false },
} as const;

const FLOW = {
  section: 2,
  position: "end",
  type: "flow",
  kicker: "THE DECISION",
  root: { tag: "DAILY BIAS", text: "Price closed above the level." },
  branches: [
    { tag: "A", iff: "It holds on the retest", then: "Look for longs.", highlight: true },
    { tag: "B", iff: "It fails on the retest", then: "Stand aside.", highlight: false },
  ],
} as const;

const STACK = {
  section: 2,
  position: "start",
  type: "stack",
  inputs: ["Structure", "Momentum", "Session"],
  target: { label: "One bias", sub: "for the day" },
  headline: "Three inputs, one call.",
  text: "Each input is weighed, then the call is made once.",
} as const;

const PIPELINE = {
  section: 1,
  position: "end",
  type: "pipeline",
  kicker: "THE ROUTINE",
  steps: [
    { tag: "01 · READ", title: "Read the daily", text: "Start from the highest timeframe." },
    { tag: "02 · WEIGHT", title: "Weight the inputs", text: "Decide what matters today." },
    { tag: "03 · WAIT", title: "Wait for the level", text: "No level, no trade." },
  ],
} as const;

/** `n` characters of plain prose — for the limit probes. */
function long(n: number): string {
  return "a".repeat(n);
}

/** Expect `raw` to fail, and the message to mention `needle`. */
function rejects(raw: unknown, needle: string | RegExp) {
  expect(() => validateGuide("probe", raw)).toThrow(needle);
}

/* ===== the live guides ==================================================== */

const FIXTURES = join(__dirname, "fixtures");

describe("the three live guides", () => {
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".json"));

  it("there are three of them", () => {
    expect(files.sort()).toEqual([
      "building-a-daily-bias-on-xauusd.json",
      "reading-market-structure-a-practical-framework.json",
      "what-moves-gold.json",
    ]);
  });

  it.each(files)("%s validates against the ported contract", (file) => {
    const raw = JSON.parse(readFileSync(join(FIXTURES, file), "utf8"));
    const g = validateGuide(file, raw);
    expect(g.slug).toBe(file.replace(/\.json$/, ""));
    expect(g.visuals.length).toBeGreaterThanOrEqual(2);
    expect(g.takeaways.length).toBeGreaterThanOrEqual(3);
    expect(g.cover.kind).toBe("chart");
  });
});

/* ===== the base fixture is good =========================================== */

describe("a good guide", () => {
  it("validates and comes back normalised", () => {
    const g = validateGuide("probe", base());
    expect(g.slug).toBe("a-test-guide");
    expect(g.h2s).toEqual(["First heading", "Second heading"]);
    expect(g.visuals).toHaveLength(2);
    expect(g.pullQuote).toBe("One line of the guide's own argument.");
  });

  it("trims every string it keeps", () => {
    const g = validateGuide(
      "probe",
      guide({ title: "  A test guide  ", h2s: [" First heading ", "Second heading"] })
    );
    expect(g.title).toBe("A test guide");
    expect(g.h2s[0]).toBe("First heading");
  });

  it("omits pullQuote rather than carrying a null", () => {
    expect("pullQuote" in validateGuide("probe", guide({ pullQuote: undefined }))).toBe(false);
    expect("pullQuote" in validateGuide("probe", guide({ pullQuote: null }))).toBe(false);
  });

  it("accepts every block type, and every icon", () => {
    for (const block of [COMPARE, FLOW, STACK, PIPELINE]) {
      expect(() => validateGuide("probe", withVisual(block))).not.toThrow();
    }
    for (const icon of ICON_NAMES) {
      const g = structuredClone(base());
      ((g.visuals as Record<string, unknown>[])[1].items as Record<string, unknown>[])[0].icon = icon;
      expect(() => validateGuide("probe", g)).not.toThrow();
    }
  });

  it("accepts every site feature slug", () => {
    for (const feature of GUIDE_FEATURES) {
      expect(() => validateGuide("probe", guide({ feature }))).not.toThrow();
    }
  });
});

/* ===== the v1 keys ======================================================== */

describe("the top level", () => {
  it.each([null, "a string", 42, ["an", "array"]])("rejects %s as a guide", (raw) => {
    rejects(raw, "expected a JSON object at the top level");
  });

  it("rejects an unknown field", () => {
    rejects(guide({ author: "Gordon" }), 'unknown field "author"');
  });

  it.each(["slug", "title", "description", "feature", "publishedOn", "cid", "bodyMarkdown"])(
    "requires %s to be a non-empty string",
    (key) => {
      rejects(guide({ [key]: "   " }), `field "${key}" is required`);
      rejects(guide({ [key]: undefined }), `field "${key}" is required`);
      rejects(guide({ [key]: 7 }), `field "${key}" is required`);
    }
  );

  it.each(["Not-Kebab", "trailing-", "double--dash", "has space", "under_score"])(
    "rejects the slug %s",
    (slug) => {
      rejects(guide({ slug }), "must be lowercase kebab-case");
    }
  );

  it("rejects a feature the site has no page for", () => {
    rejects(guide({ feature: "course" }), 'feature "course" is not a site feature slug');
  });

  it.each(["01-10-2026", "2026-10-1", "2026-13-01", "2026-00-05", "not-a-date"])(
    "rejects publishedOn %s",
    (publishedOn) => {
      rejects(guide({ publishedOn }), "must be a real date in YYYY-MM-DD form");
    }
  );

  it("accepts 2026-02-30, as the site does", () => {
    // Not a defect of the port: Date.parse rolls an over-long February into
    // March rather than returning NaN, so the site's check passes it too. The
    // date is only ever a sort key and a sitemap lastModified, and the brain
    // writes today's date — so "a day that does not exist" is not a failure
    // mode worth diverging from the reference implementation over.
    expect(() => validateGuide("probe", guide({ publishedOn: "2026-02-30" }))).not.toThrow();
  });

  it.each(["spotlight-daily", "ORG-spotlight", "EML_spotlight", "EML-"])(
    "rejects the cid %s",
    (cid) => {
      rejects(guide({ cid }), "must look like EML-<flow>-<step>");
    }
  );

  it("requires h2s to be a non-empty array of non-empty strings", () => {
    rejects(guide({ h2s: undefined }), 'field "h2s" is required');
    rejects(guide({ h2s: [] }), 'field "h2s" is required');
    rejects(guide({ h2s: "First heading" }), 'field "h2s" is required');
    rejects(guide({ h2s: ["First heading", ""] }), "h2s[1] must be a non-empty string");
    rejects(guide({ h2s: ["First heading", 2] }), "h2s[1] must be a non-empty string");
  });
});

/* ===== h2s === the body's headings, in order ============================== */

describe("h2s equals the body's ## headings, in order", () => {
  it("rejects a heading the body does not carry", () => {
    rejects(guide({ h2s: ["First heading", "A heading that is not there"] }), /h2s must list every/);
  });

  it("rejects the SAME headings in the wrong order", () => {
    // The looser v1 rule ("each h2s entry appears somewhere") passes this, and
    // it is exactly what breaks a v2 body: Placement.section would address the
    // section the model did not mean.
    rejects(guide({ h2s: ["Second heading", "First heading"] }), /h2s must list every/);
  });

  it("rejects a body heading that h2s leaves out", () => {
    const body = `${BODY}\n\n## A third heading\n\nMore prose.`;
    rejects(guide({ bodyMarkdown: body }), /h2s must list every/);
  });

  it("rejects h2s longer than the body", () => {
    rejects(guide({ h2s: ["First heading", "Second heading", "Third heading"] }), /h2s must list every/);
  });

  it("names both lists in the message, so the drift is visible", () => {
    expect(() => validateGuide("probe", guide({ h2s: ["Second heading", "First heading"] }))).toThrow(
      /h2s: \["Second heading","First heading"\], body: \["First heading","Second heading"\]/
    );
  });
});

/* ===== the v2 keys are not optional here ================================== */

describe("the v2 keys", () => {
  it.each(["takeaways", "cover", "visuals"])("requires %s", (key) => {
    rejects(guide({ [key]: undefined }), `field "${key}" is required`);
  });

  it("takes 3 to 5 takeaways", () => {
    rejects(guide({ takeaways: ["One.", "Two."] }), "takeaways has 2 entries");
    rejects(guide({ takeaways: ["1.", "2.", "3.", "4.", "5.", "6."] }), "takeaways has 6 entries");
    rejects(guide({ takeaways: "One." }), "takeaways must be an array");
  });

  it("caps a takeaway at 140 chars", () => {
    rejects(guide({ takeaways: [long(141), "Two.", "Three."] }), "takeaways[0] is 141 chars; the limit is 140");
    expect(() => validateGuide("probe", guide({ takeaways: [long(140), "Two.", "Three."] }))).not.toThrow();
  });

  it("caps the pull quote at 160 chars", () => {
    rejects(guide({ pullQuote: long(161) }), "pullQuote is 161 chars; the limit is 160");
  });
});

/* ===== cover ============================================================== */

describe("cover", () => {
  function cover(patch: Record<string, unknown>): Record<string, unknown> {
    return guide({ cover: { ...structuredClone(base().cover as object), ...patch } });
  }

  it("must be an object with only the five known keys", () => {
    rejects(guide({ cover: "chart" }), "cover must be an object");
    rejects(cover({ palette: "cream" }), 'unknown field "palette" in cover');
  });

  it("only draws the chart kind", () => {
    rejects(cover({ kind: "photo" }), "cover.kind must be one of: chart");
  });

  it("caps the title at 32 and the label at 24", () => {
    rejects(cover({ title: long(33) }), "cover.title is 33 chars; the limit is 32");
    rejects(cover({ label: long(25) }), "cover.label is 25 chars; the limit is 24");
  });

  it("takes 8 to 14 candles, each up or down", () => {
    rejects(cover({ candles: ["up", "down", "up", "down", "up", "down", "up"] }), "cover.candles has 7 entries");
    rejects(cover({ candles: Array(15).fill("up") }), "cover.candles has 15 entries");
    rejects(
      cover({ candles: ["up", "flat", "up", "up", "down", "up", "down", "up"] }),
      "cover.candles[1] must be one of: up, down"
    );
  });

  it("takes at most three levels, and none is required", () => {
    expect(() => validateGuide("probe", cover({ levels: [] }))).not.toThrow();
    rejects(
      cover({ levels: Array(4).fill({ price: "2,380", label: "Supply", style: "zone" }) }),
      "cover.levels has 4 entries"
    );
  });

  it("checks each level's price, label and style", () => {
    rejects(cover({ levels: [{ price: "2,380", label: "Supply" }] }), "cover.levels[0].style must be one of");
    rejects(
      cover({ levels: [{ price: long(29), label: "Supply", style: "line" }] }),
      "cover.levels[0].price is 29 chars; the limit is 28"
    );
    rejects(
      cover({ levels: [{ price: "2,380", label: long(29), style: "line" }] }),
      "cover.levels[0].label is 29 chars; the limit is 28"
    );
    rejects(
      cover({ levels: [{ price: "2,380", label: "Supply", style: "shaded" }] }),
      "cover.levels[0].style must be one of: zone, line, dashed"
    );
    rejects(
      cover({ levels: [{ price: "2,380", label: "Supply", style: "zone", colour: "peach" }] }),
      'unknown field "colour" in cover.levels[0]'
    );
  });
});

/* ===== visuals: the shared rules ========================================= */

describe("visuals", () => {
  it("takes 2 to 6 blocks", () => {
    rejects(guide({ visuals: [base().visuals as unknown[]].flat().slice(0, 1) }), "visuals has 1 entries");
    const g = structuredClone(base());
    (g.visuals as unknown[]).push(...Array(5).fill(structuredClone(PIPELINE)));
    rejects(g, "visuals has 7 entries");
  });

  it("rejects a block that is not an object", () => {
    rejects(withVisual("a quote"), "visuals[1] must be an object");
    rejects(withVisual(["a quote"]), "visuals[1] must be an object");
  });

  it("rejects an unknown block type", () => {
    rejects(withVisual({ section: 1, position: "end", type: "table", rows: [] }), "visuals[1].type must be one of");
  });

  it("requires a whole section number no greater than h2s.length", () => {
    rejects(withVisual({ ...COMPARE, section: -1 }), "visuals[1].section must be a whole number between 0 and 2");
    rejects(withVisual({ ...COMPARE, section: 1.5 }), "visuals[1].section must be a whole number between 0 and 2");
    rejects(withVisual({ ...COMPARE, section: 3 }), "visuals[1].section must be a whole number between 0 and 2");
    rejects(withVisual({ ...COMPARE, section: "1" }), "visuals[1].section must be a whole number between 0 and 2");
    expect(() => validateGuide("probe", withVisual({ ...COMPARE, section: 0 }))).not.toThrow();
    expect(() => validateGuide("probe", withVisual({ ...COMPARE, section: 2 }))).not.toThrow();
  });

  it("requires position to be start or end", () => {
    rejects(withVisual({ ...COMPARE, position: "middle" }), "visuals[1].position must be one of: start, end");
  });

  it.each(["compare", "flow", "stack"] as const)("allows at most one %s block", (type) => {
    const block = { compare: COMPARE, flow: FLOW, stack: STACK }[type];
    rejects(twice(block), `visuals may hold at most one "${type}" block, found 2`);
  });

  it("allows two cards, two pipelines and two quotes — they are not set pieces", () => {
    expect(() => validateGuide("probe", twice(PIPELINE))).not.toThrow();
  });
});

/* ===== visuals: per-type rules =========================================== */

describe("the compare block", () => {
  it("rejects an unknown field", () => {
    rejects(withVisual({ ...COMPARE, middle: {} }), 'unknown field "middle" in visuals[1]');
  });

  it("caps the kicker at 28", () => {
    rejects(withVisual({ ...COMPARE, kicker: long(29) }), "visuals[1].kicker is 29 chars; the limit is 28");
  });

  it("caps each side's label at 40 and quote/note at 180", () => {
    rejects(
      withVisual({ ...COMPARE, left: { ...COMPARE.left, label: long(41) } }),
      "visuals[1].left.label is 41 chars; the limit is 40"
    );
    rejects(
      withVisual({ ...COMPARE, left: { ...COMPARE.left, quote: long(181) } }),
      "visuals[1].left.quote is 181 chars; the limit is 180"
    );
    rejects(
      withVisual({ ...COMPARE, right: { ...COMPARE.right, note: long(181) } }),
      "visuals[1].right.note is 181 chars; the limit is 180"
    );
  });

  it("pins the highlight: left is always the chosen side", () => {
    rejects(
      withVisual({ ...COMPARE, left: { ...COMPARE.left, highlight: false } }),
      "visuals[1].left.highlight must be true"
    );
    rejects(
      withVisual({ ...COMPARE, right: { ...COMPARE.right, highlight: true } }),
      "visuals[1].right.highlight must be false"
    );
    rejects(
      withVisual({ ...COMPARE, left: { ...COMPARE.left, highlight: "yes" } }),
      "visuals[1].left.highlight must be a boolean"
    );
  });

  it("caps the optional caption at 160", () => {
    rejects(withVisual({ ...COMPARE, caption: long(161) }), "visuals[1].caption is 161 chars; the limit is 160");
  });
});

describe("the cards block", () => {
  const CARDS = base().visuals as Record<string, unknown>[];
  const cards = (patch: Record<string, unknown>) => withVisual({ ...structuredClone(CARDS[1]), ...patch });

  it("takes 3 or 4 items", () => {
    const items = (CARDS[1].items as unknown[]).slice(0, 2);
    rejects(cards({ items }), "visuals[1].items has 2 entries");
    rejects(cards({ items: Array(5).fill((CARDS[1].items as unknown[])[0]) }), "visuals[1].items has 5 entries");
  });

  it("only draws an icon Icon.tsx has", () => {
    rejects(
      cards({ items: [{ icon: "candlestick", title: "Structure", text: "x" }, ...(CARDS[1].items as unknown[]).slice(1)] }),
      "visuals[1].items[0].icon must be one of: chart, target"
    );
  });

  it("caps an item title at 40 and its text at 180", () => {
    const rest = (CARDS[1].items as unknown[]).slice(1);
    rejects(
      cards({ items: [{ icon: "chart", title: long(41), text: "x" }, ...rest] }),
      "visuals[1].items[0].title is 41 chars; the limit is 40"
    );
    rejects(
      cards({ items: [{ icon: "chart", title: "Structure", text: long(181) }, ...rest] }),
      "visuals[1].items[0].text is 181 chars; the limit is 180"
    );
  });

  it("lets the kicker be absent — cards is the one block whose kicker is optional", () => {
    const g = structuredClone(base());
    delete (g.visuals as Record<string, unknown>[])[1].kicker;
    expect(() => validateGuide("probe", g)).not.toThrow();
    rejects(cards({ kicker: long(29) }), "visuals[1].kicker is 29 chars; the limit is 28");
  });
});

describe("the pipeline block", () => {
  it("takes 3 or 4 steps", () => {
    rejects(withVisual({ ...PIPELINE, steps: PIPELINE.steps.slice(0, 2) }), "visuals[1].steps has 2 entries");
    rejects(withVisual({ ...PIPELINE, steps: Array(5).fill(PIPELINE.steps[0]) }), "visuals[1].steps has 5 entries");
  });

  it("caps a step's tag at 28, title at 40 and text at 180", () => {
    const rest = PIPELINE.steps.slice(1);
    rejects(
      withVisual({ ...PIPELINE, steps: [{ ...PIPELINE.steps[0], tag: long(29) }, ...rest] }),
      "visuals[1].steps[0].tag is 29 chars; the limit is 28"
    );
    rejects(
      withVisual({ ...PIPELINE, steps: [{ ...PIPELINE.steps[0], title: long(41) }, ...rest] }),
      "visuals[1].steps[0].title is 41 chars; the limit is 40"
    );
    rejects(
      withVisual({ ...PIPELINE, steps: [{ ...PIPELINE.steps[0], text: long(181) }, ...rest] }),
      "visuals[1].steps[0].text is 181 chars; the limit is 180"
    );
  });

  it("requires the kicker", () => {
    const { kicker: _drop, ...noKicker } = PIPELINE;
    void _drop;
    rejects(withVisual(noKicker), "visuals[1].kicker is required");
  });
});

describe("the flow block", () => {
  it("takes 2 or 3 branches", () => {
    rejects(withVisual({ ...FLOW, branches: FLOW.branches.slice(0, 1) }), "visuals[1].branches has 1 entries");
    rejects(withVisual({ ...FLOW, branches: Array(4).fill(FLOW.branches[0]) }), "visuals[1].branches has 4 entries");
  });

  it("checks the root's tag and text", () => {
    rejects(
      withVisual({ ...FLOW, root: { tag: long(29), text: "x" } }),
      "visuals[1].root.tag is 29 chars; the limit is 28"
    );
    rejects(
      withVisual({ ...FLOW, root: { tag: "DAILY BIAS", text: long(181) } }),
      "visuals[1].root.text is 181 chars; the limit is 180"
    );
    rejects(withVisual({ ...FLOW, root: { tag: "DAILY BIAS" } }), "visuals[1].root.text is required");
  });

  it("caps a branch's iff and then at 180 and needs a boolean highlight", () => {
    const rest = FLOW.branches.slice(1);
    rejects(
      withVisual({ ...FLOW, branches: [{ ...FLOW.branches[0], iff: long(181) }, ...rest] }),
      "visuals[1].branches[0].iff is 181 chars; the limit is 180"
    );
    rejects(
      withVisual({ ...FLOW, branches: [{ ...FLOW.branches[0], then: long(181) }, ...rest] }),
      "visuals[1].branches[0].then is 181 chars; the limit is 180"
    );
    rejects(
      withVisual({ ...FLOW, branches: [{ ...FLOW.branches[0], highlight: "yes" }, ...rest] }),
      "visuals[1].branches[0].highlight must be a boolean"
    );
  });

  it("allows an optional muted flag, but only as a boolean", () => {
    const rest = FLOW.branches.slice(1);
    expect(() =>
      validateGuide("probe", withVisual({ ...FLOW, branches: [{ ...FLOW.branches[0], muted: true }, ...rest] }))
    ).not.toThrow();
    rejects(
      withVisual({ ...FLOW, branches: [{ ...FLOW.branches[0], muted: 1 }, ...rest] }),
      "visuals[1].branches[0].muted must be a boolean"
    );
  });
});

describe("the stack block", () => {
  it("takes 3 to 5 inputs, each capped at 40", () => {
    rejects(withVisual({ ...STACK, inputs: ["One", "Two"] }), "visuals[1].inputs has 2 entries");
    rejects(withVisual({ ...STACK, inputs: Array(6).fill("One") }), "visuals[1].inputs has 6 entries");
    rejects(
      withVisual({ ...STACK, inputs: [long(41), "Two", "Three"] }),
      "visuals[1].inputs[0] is 41 chars; the limit is 40"
    );
  });

  it("caps the target's label and sub at 40", () => {
    rejects(
      withVisual({ ...STACK, target: { label: long(41), sub: "for the day" } }),
      "visuals[1].target.label is 41 chars; the limit is 40"
    );
    rejects(
      withVisual({ ...STACK, target: { label: "One bias", sub: long(41) } }),
      "visuals[1].target.sub is 41 chars; the limit is 40"
    );
  });

  it("caps the headline and text at 180", () => {
    rejects(withVisual({ ...STACK, headline: long(181) }), "visuals[1].headline is 181 chars; the limit is 180");
    rejects(withVisual({ ...STACK, text: long(181) }), "visuals[1].text is 181 chars; the limit is 180");
  });
});

describe("the quote block", () => {
  it("caps its text at 180 and takes nothing else", () => {
    rejects(
      withVisual({ section: 1, position: "end", type: "quote", text: long(181) }),
      "visuals[1].text is 181 chars; the limit is 180"
    );
    rejects(
      withVisual({ section: 1, position: "end", type: "quote", text: "x", attribution: "Gordon" }),
      'unknown field "attribution" in visuals[1]'
    );
  });
});

/* ===== the plain-text rule =============================================== */

describe("every v2 string is plain text", () => {
  // The blocks are drawn into fixed components, never parsed as Markdown and
  // never set as HTML, so a `**` would render as two asterisks and a `<em>` as
  // literal angle brackets. Both are authoring mistakes, not output.
  it.each([
    ["bold", "A **strong** claim."],
    ["underscore emphasis", "A __strong__ claim."],
    ["code", "A `backtick` claim."],
    ["a link", "See [the desk](https://x) for more."],
    ["an image", "![a chart](x.png)"],
    ["an HTML tag", "A <em>strong</em> claim."],
    ["a closing tag", "A claim</p>"],
    ["a comment", "<!-- a note -->"],
    ["a leading blockquote", "> A quoted claim."],
    ["a leading heading", "# A heading"],
  ])("rejects %s in a takeaway", (_name, text) => {
    rejects(guide({ takeaways: [text, "Two.", "Three."] }), "must be plain text");
  });

  it("rejects markdown in a block's text, a cover label and the pull quote", () => {
    rejects(withVisual({ section: 1, position: "end", type: "quote", text: "A **strong** claim." }), "must be plain text");
    rejects(guide({ pullQuote: "A **strong** claim." }), "must be plain text");
    rejects(
      guide({ cover: { ...(base().cover as object), label: "GUIDE <em>01" } }),
      "cover.label must be plain text"
    );
  });

  it("leaves bodyMarkdown alone — it IS Markdown", () => {
    const body = BODY.replace("The intro paragraph", "The **intro** paragraph");
    expect(() => validateGuide("probe", guide({ bodyMarkdown: body }))).not.toThrow();
  });
});

/* ===== the helpers the routes use ======================================== */

describe("guideErrors", () => {
  it("is empty for a good guide", () => {
    expect(guideErrors("probe", base())).toEqual([]);
  });

  it("is a one-entry list naming the first problem", () => {
    const errors = guideErrors("probe", guide({ cid: "nope" }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("must look like EML-<flow>-<step>");
  });

  it("carries the label, so a bad row says which slug", () => {
    expect(guideErrors("what-moves-gold", guide({ cid: "nope" }))[0]).toContain(
      'Invalid guide "what-moves-gold"'
    );
  });
});

describe("summarize", () => {
  it("keeps the six index-card keys and nothing else", () => {
    const g: GuideV2 = validateGuide("probe", base());
    expect(Object.keys(summarize(g)).sort()).toEqual([
      "cover",
      "description",
      "feature",
      "publishedOn",
      "slug",
      "title",
    ]);
    expect(summarize(g).cover).toEqual(g.cover);
  });
});
