import { button, tracker } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { fmt } from "@/i18n/format";
import { copyOf, deskWritesEnglish, esc, greeting, p, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow A, day 0, everyone on a live trial. Three jobs in order: say what
// Market Makers is, answer the question nobody asks out loud ("what's the
// catch, if it's free?"), and earn ONE action — reading today's gold bias.
// Nothing about the ladder here; day 9 does that.
//
// v2: the black display hero carries the welcome, and the tracker turns the
// fourteen days into five things rather than a countdown.

export const defaultCopy: LifecycleCopy = en.lifecycle.welcome.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const w = wordsOf(ctx);
  const t = w.lifecycle.welcome;
  const link = url(ctx, "/daily-analysis", "trial-welcome");
  const da = ctx.todayAnalysis;
  const words = paragraphs(copy);
  const list = tracker(ctx.onboarding, "analysis", w);
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff(ctx);

  // Today's read is DATA, not copy: a variant rewrites the sentences around
  // it and never the desk's own headline. The desk writes in English, so a
  // reader in another language is told so once, under it.
  const bias = da?.bias ? (w.common.bias[da.bias] ?? da.bias) : null;
  const lead = bias ? t.todayRead : t.todayReadNoBias;
  const description = da?.description ? ` ${da.description}` : "";
  const today = da ? `${fmt(lead, { title: da.title, bias: bias ?? "" })}${description}` : t.noRead;
  const todayHtml = da
    ? `${fmt(esc(lead), { title: `<b>${esc(da.title)}</b>`, bias: esc(bias ?? "") })}${esc(description)}`
    : esc(today);
  const english = da ? deskWritesEnglish(ctx) : [];

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    hero: { kind: "display", eyebrow: t.heroEyebrow, headline: t.heroHeadline },
    html: [hello.html, words.html, p(todayHtml), ...english.map((e) => e.html), list.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, today, ...english.map((e) => e.text), list.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.welcome.copy));

export default template;
