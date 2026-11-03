import type { Messages } from "../types";

// Foundation, Desk and Team MM are brand names: they appear in emails, in
// SendPulse and in every conversation with Admin Amelia, so they stay as they
// are in every language. Only the plain words are translated.
export const tiers: Messages["tiers"] = {
  free: "免费",
  trial: "试用",
  foundation: "Foundation",
  desk: "Desk",
  team: "Team MM",
};
