// Shared copy primitives for the lifecycle templates. Pure, tiny, and
// deliberately unopinionated: every template still writes its own sentences.
// This exists so the fourteen builders agree on escaping, on the shape of a
// paragraph, and above all on the `cid` convention — attribution that is
// hand-rolled fourteen times is attribution that is wrong at least once.
//
// html is a BODY FRAGMENT. The rail's shell (src/lib/email/shell.ts) supplies
// the black header, the hero, the risk line, the footer and the unsubscribe
// link, so nothing here repeats them.
//
// v2 split a template in two: its STRUCTURE (which module, which link, which
// data) stays in the template file, and its WORDS live in a `LifecycleCopy`.
// The template renders `ctx.copy ?? defaultCopy`, which is the whole mechanism
// behind variant arms — a challenger is a row of JSON, not a deploy.

import { paragraph } from "@/lib/email/ui";
import type { EmailPart } from "@/lib/email/ui";
import type { LifecycleCopy, LifecycleCtx } from "./types";

/** The one accent colour. */
export const ORANGE = "#FF5A1F";

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

/** A paragraph. `inner` is trusted HTML — escape anything interpolated first. */
export function p(inner: string): string {
  return paragraph(inner);
}

/** The approved words for this send: a challenger's, or the code default. */
export function copyOf(ctx: LifecycleCtx, fallback: LifecycleCopy): LifecycleCopy {
  return ctx.copy ?? fallback;
}

/** The copy's body paragraphs, in both renderings. */
export function paragraphs(copy: LifecycleCopy): EmailPart {
  return {
    html: copy.paragraphs.map((t) => p(esc(t))).join(""),
    text: copy.paragraphs.join("\n\n"),
  };
}

/**
 * The inbox preview line. Falls back to the opening sentence rather than
 * letting the client invent one out of the greeting — an email whose preview
 * reads "Hi Alex, Market Makers is a trading desk…" has spent its first
 * impression on the word "Hi".
 */
export function preheaderOf(copy: LifecycleCopy): string {
  const preheader = copy.preheader.trim();
  if (preheader) return preheader;
  const first = (copy.paragraphs[0] ?? "").trim();
  return first.length <= 90 ? first : `${first.slice(0, 87).trimEnd()}...`;
}

/** The greeting, in both renderings. */
export function greeting(ctx: LifecycleCtx): EmailPart {
  const line = hi(ctx.firstName);
  return { html: p(esc(line)), text: line };
}

/** The signature, in both renderings. */
export function signoff(): EmailPart {
  return {
    html: `<p style="margin:18px 0 0;font:400 13px/1.6 Inter,Arial,sans-serif;color:#6b665e">${esc(SIGNOFF)}</p>`,
    text: SIGNOFF,
  };
}

/** A quiet closing note above the signature — what Free keeps, and the like. */
export function note(text: string): EmailPart {
  return {
    html: `<p style="margin:18px 0 0;font:400 13px/1.6 Inter,Arial,sans-serif;color:#6b665e">${esc(text)}</p>`,
    text,
  };
}

/** The plain-text body: real sentences, written for text, joined by blank lines. */
export function textOf(lines: string[]): string {
  return lines.filter((l) => l.length > 0).join("\n\n");
}
