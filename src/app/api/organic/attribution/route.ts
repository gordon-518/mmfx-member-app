// Signups per organic cid, for the marketing brain's measure.ts.
// Bearer CRON_SECRET — same posture as /api/cron/*. Service role, because
// profiles is RLS-gated to the owning user and this is an aggregate read.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ORGANIC_CRON_SECRET is a dedicated credential for the marketing brain, which only
  // needs these two organic routes. Reusing CRON_SECRET would hand the brain the key to
  // every cron route we own (journal, growth, channel, sendpulse) — far more blast radius
  // than the job requires. CRON_SECRET stays accepted as a fallback so nothing breaks
  // between this deploy and the new secret being set.
  const auth = req.headers.get("authorization");
  const expected = process.env.ORGANIC_CRON_SECRET || process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
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
