// Shared copy primitives for the lifecycle templates. Pure, tiny, and
// deliberately unopinionated: every template still writes its own sentences.
// This exists so the twelve builders agree on escaping, on the shape of a
// paragraph, and above all on the `cid` convention — attribution that is
// hand-rolled twelve times is attribution that is wrong at least once.
//
// html is a BODY FRAGMENT. The rail's shell (src/lib/email/lifecycle/shell.ts)
// supplies the dark header, the risk line, the footer and the unsubscribe link,
// so nothing here repeats them.

import type { LifecycleCtx } from "./types";

/** The one accent colour, on the one link. */
export const ORANGE = "#ea580c";

export const SIGNOFF = "— Don, Market Makers FX";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** "Hi Alex," — first word only, so a full name in the column still reads right. */
export function hi(firstName: string | null): string {
  const first = firstName?.trim().split(/\s+/)[0];
  return first ? `Hi ${first},` : "Hi,";
}

/**
 * An in-app link carrying its lifecycle attribution: `?cid=EML-<flow>-<step>`.
 * `attr_cid` already exists on signup and deposit rows, so a cid is the whole
 * measurement story — pass it, or the send is unattributable.
 */
export function url(ctx: LifecycleCtx, path: string, cid: string): string {
  const base = ctx.appUrl.replace(/\/+$/, "");
  return `${base}${path}?cid=EML-${cid}`;
}

const P = "margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1714";

/** A paragraph. `inner` is trusted HTML — escape anything interpolated first. */
export function p(inner: string): string {
  return `<p style="${P}">${inner}</p>`;
}

/** The single call to action. One per email, by house rule. */
export function cta(href: string, label: string): string {
  return `<p style="${P}"><a href="${esc(href)}" style="color:${ORANGE};font-weight:600;text-decoration:none">${esc(label)} &rarr;</a></p>`;
}

/** The plain-text body: real sentences, written for text, joined by blank lines. */
export function textOf(lines: string[]): string {
  return lines.filter((l) => l.length > 0).join("\n\n");
}
