import "server-only";

import { after } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppEvent } from "./eventNames";

// Server-side event logging (conversion-fix 1.3).
//
// Server Components can't read cookies inside after() — Next throws — so the
// caller's session client is unusable there. This takes the user id the server
// has ALREADY authenticated and writes through fn_log_event_as with the
// service role. Browser clicks use fn_log_event instead (see
// src/app/upgrade/actions.ts), where the user comes from auth.uid().

let admin: SupabaseClient | null = null;
function service(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return admin;
}

/**
 * Log an event for an already-authenticated user, after the response is sent.
 * Never blocks or breaks a render, redirect or action: after() still runs when
 * the request ends in redirect(), and any failure is swallowed and logged.
 */
export function logEventAfter(
  userId: string,
  event: AppEvent,
  props: Record<string, unknown> = {}
): void {
  after(async () => {
    try {
      const { error } = await service().rpc("fn_log_event_as", {
        p_user_id: userId,
        p_event: event,
        p_props: props,
      });
      if (error) console.error(`[events] ${event} failed:`, error.message);
    } catch (e) {
      console.error(`[events] ${event} threw:`, e);
    }
  });
}
