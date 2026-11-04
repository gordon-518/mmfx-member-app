import type { AccountStatus } from "@/lib/trial/status";
import { en } from "@/i18n/messages/en";
import { plural } from "@/i18n/format";
import type { Messages } from "@/i18n/messages/types";

// Pure variant mapper for the dashboard StatusHeader. The persuasion ladder
// is deliberate: trials get informed with a soft nudge, expiry gets the push,
// members get calm confirmation and NEVER an upgrade CTA (loss-aversion
// thesis — the hard sell lives on /upgrade, not here).

export interface HeaderCta {
  href: string;
  label: string;
  /** soft = text link; push = solid button */
  kind: "soft" | "push";
}

export interface HeaderContent {
  eyebrow: string;
  title: string;
  body: string | null;
  cta: HeaderCta | null;
}

export function headerContent(
  status: AccountStatus,
  daysLeft: number,
  /** The reader's copy; English when called without one (tests, emails). */
  s: Messages["status"] = en.status
): HeaderContent {
  // A stored active-trial status with no days left means the lazy-expiry
  // write hasn't landed yet (the tier guard already shows Limited). Never
  // render "0 days left in your trial" next to locked cards — fall through
  // to the expired framing the user is actually experiencing.
  if (daysLeft <= 0 && status === "trial_active") {
    status = "trial_expired";
  } else if (daysLeft <= 0 && status === "re_trial_active") {
    status = "re_trial_expired";
  }

  switch (status) {
    case "trial_active":
      return {
        eyebrow: s.trialEyebrow,
        title: plural(daysLeft, s.trialTitleOne, s.trialTitleOther),
        body: s.trialBody,
        cta: { href: "/upgrade", label: s.trialCta, kind: "soft" },
      };
    case "re_trial_active":
      return {
        eyebrow: s.retrialEyebrow,
        title: plural(daysLeft, s.retrialTitleOne, s.retrialTitleOther),
        body: s.retrialBody,
        cta: { href: "/upgrade", label: s.retrialCta, kind: "soft" },
      };
    case "member_active":
      return { eyebrow: s.memberEyebrow, title: s.memberTitle, body: s.memberBody, cta: null };
    // conversion-fix 2.5 — an expired trial is on Free (the reverse trial), not
    // locked out: say what's still open, then what funding unlocks.
    case "trial_expired":
      return {
        eyebrow: s.freeEyebrow,
        title: s.freeTitle,
        body: s.freeBody,
        cta: { href: "/upgrade", label: s.seeWhatUnlocks, kind: "push" },
      };
    case "re_trial_expired":
      return {
        eyebrow: s.freeEyebrow,
        title: s.refreeTitle,
        body: s.refreeBody,
        cta: { href: "/upgrade", label: s.seeWhatUnlocks, kind: "push" },
      };
    case "member_expired":
      return {
        eyebrow: s.endedEyebrow,
        title: s.endedTitle,
        body: s.endedBody,
        cta: { href: "/upgrade", label: s.endedCta, kind: "push" },
      };
  }
}
