import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/journal/api";
import { deleteMetaApiAccount } from "@/lib/journal/metaapi";

// DELETE /api/journal/accounts/:id — disconnect an MT5 account.
//
// Removes the account at MetaApi (stops their per-account billing) and marks
// the row disconnected. Trade history is KEPT — the journal's value is the
// longitudinal record.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const supabase = await createClient();

  // RLS scopes this to the caller's own rows — no user_id filter needed,
  // but a miss must 404 rather than act on someone else's account.
  const { data: account } = await supabase
    .from("journal_accounts")
    .select("id, metaapi_account_id, state")
    .eq("id", id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Best-effort at MetaApi: if it fails we still disconnect locally; the
  // orphaned MetaApi account shows up in their dashboard for manual cleanup.
  let metaapiRemoved = true;
  if (account.metaapi_account_id) {
    try {
      await deleteMetaApiAccount(account.metaapi_account_id);
    } catch {
      metaapiRemoved = false;
    }
  }

  const { error } = await supabase
    .from("journal_accounts")
    .update({
      state: "disconnected",
      disconnected_at: new Date().toISOString(),
      state_detail: metaapiRemoved ? null : "MetaApi cleanup pending",
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, metaapiRemoved });
}
