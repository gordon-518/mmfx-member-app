import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFullApi } from "@/lib/journal/api";
import { JOURNAL_EMOTIONS } from "@/lib/journal/types";

// PATCH /api/journal/trades/:id — save the trader's journaling on a trade.
//
// Only note / tags / emotion are editable — the RLS column grant on
// journal_trades restricts writes to exactly these three, so sync-owned fields
// (P&L, prices, times) can never be tampered with from the client.

interface Body {
  note?: string | null;
  tags?: string[] | null;
  emotion?: string | null;
}

const EMOTIONS = new Set<string>(JOURNAL_EMOTIONS);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFullApi();
  if ("response" in guard) return guard.response;

  const { id } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 2000) || null : null;

  const emotion = body.emotion ?? null;
  if (emotion !== null && !EMOTIONS.has(emotion)) {
    return NextResponse.json({ error: "Unknown emotion" }, { status: 400 });
  }

  const tags = Array.isArray(body.tags)
    ? [
        ...new Set(
          body.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        ),
      ].slice(0, 12)
    : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_trades")
    .update({ note, tags, emotion })
    .eq("id", id)
    .select("id, note, tags, emotion")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  return NextResponse.json({ trade: data });
}
