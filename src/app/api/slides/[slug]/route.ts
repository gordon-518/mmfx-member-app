import { type NextRequest } from "next/server";
import { requireFull } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { SLIDES_BUCKET, lessonBySlug } from "@/app/course/courseData";

// Gated PPT delivery — same proven pattern as /api/ebooks/[slug] (Day 7).
//   1. requireFull() — Limited users redirect to /upgrade before any storage
//      call (signed-out -> /login).
//   2. Download via the USER's authenticated server client, so the `slides`
//      storage RLS policy (is_full_access) double-enforces tier. No
//      service_role, no getPublicUrl; the bucket is never public.

const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Gate 1: tier. Redirects (throws) for anyone not Full.
  await requireFull();

  const { slug } = await params;

  // Whitelist — only the known lessons; no traversal / arbitrary objects.
  const lesson = lessonBySlug(slug);
  if (!lesson) {
    return new Response("Not found", { status: 404 });
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
