import type { LifecycleCtx, LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow B, weekly, to the Free tier. This is the one template with no copy of
// its own: the body is composed by the Marketing Brain, put through its
// compliance gate and approved by a human in Notion, and the member app only
// wraps it. Everything here's the envelope — the greeting, the link to the
// guide with its cid, one soft ladder line, the signature. The single action is
// whatever the brain's guide is about.
//
// The rail reads the approved row out of `email_spotlights` and passes it on
// the ctx. `types.ts` is shared byte-for-byte with the rail and deliberately
// not widened for one template, so the extra field is narrowed here instead.

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

const template: LifecycleTemplate = (ctx) => {
  const s = (ctx as SpotlightCtx).spotlight;

  // Fallback: the rail should never claim a spotlight send without an approved
  // row, but a template must not throw inside a cron loop either.
  if (!s) {
    const link = url(ctx, "/daily-analysis", "nurture-spotlight");
    const body = [
      "This week's guide isn't out yet, so here's what's always there: the desk's read on gold, posted every trading morning.",
      "Where price sat overnight, the levels the desk is watching, and the bias it's working from. It's on your account whether you deposit or not.",
    ];
    return {
      subject: "From the desk this week",
      html: [p(esc(hi(ctx.firstName))), ...body.map((b) => p(esc(b))), cta(link, "Open today's analysis"), p(esc(SIGNOFF))].join(""),
      text: textOf([hi(ctx.firstName), ...body, `Open today's analysis: ${link}`, SIGNOFF]),
    };
  }

  const guide = withCid(s.guideUrl);

  return {
    subject: s.subject,
    html: [p(esc(hi(ctx.firstName))), s.html, cta(guide, "Read the full guide"), p(esc(LADDER)), p(esc(SIGNOFF))].join(""),
    text: textOf([hi(ctx.firstName), s.text, `Read the full guide: ${guide}`, LADDER, SIGNOFF]),
  };
};

export default template;
