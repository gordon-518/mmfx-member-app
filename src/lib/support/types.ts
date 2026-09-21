import type { MemberTier } from "@/lib/tiers";

export interface OfficialAccount { handle: string; label: string }
export interface ApprovedFlow { label: string; link?: string; flow_id?: string; use_when: string }

/** The support_settings row (id = 1). */
export interface SupportSettings {
  enabled: boolean;
  bonus_code: string;
  bonus_code_expires: string; // YYYY-MM-DD
  official_accounts: OfficialAccount[];
  office_hours: string;
  trade_cadence: string;
  notes: string;
  approved_flows: ApprovedFlow[];
}

/** One message in a SendPulse thread, oldest-first once normalised. */
export interface ThreadMessage {
  id: string;
  direction: "in" | "out";
  /** Sent by a SendPulse flow, trigger or broadcast (not a person, not the agent). */
  fromFlow: boolean;
  text: string;
  at: string; // ISO timestamp
}

export interface ContactInfo {
  id: string;
  username: string | null;
  firstName: string;
  /** Arrived through Admin Amelia's account (Telegram Business). */
  isBusiness: boolean;
  tags: string[];
}

export interface MemberContext {
  userId: string;
  matchedBy: "ref" | "handle";
  tier: MemberTier;
  trialEndsAt: string | null;
  submission: { status: "pending" | "verified" | "rejected"; rejectReason: string | null; createdAt: string } | null;
  /**
   * True only when the platform-attested Telegram username resolved to this
   * member. A self-asserted MM- reference code alone is NOT attested: it can be
   * forwarded or pasted from someone else's screenshot, so it must never unlock
   * private status.
   */
  attested: boolean;
}

export const TOPICS = [
  "join", "plans", "deposit", "broker", "switch_ib", "bonus", "trial", "login", "access",
  "team_mm", "indicators", "lifetime", "official_accounts", "reference_code", "greeting",
  "money", "complaint", "deletion", "other",
] as const;
export type Topic = (typeof TOPICS)[number];

export interface Decision {
  action: "reply" | "handoff";
  topic: Topic;
  confidence: number; // 0..1
  reply: string;
  reason: string;
}

export interface FactSheet {
  /** The facts block placed in the system prompt. */
  text: string;
  allow: {
    amounts: Set<number>;
    urls: string[];
    appPaths: string[];
    handles: Set<string>; // lowercase, no @
    ibNumber: string;
    /** Null when there is no current code (expired). */
    bonusCode: string | null;
    flowIds: Set<string>;
  };
}
