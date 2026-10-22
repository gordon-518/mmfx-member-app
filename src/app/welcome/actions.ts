"use server";

import { createClient } from "@/lib/supabase/server";

// Onboarding step 1 (22 Oct): the public Telegram channel. Telegram never
// tells us whether someone joined — only the app's own click is knowable — so
// this records exactly that and the UI claims no more. fn_log_event takes the
// user from auth.uid(), accepts only known steps, and dedupes, so repeat
// clicks are no-ops. Fire-and-forget: never throws back to the page.
export async function markChannelOpened(): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_log_event", {
      p_event: "onboarding_step_done",
      p_props: { step: "telegram" },
    });
    if (error) console.error("[onboarding] telegram failed:", error.message);
  } catch (e) {
    console.error("[onboarding] telegram threw:", e);
  }
}
