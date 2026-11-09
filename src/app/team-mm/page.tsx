import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { canAccess } from "@/lib/access/features";
import { AppShell } from "@/components/AppShell";
import { MembersOnly } from "@/components/MembersOnly";
import { TeamMMMember } from "./TeamMMMember";
import { getT } from "@/i18n/server";
import { VslPlayer } from "@/components/VslPlayer";

export async function generateMetadata(): Promise<Metadata> {
  const { teamMm } = await getT();
  return { title: teamMm.metaTitle, description: teamMm.metaDescription };
}

export default async function TeamMMPage() {
  const access = await getAccess();
  if (!access.signedIn) redirect("/login");
  const t = await getT();

  const firstName = access.profile?.full_name?.trim()
    ? access.profile.full_name.trim().split(/\s+/)[0]
    : "";

  // Team MM tier only (conversion-fix 3.3); the map admins pass as before.
  const isTeam = canAccess("team-mm", {
    tier: access.memberTier,
    isAdmin: access.profile?.is_admin ?? false,
  });

  return (
    <AppShell
      email={access.profile?.email ?? ""}
      accountStatus={access.profile?.account_status ?? "trial_active"}
      memberTier={access.memberTier}
      isAdmin={access.profile?.is_admin ?? false}
    >
      {isTeam ? (
        <TeamMMMember firstName={firstName} />
      ) : (
        // data-gate: a language-independent marker for the tier-matrix checks.
        <div data-gate="locked">
          <MembersOnly feature={t.tiers.team} blurb={t.teamMm.lockedBlurb}>
            {/* What Team MM is, shown rather than told: the invite flow on video. */}
            <VslPlayer video="team-mm" />
          </MembersOnly>
        </div>
      )}
    </AppShell>
  );
}
