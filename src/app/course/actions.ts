"use server";

import { createClient } from "@/lib/supabase/server";

// Onboarding step 4 (conversion-fix Phase 4): Module 1, lesson 1 watched.
// Course progress otherwise lives only in the browser (localStorage), so the
// player tells the server once. fn_log_event takes the user from auth.uid(),
// accepts only the known "lesson-1" step, and dedupes it, so repeats are
// no-ops. Fire-and-forget from the player: never throws back to it.
export async function markLessonOneWatched(): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_log_event", {
      p_event: "onboarding_step_done",
      p_props: { step: "lesson-1" },
    });
    if (error) console.error("[onboarding] lesson-1 failed:", error.message);
  } catch (e) {
    console.error("[onboarding] lesson-1 threw:", e);
  }
}
