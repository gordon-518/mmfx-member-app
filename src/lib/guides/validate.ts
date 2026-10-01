// Guide JSON v2 — the contract, and the only place it is enforced.
//
// Ported from the marketing site's `src/content/guides.ts`, which is the
// reference implementation (guide-v2 design §2; daily-guides design §2 says to
// port it). The site validated a FILE on its way into a build; this validates a
// REQUEST BODY on its way into the table and a ROW on its way back out, so two
// things are deliberately different and nothing else is:
//
//   1. The four v2 keys are REQUIRED, not optional. On the site they are
//      optional so the three v1 files already on disk keep rendering. Here
//      every row is written by POST /api/guides, the columns behind them are
//      NOT NULL, and there is no legacy row to be kind to — so the site's
//      "v2 or not at all" branch becomes the only branch, and with it the
//      strict rule that `h2s` is every "## " heading of the body, in order.
//   2. There is no file, so the site's "slug must equal the filename" rule has
//      no analogue. The slug is still checked against the same regex, and the
//      routes compare it with the URL segment they were asked for.
//
// Everything else — every limit, every allowed key, the plain-text rule, the
// singleton rule, the error-message wording — is the site's, so a guide that
// validates here renders there and a guide the site would reject is a 422.
//
// Fail-fast, like the original: the first problem throws, with the label in the
// message. `guideErrors` wraps that into the `{ errors: string[] }` list the
// POST route answers 422 with.

