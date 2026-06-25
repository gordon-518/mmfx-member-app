import { NextRequest, NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health";
import { createClient } from "@/lib/supabase/server";

// On-demand health check for the critical external dependencies (SMTP +
// TradingView). The scheduled run is folded into the daily sendpulse-sync cron
// (to respect the 2-cron plan limit); this route is here so an admin can run
// it from the browser any time. Auth: cron Bearer secret OR a signed-in admin.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const isCron = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!user || isAdmin !== true) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const health = await runHealthChecks();
  return NextResponse.json(health);
}
