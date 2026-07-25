import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/journal/api";
import type { JournalRulesConfig } from "@/lib/journal/types";

// GET/PUT /api/journal/rules — the trader's discipline rules (Survival Engine
// Layer 2). One jsonb config row per user; RLS scopes everything to the caller.

const SESSIONS = new Set(["London", "New York", "Asian"]);

/** A numeric rule: keeps enabled + a finite value ≥ 0 (+ is_pct flag). */
function cleanNumRule(v: unknown): { enabled: boolean; value?: number; is_pct?: boolean } {
  if (v == null || typeof v !== "object") return { enabled: false };
  const o = v as Record<string, unknown>;
  const value =
    typeof o.value === "number" && Number.isFinite(o.value) && o.value >= 0 ? o.value : undefined;
  return { enabled: !!o.enabled, value, is_pct: !!o.is_pct };
}

export async function GET() {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;

  const supabase = await createClient();
  const { data } = await supabase.from("journal_rules").select().maybeSingle();
  return NextResponse.json({ rules: (data?.config ?? {}) as JournalRulesConfig });
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const { profile } = guard;

  let body: JournalRulesConfig;
  try {
    body = (await req.json()) as JournalRulesConfig;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessions = Array.isArray(body.allowed_sessions?.value)
    ? body.allowed_sessions!.value.filter((s) => typeof s === "string" && SESSIONS.has(s))
    : [];

  const config: JournalRulesConfig = {
    max_daily_loss: cleanNumRule(body.max_daily_loss),
    max_trades_per_day: cleanNumRule(body.max_trades_per_day),
    max_consec_losses: cleanNumRule(body.max_consec_losses),
    max_lots: cleanNumRule(body.max_lots),
    instruments_only: { enabled: !!body.instruments_only?.enabled },
    allowed_sessions: { enabled: !!body.allowed_sessions?.enabled, value: sessions },
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_rules")
    .upsert({ user_id: profile.id, config, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rules: config });
}
