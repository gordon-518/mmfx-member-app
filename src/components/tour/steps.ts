// The guided tour's script. Pure data so it can be tested: every stop points
// at something that is really on screen (the data-tour attributes in
// AppShell), and a stop whose target isn't rendered for this member is skipped
// rather than pointing at nothing. The words for each stop are in the
// dictionary, by key (messages/<locale>/tour.ts).

import type { Messages } from "@/i18n/messages/types";

export type TourStepKey = keyof Messages["tour"]["steps"];

export interface TourStep {
  key: TourStepKey;
  /** The data-tour value to spotlight. Omitted = a centred card. */
  target?: string;
  /** Lives in the sidebar, so the mobile drawer has to be open to see it. */
  inNav?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  { key: "intro" },
  { key: "nav", target: "nav", inNav: true },
  { key: "home", target: "nav-home", inNav: true },
  { key: "read", target: "nav-read", inNav: true },
  { key: "execute", target: "nav-execute", inNav: true },
  { key: "manage", target: "nav-manage", inNav: true },
  { key: "foundations", target: "nav-foundations", inNav: true },
  { key: "account", target: "nav-account", inNav: true },
  { key: "steps", target: "welcome-steps" },
  { key: "done" },
];
