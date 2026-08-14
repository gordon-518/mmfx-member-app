import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
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

  return (
    <AppShell
      email={access.profile?.email ?? ""}
      accountStatus={access.profile?.account_status ?? "trial_active"}
      tier={access.tier}
      isAdmin={access.profile?.is_admin ?? false}
    >
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        <RoadmapJourney />
        <div className="mt-10 flex justify-center border-t border-line pt-8">
          <EnterDeskButton />
        </div>
      </div>
    </AppShell>
  );
}
