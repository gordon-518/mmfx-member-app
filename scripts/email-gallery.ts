/**
 * The review page for the lifecycle emails.
 *
 *   npx tsx scripts/email-gallery.ts > gallery.html
 *
 * Renders all fourteen steps against realistic fixtures and writes one HTML
 * page: each email in its own iframe (so the email's own styles cannot leak
 * into the page around it, and what you see is what the client sees), with its
 * subject, preheader and plain-text twin beside it.
 *
 * Committed on purpose. The v1 gallery was generated ad hoc and thrown away,
 * which meant the only way to see what a copy change did was to re-derive the
 * renderer. Reviewing email by reading TypeScript is how bad emails ship.
 */

import { pathToFileURL } from "node:url";
import { DEFAULT_COPY, FLOWS, renderLifecycle } from "@/lib/email/lifecycle";
import type { LifecycleCtx, LifecycleEmail } from "@/lib/email/lifecycle/types";

const APP_URL = "https://app.marketmakersfx.net";
const COVER =
  "https://vjwrkcxvxaykqvwqbxqe.supabase.co/storage/v1/object/public/analysis-covers/2026-09-22.png";

const SPOTLIGHT = {
  subject: "Liquidity, explained",
  html:
    `<p style="margin:0 0 14px;font:400 15px/1.65 Inter,Arial,sans-serif;color:#2b2926">Equal highs are not a level. They are a shelf of resting stop orders, and price tends to go and take them before it does anything else.</p>` +
    `<p style="margin:0 0 14px;font:400 15px/1.65 Inter,Arial,sans-serif;color:#2b2926">Once you can see where those shelves sit, a lot of moves that looked random stop looking random. This week's guide walks through three of them on gold.</p>`,
  text:
    "Equal highs are not a level. They are a shelf of resting stop orders, and price tends to go and take them before it does anything else.\n\n" +
    "Once you can see where those shelves sit, a lot of moves that looked random stop looking random. This week's guide walks through three of them on gold.",
  guideUrl: "https://www.marketmakersfx.net/guides/liquidity-explained",
};

interface Fixture {
  flow: string;
  step: string;
  note: string;
  ctx: LifecycleCtx;
}

function base(over: Partial<LifecycleCtx> = {}): LifecycleCtx {
  return {
    firstName: "Gordon",
    audience: "trial",
    tier: "trial",
    trialEndsAt: "2026-10-06T00:00:00.000Z",
    daysSinceSignup: 0,
    onboarding: { tv: false, analysis: false, kys: false, lesson1: false, desk: false },
    todayAnalysis: {
      title: "Gold holds beneath the 4,341 shelf",
      bias: "bearish",
      description:
        "Price is holding beneath 4,341 after the overnight rejection. 4,300 is the level that decides whether the bias holds into London.",
      coverUrl: COVER,
    },
    appUrl: APP_URL,
    unsubUrl: `${APP_URL}/api/email/unsubscribe?token=demo-token`,
    ...over,
  };
}

