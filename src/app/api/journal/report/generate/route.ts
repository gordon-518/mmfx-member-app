import { NextResponse } from "next/server";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";
import { runReportForUser } from "@/lib/journal/coach";

// POST /api/journal/report/generate — generate (or regenerate) today's AI
// coaching report for the caller, on demand. Admin-gated during staged rollout;
// writes with the service role. maxDuration covers the model call.

export const maxDuration = 60;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST() {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const { profile } = guard;

  const db = serviceClient();
  const report = await runReportForUser(db, profile.id, today());

  if (!report) {
    return NextResponse.json(
      {
        error:
          "Could not generate a report — you need some closed trades, and the AI service must be reachable.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ report });
}
