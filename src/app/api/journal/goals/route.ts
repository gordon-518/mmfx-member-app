import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMemberApi } from "@/lib/journal/api";

// GET/PUT /api/journal/goals — the trader's benchmark (structured + free-text).
// One row per user; RLS scopes everything to the caller.

const STYLES = new Set(["scalper", "day", "swing", "position"]);

interface GoalsBody {
  style?: string | null;
  account_size?: number | null;
  monthly_target_pct?: number | null;
  max_drawdown_pct?: number | null;
  risk_per_trade_pct?: number | null;
  instruments?: string[] | null;
  focus_text?: string | null;
}

/** Numeric field: null passes through, otherwise must be a finite number ≥ 0. */
function num(v: unknown): number | null | "invalid" {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return "invalid";
  return v;
}

export async function GET() {
  const guard = await requireMemberApi();
  if ("response" in guard) return guard.response;

  const supabase = await createClient();
  const { data: goals } = await supabase
    .from("journal_goals")
    .select()
    .maybeSingle();

  return NextResponse.json({ goals: goals ?? null });
}

export async function PUT(req: NextRequest) {
  const guard = await requireMemberApi();
  if ("response" in guard) return guard.response;
  const { profile } = guard;

  let body: GoalsBody;
  try {
    body = (await req.json()) as GoalsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const style = body.style ?? null;
  if (style !== null && !STYLES.has(style)) {
    return NextResponse.json({ error: "Unknown style" }, { status: 400 });
  }

  const numeric = {
    account_size: num(body.account_size),
    monthly_target_pct: num(body.monthly_target_pct),
    max_drawdown_pct: num(body.max_drawdown_pct),
    risk_per_trade_pct: num(body.risk_per_trade_pct),
  };
  for (const [field, value] of Object.entries(numeric)) {
    if (value === "invalid") {
      return NextResponse.json(
        { error: `${field} must be a non-negative number` },
        { status: 400 }
      );
    }
  }

  const instruments = Array.isArray(body.instruments)
    ? body.instruments
        .filter((i): i is string => typeof i === "string")
        .map((i) => i.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 30)
    : null;

  const focusText =
    typeof body.focus_text === "string"
      ? body.focus_text.trim().slice(0, 2000) || null
      : null;

  const supabase = await createClient();
  const { data: goals, error } = await supabase
    .from("journal_goals")
    .upsert({
      user_id: profile.id,
      style,
      account_size: numeric.account_size,
      monthly_target_pct: numeric.monthly_target_pct,
      max_drawdown_pct: numeric.max_drawdown_pct,
      risk_per_trade_pct: numeric.risk_per_trade_pct,
      instruments,
      focus_text: focusText,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goals });
}
