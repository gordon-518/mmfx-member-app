import type { AccountStatus } from "@/lib/trial/status";

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
  daysLeft: number
): HeaderContent {
  const dayWord = daysLeft === 1 ? "day" : "days";

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
        eyebrow: "Trial · Full access",
        title: `${daysLeft} ${dayWord} left in your trial`,
        body: "Everything on the desk is open while the clock runs.",
        cta: {
          href: "/upgrade",
          label: "Lock in your access anytime",
          kind: "soft",
        },
      };
    case "re_trial_active":
      return {
        eyebrow: "Re-trial · Full access",
        title: `${daysLeft} ${dayWord} left in your re-trial`,
        body: "This is your last trial — there isn't another after this one.",
        cta: {
          href: "/upgrade",
          label: "Lock in your access before it ends",
          kind: "soft",
        },
      };
    case "member_active":
      return {
        eyebrow: "Member",
        title: "You're a funded member",
        body: "Your desk stays open. Trade the session.",
        cta: null,
      };
    case "trial_expired":
      return {
        eyebrow: "Trial ended",
        title: "Your trial's ended",
        body: "The tools are locked — not gone.",
        cta: { href: "/upgrade", label: "Restore full access", kind: "push" },
      };
    case "re_trial_expired":
      return {
        eyebrow: "Access ended",
        title: "Your access has ended — deposit to continue",
        body: "No further trials are available on this account.",
        cta: { href: "/upgrade", label: "Restore full access", kind: "push" },
      };
    case "member_expired":
      return {
        eyebrow: "Membership ended",
        title: "Your membership has been removed",
        body: "Contact us if you think this is a mistake.",
        cta: { href: "/upgrade", label: "Restore your access", kind: "push" },
      };
  }
}
