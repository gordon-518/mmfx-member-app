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
// step, default-exported. Steps whose file hasn't landed on this branch are
// registered as a stub that throws: the registry compiles and the cron keeps
// running (that one send is logged as failed, like any other send failure),
// and the real template drops in by changing one line here to
// `import step from "./templates/<step>"`.
//
// Still stubbed here: analysis, kys, tv, lesson1, ladder, day12,
// upgrade-seen, broker-clicked, member-d3, member-d7, member-dormant,
// spotlight — they arrive on feat/email-lifecycle-copy.
//
// `spotlight` is a special case even once its file lands: its copy is composed
// and approved in the brain and read from email_spotlights by the cron route,
// which never asks the registry for it.

import type { LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "./types";
import { wrapLifecycle } from "./render";
import digest from "./templates/digest";
import welcome from "./templates/welcome";

export type { LifecycleCtx, LifecycleEmail, LifecycleTemplate } from "./types";
export { COMPLIANCE_LINE, FOOTER_NOTE, wrapLifecycle } from "./render";

/** Placeholder for a step whose template file isn't on this branch yet. */
function notImplemented(flow: string, step: string): LifecycleTemplate {
  return () => {
    throw new Error(
      `lifecycle template not implemented: ${flow}/${step} ` +
        `(expected src/lib/email/lifecycle/templates/${step}.ts)`
    );
  };
}

export const FLOWS: Readonly<Record<string, Readonly<Record<string, LifecycleTemplate>>>> = {
  // A. Trial activation (§3A)
  trial: {
    welcome,
    analysis: notImplemented("trial", "analysis"),
    kys: notImplemented("trial", "kys"),
    tv: notImplemented("trial", "tv"),
    lesson1: notImplemented("trial", "lesson1"),
    ladder: notImplemented("trial", "ladder"),
    day12: notImplemented("trial", "day12"),
  },
  // B. Free-tier nurture (§3B)
  nurture: {
    digest,
    spotlight: notImplemented("nurture", "spotlight"),
  },
  // C. Hot-lead rescue (§3C)
  rescue: {
    "upgrade-seen": notImplemented("rescue", "upgrade-seen"),
    "broker-clicked": notImplemented("rescue", "broker-clicked"),
  },
  // D. Member activation (§3D)
  member: {
    "member-d3": notImplemented("member", "member-d3"),
    "member-d7": notImplemented("member", "member-d7"),
    "member-dormant": notImplemented("member", "member-dormant"),
  },
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
