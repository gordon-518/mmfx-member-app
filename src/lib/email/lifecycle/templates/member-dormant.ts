import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow D, once, when a member has not opened anything for thirty days — then
// sixty days of silence regardless of what they do with it. Deliberately the
// quietest email in the set: one door, held open, no argument. One action: read
// today's analysis.

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/daily-analysis", "member-dormant");
  const body = [
    "Your account has been quiet for about a month. No pitch in this one — life happens, and markets are easier to walk away from than to come back to.",
    "The desk has kept doing the same thing every trading morning: its read on gold. Where price sat overnight, the levels it's watching, and the bias it's working from — a short video and a PDF, before the session opens.",
    "That's the easiest way back in, and it's already on your account. Start there rather than trying to catch up on everything at once.",
    "And if Market Makers isn't for you any more, unsubscribe below and we'll leave you alone.",
  ];

  return {
    subject: "It's been a while",
    html: [p(esc(hi(ctx.firstName))), ...body.map((b) => p(esc(b))), cta(link, "See today's read on gold"), p(esc(SIGNOFF))].join(""),
    text: textOf([hi(ctx.firstName), ...body, `See today's read on gold: ${link}`, SIGNOFF]),
  };
};

export default template;
