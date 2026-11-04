import { button } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, note, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow B, weekly, to the Free tier. This is the one template with no body copy
// of its own: the body is composed by the Marketing Brain, put through its
// compliance gate and approved by a human in Notion, and the member app only
// wraps it. Everything here is the envelope — the greeting, the link to the
// guide with its cid, one soft ladder line, the signature. The single action is
// whatever the brain's guide is about.
//
// The rail reads the approved row out of `email_spotlights` and passes it on
// the ctx. `types.ts` is shared with the rail and deliberately not widened for
// one template, so the extra field is narrowed here instead.
//
// Its `LifecycleCopy` therefore covers only the envelope (plan §0.2): the
// brain's subject wins when there is one, and `paragraphs` is the fallback
// body used on the week the guide is late.

interface SpotlightPayload {
  subject: string;
  html: string;
  text: string;
  guideUrl: string;
}

type SpotlightCtx = LifecycleCtx & { spotlight?: SpotlightPayload };

const CID = "EML-nurture-spotlight";

function withCid(href: string): string {
  if (href.includes("cid=")) return href;
  return `${href}${href.includes("?") ? "&" : "?"}cid=${CID}`;
}

/** The guide's Open Graph image, drawn by the site from the guide's cover spec
 *  (guide v2 §3). Same origin and path as the guide, query and hash dropped. */
export function coverUrlFor(guideUrl: string): string | null {
  try {
    const u = new URL(guideUrl);
    if (!/^\/guides\/[a-z0-9-]+\/?$/.test(u.pathname)) return null;
    return `${u.origin}${u.pathname.replace(/\/$/, "")}/opengraph-image`;
  } catch {
    return null;
  }
}

export const defaultCopy: LifecycleCopy = en.lifecycle.spotlight.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const s = (ctx as SpotlightCtx).spotlight;
  const t = wordsOf(ctx).lifecycle.spotlight;
  const hello = greeting(ctx);
  const sign = signoff(ctx);

  // Fallback: the rail should never claim a spotlight send without an approved
  // row, but a template must not throw inside a cron loop either.
  if (!s) {
    const link = url(ctx, "/daily-analysis", "nurture-spotlight");
    const words = paragraphs(copy);
    const cta = button(link, t.fallbackCta);
    return {
      subject: copy.subject,
      preheader: preheaderOf(copy),
      html: [hello.html, words.html, cta.html, sign.html].join(""),
      text: textOf([hello.text, words.text, cta.text, sign.text]),
    };
  }

  const guide = withCid(s.guideUrl);
  const cta = button(guide, copy.ctaLabel);
  const ladderLine = note(t.ladder);

  const cover = coverUrlFor(s.guideUrl);

  // The brain writes the guide in English. A reader in another language gets
  // the envelope in theirs, the translated default subject in place of the
  // brain's English one, and a line saying the guide below is in English.
  const english = t.guideInEnglish ? [note(t.guideInEnglish)] : [];
  const subject = english.length ? copy.subject : s.subject;

  return {
    subject,
    preheader: preheaderOf(copy),
    ...(cover ? { hero: { kind: "image" as const, src: cover, alt: s.subject } } : {}),
    html: [hello.html, ...english.map((e) => e.html), s.html, cta.html, ladderLine.html, sign.html].join(""),
    text: textOf([hello.text, ...english.map((e) => e.text), s.text, cta.text, ladderLine.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.spotlight.copy));

export default template;
