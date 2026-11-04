import { button, tracker } from "@/lib/email/ui";
import { en } from "@/lib/email/i18n/en";
import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "../types";
import { fmt } from "@/i18n/format";
import { copyOf, deskWritesEnglish, esc, greeting, p, paragraphs, preheaderOf, signoff, textOf, url, wordsOf } from "../copy";

// Flow A, day 1 of the 14-day trial, only if they have never opened the Daily
// Analysis. It names today's read by title and bias so the email is the thing
// itself, not an advert for it, and asks for one action: open today's analysis.

export const defaultCopy: LifecycleCopy = en.lifecycle.analysis.copy;

export function build(ctx: LifecycleCtx, copy: LifecycleCopy): LifecycleEmail {
  const w = wordsOf(ctx);
  const t = w.lifecycle.analysis;
  const link = url(ctx, "/daily-analysis", "trial-analysis");
  const today = ctx.todayAnalysis;
  const words = paragraphs(copy);
  const list = tracker(ctx.onboarding, "analysis", w);
  const cta = button(link, copy.ctaLabel);
  const hello = greeting(ctx);
  const sign = signoff(ctx);

  // The bias is nullable (most reads carry one, not all): without one the
  // sentence names the read alone rather than printing "bias null".
  const bias = today?.bias ? (w.common.bias[today.bias] ?? today.bias).toLowerCase() : null;
  const lead = bias ? t.todayUp : w.lifecycle.welcome.todayReadNoBias;
  const todayHtml = today
    ? fmt(esc(lead), { title: `<b>${esc(today.title)}</b>`, bias: esc(bias ?? "") })
    : esc(t.noRead);
  const todayText = today ? fmt(lead, { title: today.title, bias: bias ?? "" }) : t.noRead;
  const english = today ? deskWritesEnglish(ctx) : [];

  return {
    subject: copy.subject,
    preheader: preheaderOf(copy),
    html: [hello.html, words.html, p(todayHtml), ...english.map((e) => e.html), list.html, cta.html, sign.html].join(""),
    text: textOf([hello.text, words.text, todayText, ...english.map((e) => e.text), list.text, cta.text, sign.text]),
  };
}

const template: LifecycleTemplate = (ctx) => build(ctx, copyOf(ctx, wordsOf(ctx).lifecycle.analysis.copy));

export default template;
