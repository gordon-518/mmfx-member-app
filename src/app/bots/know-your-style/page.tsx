import { requireFeature } from "@/lib/access";
import { LockedFeature } from "@/components/LockedFeature";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { KysFlow, type SavedProfile } from "./KysFlow";
import type { DimensionScores } from "@/lib/kys/types";

// Know Your Style runs natively here (21 Oct) instead of in an iframe. The
// assessment, the scoring and the report all live in this app now, so the
// result is saved to the member's row on completion rather than only when
// they email themselves a copy — see migration 20261021000001.

export default async function KnowYourStylePage() {
  // Gate (conversion-fix 2.2): signed-out -> /login; locked -> preview.
  const gate = await requireFeature("know-your-style");
  if (gate.locked) return <LockedFeature feature="know-your-style" gate={gate} />;
  const profile = gate.profile;

  // Their own row only (RLS). A member who has taken it reads their profile
  // back instead of being shown a blank questionnaire.
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("kys_archetype, kys_dimensions, kys_report, kys_updated_at, kys_completed_at")
    .eq("id", profile.id)
    .maybeSingle();

  const saved: SavedProfile | null =
    data?.kys_archetype && data.kys_dimensions && data.kys_report
      ? {
          archetype: data.kys_archetype as string,
          dimensions: data.kys_dimensions as DimensionScores,
          report: data.kys_report as string,
          takenAt: (data.kys_updated_at as string | null) ?? (data.kys_completed_at as string | null),
        }
      : null;

  return (
    <AppShell
      email={profile.email}
      accountStatus={profile.account_status}
      memberTier={gate.viewer.tier}
      isAdmin={profile.is_admin}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-8 lg:py-10">
        <div className="rise mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">Bots · Profile</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
            Know Your Style
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            Fourteen questions, then a written breakdown of how you trade: your archetype, your six
            dimensions, and the leak costing you money.
          </p>
        </div>

        <KysFlow saved={saved} />
      </div>
    </AppShell>
  );
}