const FIXTURES: Fixture[] = [
  { flow: "trial", step: "welcome", note: "day 0 · nothing done yet", ctx: base() },
  {
    flow: "trial",
    step: "analysis",
    note: "day 1 · has never opened the Daily Analysis",
    ctx: base({ daysSinceSignup: 1 }),
  },
  {
    flow: "trial",
    step: "kys",
    note: "day 2 · read the analysis, hasn't done KYS",
    ctx: base({
      daysSinceSignup: 2,
      onboarding: { tv: false, analysis: true, kys: false, lesson1: false, desk: false },
    }),
  },
  {
    flow: "trial",
    step: "tv",
    note: "day 4 · two steps in, no TradingView username",
    ctx: base({
      daysSinceSignup: 4,
      onboarding: { tv: false, analysis: true, kys: true, lesson1: false, desk: false },
    }),
  },
  {
    flow: "trial",
    step: "lesson1",
    note: "day 6 · three steps in, no lesson finished",
    ctx: base({
      daysSinceSignup: 6,
      onboarding: { tv: true, analysis: true, kys: true, lesson1: false, desk: false },
    }),
  },
  {
    flow: "trial",
    step: "ladder",
    note: "day 9 · the one ladder email of the trial",
    ctx: base({
      daysSinceSignup: 9,
      onboarding: { tv: true, analysis: true, kys: true, lesson1: true, desk: false },
    }),
  },
  {
    flow: "trial",
    step: "day12",
    note: "day 12 · what changes on day 14",
    ctx: base({
      daysSinceSignup: 12,
      firstName: null,
      onboarding: { tv: true, analysis: true, kys: false, lesson1: false, desk: false },
    }),
  },
  {
    flow: "nurture",
    step: "digest",
    note: "Free tier · every trading day, after the desk publishes",
    ctx: base({ audience: "expired", tier: "free", daysSinceSignup: 48 }),
  },
  {
    flow: "nurture",
    step: "digest",
    note: "Free tier · the day no cover was published (hero drops)",
    ctx: base({
      audience: "expired",
      tier: "free",
      daysSinceSignup: 48,
      todayAnalysis: {
        title: "Gold into the London open",
        bias: "neutral",
        description: null,
        coverUrl: null,
      },
    }),
  },
  {
    flow: "nurture",
    step: "spotlight",
    note: "Free tier · Saturday, the brain's approved guide",
    ctx: {
      ...base({ audience: "expired", tier: "free", daysSinceSignup: 62 }),
      ...({ spotlight: SPOTLIGHT } as object),
    } as LifecycleCtx,
  },
  {
    flow: "rescue",
    step: "upgrade-seen",
    note: "48h after viewing /upgrade, no deposit",
    ctx: base({ audience: "expired", tier: "free", daysSinceSignup: 21 }),
  },
  {
    flow: "rescue",
    step: "broker-clicked",
    note: "24h after clicking through to the broker, no deposit",
    ctx: base({ audience: "expired", tier: "free", daysSinceSignup: 22 }),
  },
  {
    flow: "member",
    step: "member-d3",
    note: "Team MM · 3 days after verify, AITA not connected",
    ctx: base({
      audience: "member",
      tier: "team",
      trialEndsAt: null,
      daysSinceSignup: 31,
      onboarding: { tv: true, analysis: true, kys: true, lesson1: true, desk: true },
    }),
  },
  {
    flow: "member",
    step: "member-d7",
    note: "Desk · a week after verify",
    ctx: base({
      audience: "member",
      tier: "desk",
      trialEndsAt: null,
      daysSinceSignup: 35,
      onboarding: { tv: true, analysis: true, kys: true, lesson1: true, desk: true },
    }),
  },
  {
    flow: "member",
    step: "member-dormant",
    note: "member · quiet for 30+ days",
    ctx: base({
      audience: "member",
      tier: "foundation",
      firstName: "Sam O'Neill",
      trialEndsAt: null,
      daysSinceSignup: 120,
      onboarding: { tv: true, analysis: true, kys: true, lesson1: true, desk: true },
    }),
  },
];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function card(f: Fixture, mail: LifecycleEmail): string {
  const copy = DEFAULT_COPY[`${f.flow}/${f.step}`];
  return `<section class="card">
  <header>
    <h2>${esc(f.flow)} / ${esc(f.step)}</h2>
    <p class="note">${esc(f.note)}</p>
    <dl>
      <dt>Subject</dt><dd>${esc(mail.subject)} <span class="count">${mail.subject.length}</span></dd>
      <dt>Preheader</dt><dd>${esc(copy.preheader)} <span class="count">${copy.preheader.length}</span></dd>
      <dt>CTA</dt><dd>${esc(copy.ctaLabel)} <span class="count">${copy.ctaLabel.length}</span></dd>
    </dl>
  </header>
  <iframe title="${esc(f.flow)}/${esc(f.step)}" srcdoc="${esc(mail.html)}"></iframe>
  <details><summary>Plain text (${mail.text.length} chars)</summary><pre>${esc(mail.text)}</pre></details>
</section>`;
}

export function renderGallery(): string {
  const cards = FIXTURES.map((f) => card(f, renderLifecycle(f.flow, f.step, f.ctx))).join("\n");
  const registered = Object.values(FLOWS).flatMap((steps) => Object.keys(steps)).length;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Market Makers FX — lifecycle email gallery v2</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#e9e6e0; font:400 14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:#1a1a1a; }
  .head { padding:32px 32px 8px; max-width:1400px; margin:0 auto; }
  .head h1 { font-size:22px; margin:0 0 6px; }
  .head p { margin:0; color:#6b665e; max-width:70ch; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(640px,1fr)); gap:28px; padding:24px 32px 48px; max-width:1400px; margin:0 auto; }
  .card { background:#fff; border:1px solid #ddd8d0; border-radius:14px; overflow:hidden; }
  .card header { padding:16px 20px; border-bottom:1px solid #eee9e1; }
  .card h2 { margin:0; font-size:15px; font-family:ui-monospace,Menlo,monospace; }
  .note { margin:4px 0 12px; color:#6b665e; font-size:13px; }
  dl { display:grid; grid-template-columns:88px 1fr; gap:2px 12px; margin:0; font-size:13px; }
  dt { color:#8a8f98; }
  dd { margin:0; }
  .count { color:#8a8f98; font-family:ui-monospace,Menlo,monospace; font-size:11px; }
  iframe { display:block; width:100%; height:900px; border:0; background:#e9e6e0; }
  details { border-top:1px solid #eee9e1; padding:12px 20px; }
  summary { cursor:pointer; color:#6b665e; font-size:13px; }
  pre { white-space:pre-wrap; font:400 12px/1.6 ui-monospace,Menlo,monospace; color:#3d3933; margin:12px 0 0; }
</style></head>
<body>
<div class="head">
  <h1>Lifecycle emails — v2 &ldquo;Desk Light&rdquo;</h1>
  <p>${FIXTURES.length} renderings of ${registered} registered steps, from <code>scripts/email-gallery.ts</code>.
  Icons and the two-circle mark resolve to <code>marketmakersfx.net/email/v1/</code>, which Part A ships —
  until that deploys the tiles show as alt text, which is also how they degrade when a client blocks images.</p>
</div>
<div class="grid">
${cards}
</div>
</body></html>`;
}

// Written to stdout so the caller decides where it lands — but only when this
// file IS the entry point, so importing renderGallery() stays side-effect free.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${renderGallery()}\n`);
}
