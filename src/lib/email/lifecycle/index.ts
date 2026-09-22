// The lifecycle template registry: (flow, step) -> pure builder.
//
// fn_claim_email_sends decides WHICH (flow, step) a user is due; this maps
// that pair to the copy. The flows and steps are the design doc's §3, and the
// step names are the same strings the SQL emits — change one, change both
// (claim.test.ts fails if they drift).
//
// A template returns a BODY FRAGMENT and its plain-text twin (copy.ts).
// renderLifecycle() wraps it in the branded shell and appends the risk line,
// so no template can forget either.
//
// Every step's copy lives in ./templates/<step>.ts, named exactly after the
// step, default-exported. All fourteen are real: there are deliberately no
// stubs, because a stub that throws inside the cron loop is a render failure
// that has to be unwound, and the simplest way not to have that problem is not
// to ship a template that cannot render.
//
// `spotlight` is the one step whose WORDS come from elsewhere: the brain
// composes and approves the body, the cron route reads the approved row out of
// email_spotlights and hands it to the template on the ctx, and the template
// supplies the envelope around it.

import type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "./types";
import { wrapLifecycle } from "./render";
import analysis, { defaultCopy as analysisCopy } from "./templates/analysis";
import brokerClicked, { defaultCopy as brokerClickedCopy } from "./templates/broker-clicked";
import day12, { defaultCopy as day12Copy } from "./templates/day12";
import digest, { defaultCopy as digestCopy } from "./templates/digest";
import kys, { defaultCopy as kysCopy } from "./templates/kys";
import ladder, { defaultCopy as ladderCopy } from "./templates/ladder";
import lesson1, { defaultCopy as lesson1Copy } from "./templates/lesson1";
import memberD3, { defaultCopy as memberD3Copy } from "./templates/member-d3";
import memberD7, { defaultCopy as memberD7Copy } from "./templates/member-d7";
import memberDormant, { defaultCopy as memberDormantCopy } from "./templates/member-dormant";
import spotlight, { defaultCopy as spotlightCopy } from "./templates/spotlight";
import tv, { defaultCopy as tvCopy } from "./templates/tv";
import upgradeSeen, { defaultCopy as upgradeSeenCopy } from "./templates/upgrade-seen";
import welcome, { defaultCopy as welcomeCopy } from "./templates/welcome";

export type { LifecycleCopy, LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "./types";
export { COMPLIANCE_LINE, contextLabelFor, FOOTER_NOTE, wrapLifecycle } from "./render";

export const FLOWS: Readonly<Record<string, Readonly<Record<string, LifecycleTemplate>>>> = {
  // A. Trial activation (§3A)
  trial: { welcome, analysis, kys, tv, lesson1, ladder, day12 },
  // B. Free-tier nurture (§3B)
  nurture: { digest, spotlight },
  // C. Hot-lead rescue (§3C)
  rescue: { "upgrade-seen": upgradeSeen, "broker-clicked": brokerClicked },
  // D. Member activation (§3D)
  member: { "member-d3": memberD3, "member-d7": memberD7, "member-dormant": memberDormant },
};

/**
 * The approved default words for every step, keyed `"<flow>/<step>"`.
 *
 * This is what a challenger variant is measured against and what the metrics
 * route hands the brain (plan §0.4), so it lives beside the registry rather
 * than being re-derived by importing fourteen modules somewhere else.
 */
export const DEFAULT_COPY: Readonly<Record<string, LifecycleCopy>> = {
  "trial/welcome": welcomeCopy,
  "trial/analysis": analysisCopy,
  "trial/kys": kysCopy,
  "trial/tv": tvCopy,
  "trial/lesson1": lesson1Copy,
  "trial/ladder": ladderCopy,
  "trial/day12": day12Copy,
  "nurture/digest": digestCopy,
  "nurture/spotlight": spotlightCopy,
  "rescue/upgrade-seen": upgradeSeenCopy,
  "rescue/broker-clicked": brokerClickedCopy,
  "member/member-d3": memberD3Copy,
  "member/member-d7": memberD7Copy,
  "member/member-dormant": memberDormantCopy,
};

/** The template for a claimed (flow, step), or null if the pair is unknown. */
export function templateFor(flow: string, step: string): LifecycleTemplate | null {
  return FLOWS[flow]?.[step] ?? null;
}

/** Build the finished, sendable email for a claimed (flow, step). */
export function renderLifecycle(flow: string, step: string, ctx: LifecycleCtx): LifecycleEmail {
  const template = templateFor(flow, step);
  if (!template) throw new Error(`no lifecycle template for ${flow}/${step}`);
  return wrapLifecycle(template(ctx), ctx);
}
