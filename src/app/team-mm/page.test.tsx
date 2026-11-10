import { describe, it, expect, vi } from "vitest";
import { prerender } from "react-dom/static";
import type { ReactNode } from "react";
import type { Access, AccessProfile } from "@/lib/access";
import type { AccountStatus } from "@/lib/trial/status";
import type { MemberTier } from "@/lib/tiers";
import { I18nProvider } from "@/i18n/client";
import { MESSAGES } from "@/i18n/messages";

// The page picks the viewer the lock panel speaks to. Rendered against a
// stand-in for the access lookup, with the app chrome reduced to its children.
const state = vi.hoisted(() => ({ access: null as unknown }));
vi.mock("@/lib/access", () => ({ getAccess: async () => state.access }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/i18n/server", async () => {
  const { MESSAGES } = await vi.importActual<typeof import("@/i18n/messages")>("@/i18n/messages");
  return { getT: async () => MESSAGES.en };
});

import TeamMMPage from "./page";

const PROFILE: AccessProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "member@example.com",
  full_name: "Sam Lee",
  account_status: "trial_active",
  trial_ends_at: null,
  trial_count: 1,
  downgraded_at: null,
  member_status: "inactive",
  is_admin: false,
  tradingview_username: null,
  kys_completed_at: null,
  kys_archetype: null,
  trading_account_number: null,
  deposit_amount: null,
  grandfathered: false,
  lifetime_plan: null,
};

function viewer(account_status: AccountStatus, memberTier: MemberTier, earnedTier: MemberTier): Access {
  return {
    signedIn: true,
    profile: { ...PROFILE, account_status },
    tier: memberTier === "free" ? "Limited" : "Full",
    daysLeft: 0,
    memberTier,
    earnedTier,
  };
}

// prerender, not renderToStaticMarkup: the lock panel is itself an async
// server component, and only the streaming renderer waits for it. The
// provider stands in for the root layout's, which the page's client parts
// (the video, the member view) read their strings from.
async function render(access: Access): Promise<string> {
  state.access = access;
  const { prelude } = await prerender(
    <I18nProvider locale="en" messages={MESSAGES.en}>
      {await TeamMMPage()}
    </I18nProvider>
  );
  return (await new Response(prelude).text()).replace(/&#x27;/g, "'");
}

describe("/team-mm, for a viewer below Team MM", () => {
  it("tells a live trial it's on a free trial", async () => {
    expect(await render(viewer("trial_active", "trial", "trial"))).toContain("You're on a free trial");
  });

  it("tells a viewer whose trial has ended that they're on Free", async () => {
    const out = await render(viewer("trial_expired", "free", "free"));
    expect(out).toContain("You're on Free —");
    expect(out).not.toContain("free trial");
  });

  it("tells a Desk member their tier", async () => {
    expect(await render(viewer("member_active", "desk", "desk"))).toContain("You're on Desk —");
  });

  // A running trial ranks with Desk (accessTierFor), so a member whose deposits
  // have only reached Foundation keeps memberTier "trial" until the clock ends.
  // The note goes by what their deposits have earned.
  it("tells a Foundation member still inside their trial clock their tier, not that they're on a trial", async () => {
    const out = await render(viewer("member_active", "trial", "foundation"));
    expect(out).toContain("You're on Foundation —");
    expect(out).toContain("Top up to Team MM");
    expect(out).not.toContain("free trial");
    expect(out).not.toContain("Become a member");
  });

  it("shows a Team MM member the channel, not the lock panel", async () => {
    expect(await render(viewer("member_active", "team", "team"))).not.toContain('data-gate="locked"');
  });
});
