// The how-to carousel: a hook, up to four numbered steps, and a close.
//
// The story carousel (lesson-carousel) runs a narrative arc — problem, cause,
// mechanism, proof, ask. A how-to is a different shape: the reader is following
// instructions, so the slides are ordered and NUMBERED, and the number is the point.
// Reusing the story roles for a procedure produced slides that read as an argument
// rather than a sequence.
import { SLIDE_THEMES, type SlideTheme } from "./slideTheme";

export const HOWTO_ROLES = ["hook", "step1", "step2", "step3", "step4", "cta"] as const;
export type HowToRole = (typeof HOWTO_ROLES)[number];

/** The step number in a role, or null for the hook and the close. */
export function stepIndex(role: string): number | null {
  const m = /^step([1-9])$/.exec(role);
  return m ? Number(m[1]) : null;
}

// Six slides drawn from a five-theme palette, ordered so no two neighbours match and
// the close lands on a colour field rather than trailing off on paper.
const ROLE_THEME: Record<HowToRole, SlideTheme> = {
  hook: SLIDE_THEMES.hook,
  step1: SLIDE_THEMES.context,
  step2: SLIDE_THEMES.mechanism,
  step3: SLIDE_THEMES.proof,
  step4: SLIDE_THEMES.context,
  cta: SLIDE_THEMES.mechanism,
};

export function themeForRole(role: string): SlideTheme {
  return ROLE_THEME[role as HowToRole] ?? ROLE_THEME.hook;
}

export type HowToSlide = {
  role: HowToRole;
  text: string;
  /** 1-based position among the steps actually being shown, or null. */
  step: number | null;
  totalSteps: number;
};

/**
 * The slides to render, in order.
 *
 * Steps that were not written are dropped and the remainder RENUMBERED, so a reader
 * following along sees 1, 2, 3 with no gap. Leaving the original numbering would show
 * "step 3" immediately after "step 1", which reads as a missing slide.
 */
export function howToSlides(slots: Record<string, string>): HowToSlide[] {
  const steps = [1, 2, 3, 4]
    .map((n) => (slots[`step${n}`] ?? "").trim())
    .filter((t) => t.length > 0);

  const out: HowToSlide[] = [];
  const hook = (slots.hook ?? "").trim();
  if (hook) out.push({ role: "hook", text: hook, step: null, totalSteps: steps.length });

  steps.forEach((text, i) => {
    out.push({
      role: `step${i + 1}` as HowToRole,
      text,
      step: i + 1,
      totalSteps: steps.length,
    });
  });

  const cta = (slots.cta ?? "").trim();
  if (cta) out.push({ role: "cta", text: cta, step: null, totalSteps: steps.length });

  return out;
}
