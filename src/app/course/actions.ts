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

/**
 * Course progress, kept on the member rather than in one browser (22 Oct).
 * The player still writes localStorage for instant feedback; this makes the
 * same set follow them to another device, and feeds the dashboard's skill
 * track. fn_save_course_progress union-merges, so an out-of-date device can
 * never shrink what another one recorded. Fire-and-forget: never throws back
 * to the player.
 */
export async function saveCourseProgress(slugs: string[]): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("fn_save_course_progress", { p_slugs: slugs });
    if (error) {
      console.error("[course] progress save failed:", error.message);
      return [];
    }
    return Array.isArray(data) ? (data as string[]) : [];
  } catch (e) {
    console.error("[course] progress save threw:", e);
    return [];
  }
}
