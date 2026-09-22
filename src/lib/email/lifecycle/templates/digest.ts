import { analysisCard } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, greeting, note, preheaderOf, signoff, textOf, url } from "../copy";

// Flow B, the Free tier's own feature mailed to them on the DIGEST_DAYS
// cadence. 3,763 people are on Free with Daily Analysis already unlocked and
// have never been told. So this is not a pitch: it is the thing itself. One
// soft line at the end says what else Free keeps — no ladder, no ask.
//
// v2: the card IS the email (design §3). The cover rides as the hero, the bias
// becomes a badge, and the copy carries no paragraphs at all — which is why
// `defaultCopy.paragraphs` is [] and `subject` is a token template rather than
// a sentence (plan §0.2).

const BIAS: Record<string, string> = { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" };

export const defaultCopy: LifecycleCopy = {
  subject: "Gold today: {title} ({bias} bias)",
  preheader: "Where price sat overnight, the levels the desk is watching, and today's bias.",
  paragraphs: [],
  ctaLabel: "Read the full analysis",
};

/** What Free keeps. Structure, not copy: it is the same promise every time. */
const KEEPS =
  "Daily Analysis stays open on your free account, along with Know Your Style, the economic calendar, live news and Module 1 of the MM System course. Nothing to do and nothing to pay — it's there every trading day.";

/** `{title}` and `{bias}` substituted; `{bias}` drops with its brackets when
 *  the desk published no bias for today. */
export function subjectFor(template: string, title: string, bias: string | null): string {
  return template
    .replace(/\s*\(\{bias\}[^)]*\)/g, bias ? ` (${bias.toLowerCase()} bias)` : "")
    .replace(/\{title\}/g, title)
    .replace(/\{bias\}/g, bias ? bias.toLowerCase() : "");
}

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const link = url(ctx, "/daily-analysis", "nurture-digest");
  const da = ctx.todayAnalysis;
  const title = da?.title ?? "Today's XAU/USD read";
  const bias = da?.bias ? (BIAS[da.bias] ?? da.bias) : null;

  const card = analysisCard({
    title,
    bias: da?.bias ?? null,
    description: da?.description ?? null,
    href: link,
    ctaLabel: copy.ctaLabel,
  });
  const hello = greeting(ctx);
  const keeps = note(KEEPS);
  const sign = signoff();

  return {
    subject: subjectFor(copy.subject, title, bias),
    preheader: preheaderOf(copy),
    ...(da?.coverUrl ? { hero: { kind: "image" as const, src: da.coverUrl, alt: title } } : {}),
    html: [hello.html, card.html, keeps.html, sign.html].join(""),
    text: textOf([hello.text, card.text, keeps.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, defaultCopy));

export default template;
