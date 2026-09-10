import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/access";
import { canWatchLesson } from "@/lib/access/course";
import { createClient } from "@/lib/supabase/server";
import { isDemoUser } from "@/lib/showcase";
import { MODULES, SLIDES_BUCKET, lessonBySlug } from "@/app/course/courseData";

// Gated PPT delivery — same proven pattern as /api/ebooks/[slug] (Day 7).
//   1. requireFeature() + canWatchLesson() — Free users get Module 1's decks
//      only; anything else redirects to /upgrade before any storage call
//      (signed-out -> /login). conversion-fix 2.3.
//   2. Download via the USER's authenticated server client, so the `slides`
//      storage RLS policy (is_full_access) double-enforces tier. No
//      service_role, no getPublicUrl; the bucket is never public.

const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Gate 1: signed in. The course is a free feature; lessons are gated below.
  const gate = await requireFeature("course", { onLocked: "redirect", log: false });
  const profile = gate.profile;

  // Showcase demo account may view the UI but never pull the paid file bytes.
  if (isDemoUser(profile.email)) {
    return new Response("Not available in showcase", { status: 403 });
  }

  const { slug } = await params;

  // Whitelist — only the known lessons; no traversal / arbitrary objects.
  const lesson = lessonBySlug(slug);
  if (!lesson) {
    return new Response("Not found", { status: 404 });
  }

  // Gate 1b: the lesson itself. Free users get Module 1 only.
  if (!canWatchLesson(lesson.number, MODULES, gate.viewer)) {
    redirect("/upgrade");
  }

  // Gate 2: authenticated user client -> storage RLS applies.
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(SLIDES_BUCKET)
    .download(lesson.pptFile);

  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": PPTX_CONTENT_TYPE,
      // RFC 5987 encoding — injection-proof regardless of slug content.
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        `${slug}.pptx`
      )}`,
      "X-Content-Type-Options": "nosniff",
      // Private, per-user content — never cache in shared/CDN layers.
      "Cache-Control": "private, no-store",
    },
  });
}
