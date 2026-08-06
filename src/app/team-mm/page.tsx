import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccess, isMemberActive } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { MembersOnly } from "@/components/MembersOnly";
import { TeamMMMember } from "./TeamMMMember";

export const metadata: Metadata = {
  title: "Team MM — Market Makers FX",
  description: "The private MM desk — VIP signals for funded members.",
};

export default async function TeamMMPage() {
  const access = await getAccess();
  if (!access.signedIn) redirect("/login");

  const firstName = access.profile?.full_name?.trim()
    ? access.profile.full_name.trim().split(/\s+/)[0]
    : "";

  return (
    <AppShell
      email={access.profile?.email ?? ""}
      accountStatus={access.profile?.account_status ?? "trial_active"}
      tier={access.tier}
      isAdmin={access.profile?.is_admin ?? false}
    >
      {isMemberActive(access) ? (
        <TeamMMMember firstName={firstName} />
      ) : (
        <MembersOnly
          feature="Team MM"
          blurb="Team MM is our private desk — a VIP channel where Don sends extra, higher-conviction signals and member-only calls. It unlocks the moment you become a funded member."
        />
      )}
    </AppShell>
  );
}
