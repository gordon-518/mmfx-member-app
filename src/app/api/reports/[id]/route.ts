import { type NextRequest } from "next/server";
import { requireFull } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

// Gated daily-analysis PDF report. Same pattern as the ebook/slide routes:
//   1. requireFull() — Limited users redirect to /upgrade before any storage.
//   2. Resolve the report_path from the row (RLS lets Full users read it),
//      then download from the PRIVATE analysis-reports bucket via the user's
//      authenticated client — storage RLS double-enforces tier.
// No service_role, no getPublicUrl; the bucket is never public.

const BUCKET = "analysis-reports";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireFull();

  const { id } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const supabase = await createClient();

  // Look up the object path for this entry (RLS gates the read).
  const { data: row } = await supabase
    .from("daily_analysis")
    .select("report_path, published_on")
    .eq("id", id)
    .eq("is_published", true) // don't serve reports for unpublished drafts
    .maybeSingle();

  if (!row?.report_path) {
    return new Response("Not found", { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(row.report_path);

  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  const filename = `MMFX_Analysis_${row.published_on ?? id}.pdf`;
  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
