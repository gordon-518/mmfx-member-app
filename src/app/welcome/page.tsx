import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { parseOnboarding } from "@/lib/onboarding";
import type { DimensionScores } from "@/lib/kys/types";
import { StartHere } from "./StartHere";
import { SkillsRadar } from "./SkillsRadar";
import { DeskCoverage } from "./DeskCoverage";
import { CourseTrack } from "./CourseTrack";
import { WhatsInside } from "./WhatsInside";
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
    !access.profile.trading_account_number &&
    !access.profile.lifetime_plan
  ) {
    return <TradingAccountGate />;
  }

  // Everything on this page is the member's own data, read for this user
  // only: the six-step checklist, which tools they have actually opened
  // (fn_my_features, 20261022000002) and their Know Your Style scores.
  const supabase = await createClient();
  const [{ data: onboardingRaw }, { data: featuresRaw }, { data: kys }] = await Promise.all([
    supabase.rpc("fn_my_onboarding"),
    supabase.rpc("fn_my_features"),
    supabase
      .from("profiles")
      .select("kys_dimensions")
      .eq("id", access.profile!.id)
      .maybeSingle(),
  ]);
  const onboarding = parseOnboarding(onboardingRaw);
  const opened = Array.isArray(featuresRaw) ? (featuresRaw as string[]) : [];
  const dimensions = (kys?.kys_dimensions as DimensionScores | null) ?? null;

  return (
    <AppShell
      email={access.profile?.email ?? ""}
      accountStatus={access.profile?.account_status ?? "trial_active"}
      memberTier={access.memberTier}
      isAdmin={access.profile?.is_admin ?? false}
    >
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        <StartHere state={onboarding} archetype={access.profile?.kys_archetype} />

        <div className="mt-12 border-t border-line pt-10">
          <WhatsInside />
        </div>

        <div className="mt-10">
          <DeskCoverage
            opened={opened}
            viewer={{ tier: access.memberTier, isAdmin: access.profile?.is_admin ?? false }}
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <SkillsRadar scores={dimensions} />
          <CourseTrack startedModule1={onboarding.lesson1} />
        </div>

        <div className="mt-12 border-t border-line pt-10">
          <RoadmapJourney state={onboarding} />
        </div>
        <div className="mt-10 flex justify-center border-t border-line pt-8">
          <EnterDeskButton />
        </div>
      </div>
    </AppShell>
  );
}
