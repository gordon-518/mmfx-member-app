import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { parseOnboarding } from "@/lib/onboarding";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { AppShell } from "@/components/AppShell";
import { TradingAccountGate } from "../dashboard/TradingAccountGate";
import { RoadmapJourney } from "./RoadmapJourney";
import { EnterDeskButton } from "./EnterDeskButton";

export const metadata: Metadata = {
  title: "Your roadmap — Market Makers FX",
  description: "Your path from reading the market to managing trades like a pro.",
};

export default async function WelcomePage() {
  const access = await getAccess();
  if (!access.signedIn) redirect("/login");

  // A funded member who hasn't saved a trading account number sees THAT first —
  // not the roadmap. The first-run proxy gate sends new users here, and every
  // other page bounces to the same requirement, so showing the roadmap first
  // just buried the one action that actually unblocks them. Rendered in place
  // (not a redirect) so it can never ping-pong with the proxy's /welcome gate.
  if (
    access.profile?.account_status === "member_active" &&
    !access.profile.trading_account_number
  ) {
    return <TradingAccountGate />;
  }

  // conversion-fix 4.1 — the five-step checklist, read for this user only.
  const supabase = await createClient();
  const { data: onboardingRaw } = await supabase.rpc("fn_my_onboarding");
  const onboarding = parseOnboarding(onboardingRaw);

  return (
    <AppShell
      email={access.profile?.email ?? ""}
      accountStatus={access.profile?.account_status ?? "trial_active"}
      memberTier={access.memberTier}
      isAdmin={access.profile?.is_admin ?? false}
    >
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        <OnboardingChecklist state={onboarding} archetype={access.profile?.kys_archetype} />
        <div className="mt-14 border-t border-line pt-10">
          <RoadmapJourney />
        </div>
        <div className="mt-10 flex justify-center border-t border-line pt-8">
          <EnterDeskButton />
        </div>
      </div>
    </AppShell>
  );
}
