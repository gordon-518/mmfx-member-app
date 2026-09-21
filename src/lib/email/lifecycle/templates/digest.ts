import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow B, the Free tier's own feature mailed to them on the DIGEST_DAYS
// cadence. 3,763 people are on Free with Daily Analysis already unlocked and
// have never been told. So this is not a pitch: it is the thing itself. One
// soft line at the end says what else Free keeps — no ladder, no ask.

const BIAS: Record<string, string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
};

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/daily-analysis", "nurture-digest");
  const da = ctx.todayAnalysis;

  const title = da?.title ?? "Today's XAU/USD read";
  const bias = da?.bias ? BIAS[da.bias] ?? da.bias : null;
  const description = da?.description ?? null;

  const intro = "Here's what the desk is watching on XAU/USD today.";
  const keeps =
    "Daily Analysis stays open on your free account, along with Know Your Style, the economic calendar, live news and Module 1 of the MM System course. Nothing to do and nothing to pay — it's there every trading day.";

  const readHtml = [
    `<b>${esc(title)}</b>`,
    bias ? `<br>Bias: ${esc(bias)}` : "",
    description ? `<br>${esc(description)}` : "",
  ].join("");

  const readText = [title, bias ? `Bias: ${bias}` : "", description ?? ""]
    .filter((l) => l.length > 0)
    .join("\n");

  return {
    subject: bias ? `Gold today: ${title} (${bias.toLowerCase()} bias)` : `Gold today: ${title}`,
    html: [
      p(esc(hi(ctx.firstName))),
      p(esc(intro)),
      p(readHtml),
      cta(link, "Read the full analysis"),
      p(esc(keeps)),
      p(esc(SIGNOFF)),
    ].join(""),
    text: textOf([
      hi(ctx.firstName),
      intro,
      readText,
      `Read the full analysis: ${link}`,
      keeps,
      SIGNOFF,
    ]),
  };
};

export default template;
