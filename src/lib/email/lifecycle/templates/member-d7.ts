import type { LifecycleTemplate } from "../types";
import { cta, esc, hi, p, SIGNOFF, textOf, url } from "../copy";

// Flow D, a week after a deposit is verified at Desk or above. Desk members
// find the indicators immediately and the Fundamental Desk almost never. One
// action: open it once.

const template: LifecycleTemplate = (ctx) => {
  const link = url(ctx, "/bots/fundamental", "member-d7");
  const body = [
    "A week in. You've almost certainly found the indicators. The Fundamental Desk you almost certainly haven't, so here it is.",
    "It's a live macro read on gold, in plain English: the current fundamental picture driving XAUUSD — the dollar, real yields, what the central banks are signalling, and which line on this week's calendar is the one that matters.",
    "If you've ever watched gold move hard and had no idea what caused it, that's the page to have open.",
    "Live classes with the desk are on your tier too — the schedule sits in the app alongside it.",
  ];

  return {
    subject: "This week at the Fundamental Desk",
    html: [p(esc(hi(ctx.firstName))), ...body.map((b) => p(esc(b))), cta(link, "Open the Fundamental Desk"), p(esc(SIGNOFF))].join(""),
    text: textOf([hi(ctx.firstName), ...body, `Open the Fundamental Desk: ${link}`, SIGNOFF]),
  };
};

export default template;
