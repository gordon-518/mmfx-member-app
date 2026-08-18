import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrowthProfileRow } from "./metrics";

// The growth metrics count over EVERY member row, so the profile fetch must page
// past PostgREST's default 1000-row cap — otherwise (with >1000 members) both the
// live dashboard and the daily snapshot silently undercount. Ordered by id so the
// pages are stable. Service-role (cron) or admin-RLS (dashboard) client both work.

export const GROWTH_PROFILE_COLUMNS =
  "signup_at, account_status, trial_ends_at, deposit_verified_at, downgraded_at, broker, tradingview_username";

const PAGE = 1000;

/** Fetch ALL profile rows for growth metrics, paging past the 1000-row cap. */
export async function fetchAllGrowthProfiles(
  supabase: SupabaseClient
): Promise<GrowthProfileRow[]> {
  const out: GrowthProfileRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("profiles")
      .select(GROWTH_PROFILE_COLUMNS)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as GrowthProfileRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
