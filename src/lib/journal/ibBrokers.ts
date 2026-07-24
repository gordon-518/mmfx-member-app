import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IbBrokerRow } from "./types";

/** Load the broker registry (service-role client). */
export async function loadBrokers(db: SupabaseClient): Promise<IbBrokerRow[]> {
  const { data } = await db
    .from("ib_brokers")
    .select(
      "id, display_name, enforcement_mode, parse_config, allowlist_updated_at"
    )
    .order("id");
  return (data ?? []) as IbBrokerRow[];
}

/**
 * Soft check that a free-text server string is consistent with the selected
 * broker — closes the "pick the other broker to dodge the reconcile" hole.
 * Returns true if it's fine or we can't tell; false only on a clear conflict.
 */
export function serverMatchesBroker(server: string, brokerId: string): boolean {
  const s = server.toLowerCase();
  const mentions: Record<string, boolean> = {
    dupoin: s.includes("dupoin"),
    elev8_octa: s.includes("elev8") || s.includes("octa"),
  };
  const thisBroker = mentions[brokerId] ?? false;
  const otherBroker = Object.entries(mentions).some(
    ([id, hit]) => id !== brokerId && hit
  );
  // Conflict only when the server clearly names a DIFFERENT broker and not this one.
  return !(otherBroker && !thisBroker);
}
