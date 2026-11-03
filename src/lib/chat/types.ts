import type { Locale } from "@/i18n/config";
import type { MemberTier } from "@/lib/tiers";

/** Who wrote a message in the in-app support chat. "system" rows carry an
 *  event code (see SystemCode), shown to the member in their language. */
export type ChatRole = "member" | "assistant" | "staff" | "system";

/** The thread's state: the assistant answers ("bot"), or a person has it. */
export type ChatState = "bot" | "needs_human";

export const SYSTEM_CODES = ["handoff", "resolved"] as const;
export type SystemCode = (typeof SYSTEM_CODES)[number];

export interface ChatMessage {
  id: number;
  role: ChatRole;
  body: string;
  created_at: string;
}

/** The signed-in member, as the assistant may see them. */
export interface ChatMember {
  userId: string;
  email: string | null;
  tier: MemberTier;
  trialEndsAt: string | null;
  depositTotal: number;
  submission: { status: "pending" | "verified" | "rejected"; amount: number | null } | null;
  locale: Locale;
}

export const MAX_MESSAGE_CHARS = 1000;
