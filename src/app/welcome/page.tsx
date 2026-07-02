import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { RoadmapJourney } from "./RoadmapJourney";
import { EnterDeskButton } from "./EnterDeskButton";

export const metadata: Metadata = {
  title: "Your roadmap — Market Makers FX",
  description: "Your path from reading the market to managing trades like a pro.",
};

export default async function WelcomePage() {
  const access = await getAccess();
  if (!access.signedIn) redirect("/login");

  return (
    <AppShell
      email={access.profile?.email ?? ""}
      accountStatus={access.profile?.account_status ?? "trial_active"}
      tier={access.tier}
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
