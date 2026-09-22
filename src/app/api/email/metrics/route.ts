import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/journal/api";
import { FLOWS } from "@/lib/email/lifecycle";
import { defaultCopyFor } from "@/lib/email/lifecycle/defaults";
import type { LifecycleCopy } from "@/lib/email/lifecycle/types";

// What the weekly Opus 5 loop reads (design doc §4, §5.1).
//
// Two things in one response, because the brain needs both to say anything
// useful: the NUMBERS (fn_email_kpis, one row per flow/step/variant) and the
// WORDS those numbers came from (each step's current copy, control and any
// live challenger). A proposal written against copy we no longer send is
// worse than no proposal.
//
// Bearer CRON_SECRET — the same machine-to-machine secret the cron job and
// the spotlight route already use, so the brain needs no new credential.

export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 28;

function authorized(req: NextRequest): boolean {
  // The brain calls this with its dedicated ORGANIC_CRON_SECRET when one is
  // set (same rule as /api/organic/*); CRON_SECRET remains the fallback.
  const secret = process.env.ORGANIC_CRON_SECRET || process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

/** An ISO instant from the query string, or null for anything unparseable. */
function instant(raw: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

interface VariantRow {
  flow: string;
  step: string;
  variant_key: string;
  copy: LifecycleCopy;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const until = instant(params.get("until")) ?? new Date().toISOString();
  const since =
    instant(params.get("since")) ??
    new Date(Date.parse(until) - DEFAULT_WINDOW_DAYS * 86_400_000).toISOString();

  const db = serviceClient();
  const { data, error } = await db.rpc("fn_email_kpis", { p_since: since, p_until: until });
  if (error) {
    console.error("[api/email/metrics] fn_email_kpis failed:", error.message);
    return NextResponse.json({ error: "kpis failed" }, { status: 500 });
  }

  // Every step the rail can send gets an entry, even one with no sends yet:
  // a step missing from this map would read to the brain as a step that does
  // not exist, and it would never be chosen for a challenger.
  const copy: Record<string, Record<string, LifecycleCopy | null>> = {};
  for (const [flow, steps] of Object.entries(FLOWS)) {
    for (const step of Object.keys(steps)) {
      copy[`${flow}/${step}`] = { A: defaultCopyFor(flow, step) };
    }
  }

  const { data: variants } = await db
    .from("email_variants")
    .select("flow, step, variant_key, copy")
    .eq("active", true);
  for (const v of (variants ?? []) as VariantRow[]) {
    const entry = copy[`${v.flow}/${v.step}`];
    // A variant for a step the registry has dropped is stale, not a new step.
    if (entry) entry[v.variant_key] = v.copy;
  }

  return NextResponse.json({ since, until, rows: data ?? [], copy });
}
