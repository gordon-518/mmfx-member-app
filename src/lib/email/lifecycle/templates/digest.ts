import { analysisCard } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { copyOf, deskWritesEnglish, greeting, note, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow B, the Free tier's own feature mailed to them on the DIGEST_DAYS
// cadence. 3,763 people are on Free with Daily Analysis already unlocked and
// have never been told. So this is not a pitch: it is the thing itself. One
// soft line at the end says what else Free keeps — no ladder, no ask.
//
// v2: the card IS the email (design §3). The cover rides as the hero, the bias
// becomes a badge, and the copy carries no paragraphs at all — which is why
// `defaultCopy.paragraphs` is [] and `subject` is a token template rather than
// a sentence (plan §0.2).

export const defaultCopy: LifecycleCopy = en.lifecycle.digest.copy;

/** `{bias}` and `{title}` substituted. A missing bias takes its separator
 *  with it, so "Gold today: {bias}" renders as "Gold today" rather than
 *  "Gold today: " — the full-width "：" and "，" of a Chinese subject too. */
export function subjectFor(template: string, title: string, bias: string | null): string {
  const out = bias
    ? template.replace(/\{bias\}/g, bias.toLowerCase())
    : template.replace(/\s*\(\{bias\}[^)]*\)/g, "").replace(/[\s,:：，·-]*\{bias\}(\s*bias)?/g, "");
  return out.replace(/\{title\}/g, title).replace(/[\s,:：，·-]+$/, "").trim();
}

/** The desk's description opens with a real headline ("The flip delivered and
 *  the graduation failed its exam.") while `title` is a dated label. Split the
 *  first sentence off as the card's headline; the rest is the teaser, cut at a
 *  word boundary so the email stays a reason to open the read, not the read. */
export function headlineOf(description: string | null): { headline: string | null; teaser: string | null } {
  const text = (description ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { headline: null, teaser: null };
  const m = text.match(/^(.{20,110}?[.!?])(\s+|$)/);
  if (!m) return { headline: null, teaser: clip(text, 240) };
  const rest = text.slice(m[0].length).trim();
  return { headline: m[1], teaser: rest ? clip(rest, 240) : null };
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const w = wordsOf(ctx);
  const t = w.lifecycle.digest;
  const link = url(ctx, "/daily-analysis", "nurture-digest");
  const da = ctx.todayAnalysis;
  const title = da?.title ?? t.fallbackTitle;
  const bias = da?.bias ? (w.common.bias[da.bias] ?? da.bias) : null;

  const { headline, teaser } = headlineOf(da?.description ?? null);
  const card = analysisCard(
    {
      title: headline ?? t.fallbackHeadline,
      bias: da?.bias ?? null,
      description: teaser,
      href: link,
      ctaLabel: copy.ctaLabel,
    },
    w
  );
  // The card's headline and teaser are the desk's own words, in English.
  const english = headline || teaser ? deskWritesEnglish(ctx) : [];
  const hello = greeting(ctx);
  // What Free keeps. Structure, not copy: it is the same promise every time.
  const keeps = note(t.keeps);
  const sign = signoff(ctx);

  return {
    subject: subjectFor(copy.subject, title, bias),
    preheader: preheaderOf(copy),
    ...(da?.coverUrl ? { hero: { kind: "image" as const, src: da.coverUrl, alt: title } } : {}),
    html: [hello.html, card.html, ...english.map((e) => e.html), keeps.html, sign.html].join(""),
    text: textOf([hello.text, card.text, ...english.map((e) => e.text), keeps.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.digest.copy));

export default template;
