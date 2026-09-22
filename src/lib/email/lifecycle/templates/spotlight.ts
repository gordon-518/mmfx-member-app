import { button } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, note, paragraphs, preheaderOf, signoff, textOf, url } from "../copy";

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

const LADDER =
  "Everything in this one is on the free side of your account. The paid rungs start at a $50 deposit into your own trading account, and the tier page says what each opens.";

export const defaultCopy: LifecycleCopy = {
  subject: "From the desk this week",
  preheader: "This week's guide from the desk, and the read that is there every day.",
  paragraphs: [
    "This week's guide isn't out yet, so here's what's always there: the desk's read on gold, posted every trading morning.",
    "Where price sat overnight, the levels the desk is watching, and the bias it's working from. It's on your account whether you deposit or not.",
  ],
  ctaLabel: "Read the full guide",
};

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const s = (ctx as SpotlightCtx).spotlight;
  const hello = greeting(ctx);
  const sign = signoff();

  // Fallback: the rail should never claim a spotlight send without an approved
  // row, but a template must not throw inside a cron loop either.
  if (!s) {
    const link = url(ctx, "/daily-analysis", "nurture-spotlight");
    const words = paragraphs(copy);
    const cta = button(link, "Open today's analysis");
    return {
      subject: copy.subject,
      preheader: preheaderOf(copy),
      html: [hello.html, words.html, cta.html, sign.html].join(""),
      text: textOf([hello.text, words.text, cta.text, sign.text]),
    };
  }

  const guide = withCid(s.guideUrl);
  const cta = button(guide, copy.ctaLabel);
  const ladderLine = note(LADDER);

  return {
    subject: s.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, s.html, cta.html, ladderLine.html, sign.html].join(""),
    text: textOf([hello.text, s.text, cta.text, ladderLine.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, defaultCopy));

export default template;
