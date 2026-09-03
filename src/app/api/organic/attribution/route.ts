// Signups per organic cid, for the marketing brain's measure.ts.
// Bearer CRON_SECRET — same posture as /api/cron/*. Service role, because
// profiles is RLS-gated to the owning user and this is an aggregate read.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const since = req.nextUrl.searchParams.get("since");
  const sinceIso = since ?? new Date(Date.now() - 30 * 864e5).toISOString();
  if (Number.isNaN(Date.parse(sinceIso))) {
    return NextResponse.json({ error: "bad since" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase.rpc("organic_signups_by_cid", { since: sinceIso });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ since: sinceIso, rows: data ?? [] });
}