/** The 16 monoline icons the site's `Icon.tsx` can draw. */
export const ICON_NAMES = [
  "chart", "target", "layers", "flag", "x", "arrow-up", "arrow-down", "clock",
  "scale", "map", "shield", "eye", "book", "compass", "bolt", "wave",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/**
 * The marketing site's feature slugs (its `src/content/features.ts` keys).
 *
 * Mirrored as a constant rather than imported: `features.ts` lives in the other
 * repo and this app's own FEATURE_KEYS are a DIFFERENT list (it calls two of
 * these "course" and "library"). The check is worth keeping — a typo'd feature
 * would publish a guide whose breadcrumb and CTA point at a 404 — so the list
 * is duplicated with this note. Add a feature to the site and add it here.
 */
export const GUIDE_FEATURES = [
  "daily-analysis",
  "indicators",
  "know-your-style",
  "fundamental-desk",
  "ai-trading-assistant",
  "mm-system",
  "signals",
  "strategies",
  "live-classes",
  "ebook-library",
] as const;

/** Where a visual block sits. `section: 0` is the intro, before the first H2. */
export type Placement = { section: number; position: "start" | "end" };

export type GuideCover = {
  kind: "chart";
  /** Drawn large on the cover. */
  title: string;
  /** The mono strapline, e.g. "GUIDE 01 · DAILY BIAS". */
  label: string;
  /** 8–14 candles, left to right. The renderer invents a plausible path. */
  candles: ("up" | "down")[];
  /** 0–3 price marks. `zone` is a shaded band, the other two are rules. */
  levels: { price: string; label: string; style: "zone" | "line" | "dashed" }[];
};

export type VisualBlock = Placement &
  (
    | {
        type: "compare";
        kicker: string;
        left: { label: string; quote: string; note: string; highlight: true };
        right: { label: string; quote: string; note: string; highlight: false };
        caption?: string;
      }
    | { type: "cards"; kicker?: string; items: { icon: IconName; title: string; text: string }[]; caption?: string }
    | { type: "pipeline"; kicker: string; steps: { tag: string; title: string; text: string }[]; caption?: string }
    | {
        type: "flow";
        kicker: string;
        root: { tag: string; text: string };
        branches: { tag: string; iff: string; then: string; highlight: boolean; muted?: boolean }[];
        caption?: string;
      }
    | { type: "stack"; inputs: string[]; target: { label: string; sub: string }; headline: string; text: string }
    | { type: "quote"; text: string }
  );

/** The full guide object — the POST body, and what GET /api/guides/[slug] returns. */
export type GuideV2 = {
  /** URL slug, lowercase kebab-case. */
  slug: string;
  /** H1 / <title> base. */
  title: string;
  /** Meta description + index-card blurb. */
  description: string;
  /** A slug from the site's `features.ts` — the membership tool this guide is about. */
  feature: string;
  /** ISO date, `YYYY-MM-DD`. Drives sitemap lastModified + sort order. */
  publishedOn: string;
  /** Campaign id the email links carry, e.g. `EML-spotlight-fundamental-desk`. */
  cid: string;
  /** The body's H2s: every `## ` heading, in order. `Placement.section` indexes this. */
  h2s: string[];
  /** The guide itself, Markdown. */
  bodyMarkdown: string;
  /** 3–5 rail bullets, each ≤ 140 chars of plain text. */
  takeaways: string[];
  /** One line of the guide's own argument, ≤ 160 chars. Omitted when absent. */
  pullQuote?: string;
  /** The illustrated chart cover — also the Open Graph image. */
  cover: GuideCover;
  /** 2–6 typed figures, interleaved into the body by their `Placement`. */
  visuals: VisualBlock[];
};

/** The index-card shape `GET /api/guides` returns. */
export type GuideSummary = Pick<
  GuideV2,
  "slug" | "feature" | "title" | "description" | "publishedOn" | "cover"
>;

const REQUIRED_STRINGS = [
  "slug",
  "title",
  "description",
  "feature",
  "publishedOn",
  "cid",
  "bodyMarkdown",
] as const;

const KNOWN_KEYS = new Set<string>([
  ...REQUIRED_STRINGS,
  "h2s",
  "takeaways",
  "pullQuote",
  "cover",
  "visuals",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CID_RE = /^EML-[A-Za-z0-9-]+$/;

function fail(label: string, message: string): never {
  throw new Error(`Invalid guide "${label}": ${message}`);
}

/* ===== v2 validation ======================================================
   Every string in the four added keys is plain text: it is drawn straight into
   a fixed component (an SVG label, a mono tag, a figure caption), never parsed
   as Markdown and never set as HTML. So markdown syntax would render as literal
   asterisks and a tag would render as literal angle brackets — both are
   authoring mistakes, and both are a 422 rather than a published page.

   Field caps follow the spec: `quote`/`iff`/`then`/`text` ≤ 180, titles ≤ 40,
   kickers/tags ≤ 28, captions ≤ 160. Fields the spec does not name take the cap
   of the slot they are drawn into: PROSE (180) for `note`/`headline`, TITLE
   (40) for `label`/`sub`/stack inputs. */

const PROSE = 180;
const TITLE = 40;
const TAG = 28;
const CAPTION = 160;

/** Tag-like `<x`, a Markdown emphasis/code/link marker, or a leading `>`/`#`. */
const NOT_PLAIN = /<[a-zA-Z/!?]|\*\*|__|`|\]\(|!\[|^\s*[>#]/;

function str(label: string, where: string, v: unknown, max: number): string {
  if (typeof v !== "string" || v.trim() === "") {
    fail(label, `${where} is required and must be a non-empty string`);
  }
  const s = v.trim();
  if (s.length > max) fail(label, `${where} is ${s.length} chars; the limit is ${max}`);
  if (NOT_PLAIN.test(s)) fail(label, `${where} must be plain text — no Markdown, no HTML`);
  return s;
}

function obj(
  label: string,
  where: string,
  v: unknown,
  known: readonly string[]
): Record<string, unknown> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) fail(label, `${where} must be an object`);
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!known.includes(k)) fail(label, `unknown field "${k}" in ${where} (allowed: ${known.join(", ")})`);
  }
  return o;
}

function arr(label: string, where: string, v: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(v)) fail(label, `${where} must be an array`);
  if (v.length < min || v.length > max) {
    fail(label, `${where} has ${v.length} entries; it must have between ${min} and ${max}`);
  }
  return v;
}

function oneOf<T extends string>(label: string, where: string, v: unknown, allowed: readonly T[]): T {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    fail(label, `${where} must be one of: ${allowed.join(", ")}`);
  }
  return v as T;
}

function bool(label: string, where: string, v: unknown, mustBe?: boolean): boolean {
  if (typeof v !== "boolean") fail(label, `${where} must be a boolean`);
  if (mustBe !== undefined && v !== mustBe) fail(label, `${where} must be ${mustBe}`);
  return v;
}

function optionalCaption(label: string, where: string, v: unknown): string | undefined {
  return v === undefined ? undefined : str(label, where, v, CAPTION);
}

function validateCover(label: string, raw: unknown): GuideCover {
  const o = obj(label, "cover", raw, ["kind", "title", "label", "candles", "levels"]);
  oneOf(label, "cover.kind", o.kind, ["chart"]);
  const candles = arr(label, "cover.candles", o.candles, 8, 14).map((c, i) =>
    oneOf(label, `cover.candles[${i}]`, c, ["up", "down"] as const)
  );
  const levels = arr(label, "cover.levels", o.levels, 0, 3).map((l, i) => {
    const lo = obj(label, `cover.levels[${i}]`, l, ["price", "label", "style"]);
    return {
      price: str(label, `cover.levels[${i}].price`, lo.price, TAG),
      label: str(label, `cover.levels[${i}].label`, lo.label, TAG),
      style: oneOf(label, `cover.levels[${i}].style`, lo.style, ["zone", "line", "dashed"] as const),
    };
  });
  return {
    kind: "chart",
    title: str(label, "cover.title", o.title, 32),
    label: str(label, "cover.label", o.label, 24),
    candles,
    levels,
  };
}

const PLACEMENT = ["section", "position", "type"];

function validateVisual(label: string, i: number, raw: unknown, sectionCount: number): VisualBlock {
  const at = `visuals[${i}]`;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) fail(label, `${at} must be an object`);
  const o = raw as Record<string, unknown>;
  const type = oneOf(label, `${at}.type`, o.type, [
    "compare", "cards", "pipeline", "flow", "stack", "quote",
  ] as const);

  const section = o.section;
  if (typeof section !== "number" || !Number.isInteger(section) || section < 0 || section > sectionCount) {
    fail(label, `${at}.section must be a whole number between 0 and ${sectionCount} (h2s.length)`);
  }
  const position = oneOf(label, `${at}.position`, o.position, ["start", "end"] as const);
  const place = { section, position };

  switch (type) {
    case "compare": {
      obj(label, at, o, [...PLACEMENT, "kicker", "left", "right", "caption"]);
      const side = (key: "left" | "right", highlight: boolean) => {
        const s = obj(label, `${at}.${key}`, o[key], ["label", "quote", "note", "highlight"]);
        return {
          label: str(label, `${at}.${key}.label`, s.label, TITLE),
          quote: str(label, `${at}.${key}.quote`, s.quote, PROSE),
          note: str(label, `${at}.${key}.note`, s.note, PROSE),
          highlight: bool(label, `${at}.${key}.highlight`, s.highlight, highlight),
        };
      };
      return {
        ...place,
        type,
        kicker: str(label, `${at}.kicker`, o.kicker, TAG),
        left: side("left", true) as { label: string; quote: string; note: string; highlight: true },
        right: side("right", false) as { label: string; quote: string; note: string; highlight: false },
        caption: optionalCaption(label, `${at}.caption`, o.caption),
      };
    }
    case "cards": {
      obj(label, at, o, [...PLACEMENT, "kicker", "items", "caption"]);
      const items = arr(label, `${at}.items`, o.items, 3, 4).map((it, j) => {
        const c = obj(label, `${at}.items[${j}]`, it, ["icon", "title", "text"]);
        return {
          icon: oneOf(label, `${at}.items[${j}].icon`, c.icon, ICON_NAMES),
          title: str(label, `${at}.items[${j}].title`, c.title, TITLE),
          text: str(label, `${at}.items[${j}].text`, c.text, PROSE),
        };
      });
      return {
        ...place,
        type,
        kicker: o.kicker === undefined ? undefined : str(label, `${at}.kicker`, o.kicker, TAG),
        items,
        caption: optionalCaption(label, `${at}.caption`, o.caption),
      };
    }
    case "pipeline": {
      obj(label, at, o, [...PLACEMENT, "kicker", "steps", "caption"]);
      const steps = arr(label, `${at}.steps`, o.steps, 3, 4).map((s, j) => {
        const st = obj(label, `${at}.steps[${j}]`, s, ["tag", "title", "text"]);
        return {
          tag: str(label, `${at}.steps[${j}].tag`, st.tag, TAG),
          title: str(label, `${at}.steps[${j}].title`, st.title, TITLE),
          text: str(label, `${at}.steps[${j}].text`, st.text, PROSE),
        };
      });
      return {
        ...place,
        type,
        kicker: str(label, `${at}.kicker`, o.kicker, TAG),
        steps,
        caption: optionalCaption(label, `${at}.caption`, o.caption),
      };
    }
    case "flow": {
      obj(label, at, o, [...PLACEMENT, "kicker", "root", "branches", "caption"]);
      const r = obj(label, `${at}.root`, o.root, ["tag", "text"]);
      const branches = arr(label, `${at}.branches`, o.branches, 2, 3).map((b, j) => {
        const br = obj(label, `${at}.branches[${j}]`, b, ["tag", "iff", "then", "highlight", "muted"]);
        return {
          tag: str(label, `${at}.branches[${j}].tag`, br.tag, TAG),
          iff: str(label, `${at}.branches[${j}].iff`, br.iff, PROSE),
          then: str(label, `${at}.branches[${j}].then`, br.then, PROSE),
          highlight: bool(label, `${at}.branches[${j}].highlight`, br.highlight),
          muted: br.muted === undefined ? undefined : bool(label, `${at}.branches[${j}].muted`, br.muted),
        };
      });
      return {
        ...place,
        type,
        kicker: str(label, `${at}.kicker`, o.kicker, TAG),
        root: {
          tag: str(label, `${at}.root.tag`, r.tag, TAG),
          text: str(label, `${at}.root.text`, r.text, PROSE),
        },
        branches,
        caption: optionalCaption(label, `${at}.caption`, o.caption),
      };
    }
    case "stack": {
      obj(label, at, o, [...PLACEMENT, "inputs", "target", "headline", "text"]);
      const inputs = arr(label, `${at}.inputs`, o.inputs, 3, 5).map((s, j) =>
        str(label, `${at}.inputs[${j}]`, s, TITLE)
      );
      const t = obj(label, `${at}.target`, o.target, ["label", "sub"]);
      return {
        ...place,
        type,
        inputs,
        target: {
          label: str(label, `${at}.target.label`, t.label, TITLE),
          sub: str(label, `${at}.target.sub`, t.sub, TITLE),
        },
        headline: str(label, `${at}.headline`, o.headline, PROSE),
        text: str(label, `${at}.text`, o.text, PROSE),
      };
    }
    case "quote": {
      obj(label, at, o, [...PLACEMENT, "text"]);
      return { ...place, type, text: str(label, `${at}.text`, o.text, PROSE) };
    }
  }
}

/** At most one of each of these per guide — they are the page's set pieces. */
const SINGLETONS = ["compare", "flow", "stack"] as const;

/**
 * Validate one guide object. Throws on the first problem, with `label` (a slug,
 * or "body" for an unparsed request) in the message.
 *
 * Used on BOTH sides of the table: POST validates the body before the upsert,
 * and the read routes validate the row they loaded before serving it. The
 * second is not belt-and-braces — a row written before a limit was tightened,
 * or by a hand-run SQL statement, must not reach the renderer.
 */
export function validateGuide(label: string, raw: unknown): GuideV2 {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    fail(label, "expected a JSON object at the top level");
  }
  const o = raw as Record<string, unknown>;

  for (const key of Object.keys(o)) {
    if (!KNOWN_KEYS.has(key)) {
      fail(label, `unknown field "${key}" (allowed: ${[...KNOWN_KEYS].join(", ")})`);
    }
  }

  for (const key of REQUIRED_STRINGS) {
    const v = o[key];
    if (typeof v !== "string" || v.trim() === "") {
      fail(label, `field "${key}" is required and must be a non-empty string`);
    }
  }

  const slug = (o.slug as string).trim();
  if (!SLUG_RE.test(slug)) fail(label, `slug "${slug}" must be lowercase kebab-case`);

  const feature = (o.feature as string).trim();
  if (!(GUIDE_FEATURES as readonly string[]).includes(feature)) {
    fail(label, `feature "${feature}" is not a site feature slug (one of: ${GUIDE_FEATURES.join(", ")})`);
  }

  const publishedOn = (o.publishedOn as string).trim();
  if (!DATE_RE.test(publishedOn) || Number.isNaN(Date.parse(`${publishedOn}T00:00:00Z`))) {
    fail(label, `publishedOn "${publishedOn}" must be a real date in YYYY-MM-DD form`);
  }

  const cid = (o.cid as string).trim();
  if (!CID_RE.test(cid)) fail(label, `cid "${cid}" must look like EML-<flow>-<step>`);

  const h2sRaw = o.h2s;
  if (!Array.isArray(h2sRaw) || h2sRaw.length === 0) {
    fail(label, `field "h2s" is required and must be a non-empty array of strings`);
  }
  const h2s = h2sRaw.map((h, i) => {
    if (typeof h !== "string" || h.trim() === "") {
      fail(label, `h2s[${i}] must be a non-empty string`);
    }
    return h.trim();
  });

  const bodyMarkdown = (o.bodyMarkdown as string).trim();
  const headings = bodyMarkdown
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3).trim());

  // A v2 body is addressed by SECTION NUMBER, so `h2s` and the body's own
  // headings have to be the same list in the same order — otherwise
  // `Placement.section` points at whichever of the two you happened to count.
  if (headings.length !== h2s.length || headings.some((h, i) => h !== h2s[i])) {
    fail(
      label,
      `h2s must list every "## " heading of bodyMarkdown, in order ` +
        `(h2s: ${JSON.stringify(h2s)}, body: ${JSON.stringify(headings)})`
    );
  }

  for (const k of ["takeaways", "cover", "visuals"] as const) {
    if (o[k] === undefined) fail(label, `field "${k}" is required`);
  }

  const takeaways = arr(label, "takeaways", o.takeaways, 3, 5).map((t, i) =>
    str(label, `takeaways[${i}]`, t, 140)
  );
  const cover = validateCover(label, o.cover);

  const visuals = arr(label, "visuals", o.visuals, 2, 6).map((v, i) =>
    validateVisual(label, i, v, h2s.length)
  );
  for (const only of SINGLETONS) {
    const n = visuals.filter((v) => v.type === only).length;
    if (n > 1) fail(label, `visuals may hold at most one "${only}" block, found ${n}`);
  }

  const guide: GuideV2 = {
    slug,
    title: (o.title as string).trim(),
    description: (o.description as string).trim(),
    feature,
    publishedOn,
    cid,
    h2s,
    bodyMarkdown,
    takeaways,
    cover,
    visuals,
  };
  // Omitted rather than null when absent: the contract says `pullQuote?`, and
  // the site's renderer tests `pullQuote &&`.
  if (o.pullQuote !== undefined && o.pullQuote !== null) {
    guide.pullQuote = str(label, "pullQuote", o.pullQuote, 160);
  }

  return guide;
}

/**
 * The same check without the throw: the guide, or the problems with it.
 *
 * This is what POST answers `422 { errors }` with. The validator is fail-fast
 * (the site's build had to name ONE problem per failed file), so `errors` is
 * never longer than one entry — but it is a list, so an accumulating pass later
 * needs no change at the route.
 */
export function parseGuide(
  label: string,
  raw: unknown
): { guide: GuideV2; errors: [] } | { guide: null; errors: string[] } {
  try {
    return { guide: validateGuide(label, raw), errors: [] };
  } catch (e) {
    return { guide: null, errors: [(e as Error).message] };
  }
}

/** Just the problems — `[]` when the guide is good. */
export function guideErrors(label: string, raw: unknown): string[] {
  return parseGuide(label, raw).errors;
}

/** The index-card projection of a validated guide. */
export function summarize(guide: GuideV2): GuideSummary {
  return {
    slug: guide.slug,
    feature: guide.feature,
    title: guide.title,
    description: guide.description,
    publishedOn: guide.publishedOn,
    cover: guide.cover,
  };
}
