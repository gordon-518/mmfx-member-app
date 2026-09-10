"use server";

import { createClient } from "@/lib/supabase/server";
import { isClientEvent, sanitizeClientProps } from "@/lib/eventNames";

// Funnel clicks on /upgrade (conversion-fix 1.3): broker links and the
// WhatsApp / Telegram contact buttons. Called fire-and-forget from the browser
// as the link opens in a new tab, so it must never throw back to the caller.
//
// Both arguments come from the browser, so they're validated here AND by the
// database: fn_log_event takes the user from auth.uid() and accepts only the
// two click events, so a caller can't log for someone else or forge a
// server-side event such as deposit_verified.
export async function logUpgradeClick(event: unknown, props: unknown): Promise<void> {
  if (!isClientEvent(event)) return;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_log_event", {
      p_event: event,
      p_props: sanitizeClientProps(event, props),
    });
    if (error) console.error(`[events] ${event} failed:`, error.message);
  } catch (e) {
    console.error(`[events] ${event} threw:`, e);
  }
}
