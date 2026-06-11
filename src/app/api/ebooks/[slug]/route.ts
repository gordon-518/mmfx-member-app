import { type NextRequest } from "next/server";
import { requireFull } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { EBOOKS_BUCKET, ebookBySlug } from "@/app/library/ebooks";

// Gated ebook delivery. Two independent gates:
//   1. requireFull() — Limited users redirect to /upgrade before any storage
//      call (signed-out -> /login).
//   2. The download uses the USER's authenticated server client, so the
//      `ebooks` storage RLS policy (is_full_access) double-enforces tier at
//      the storage layer. No service_role; the bucket is never public.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Gate 1: tier. Redirects (throws) for anyone not Full.
  await requireFull();

  const { slug } = await params;

  // Whitelist — only the 4 known ebooks; no traversal / arbitrary objects.
  const book = ebookBySlug(slug);
  if (!book) {
    return new Response("Not found", { status: 404 });
  }

  // Gate 2: authenticated user client -> storage RLS applies.
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(EBOOKS_BUCKET)
    .download(book.file);

  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // RFC 5987 encoding — injection-proof regardless of slug content.
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
        `${slug}.pdf`
      )}`,
      "X-Content-Type-Options": "nosniff",
      // Private, per-user content — never cache in shared/CDN layers.
      "Cache-Control": "private, no-store",
    },
  });
}
