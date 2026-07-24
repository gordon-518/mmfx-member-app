import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";
import { deleteMetaApiAccount } from "@/lib/journal/metaapi";

// POST /api/journal/accounts/:id/ib-action — manual removal of a flagged account.
//   block_journal (Type A): remove MetaApi + block journal, keep the app account.
//   full_removal  (Type B): same journal-side removal; app-level removal is handed
//                           off to the existing admin user-management (/admin).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  let body: { action?: "block_journal" | "full_removal" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "block_journal" && action !== "full_removal") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: account } = await svc
    .from("journal_accounts")
    .select("id, user_id, metaapi_account_id")
    .eq("id", id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Stop MetaApi cost (deletion is what stops billing). Best-effort.
  if (account.metaapi_account_id) {
    try {
      await deleteMetaApiAccount(account.metaapi_account_id);
    } catch {
      // leave for retry; still mark journal-blocked below
    }
  }

  await svc
    .from("journal_accounts")
    .update({
      ib_review: "journal_blocked",
      state: "disconnected",
      disconnected_at: new Date().toISOString(),
      metaapi_account_id: null,
    })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    action,
    userId: account.user_id,
    // For full_removal the admin UI links to the existing user-management page to
    // remove app access — the journal never touches account_status itself.
    handoff: action === "full_removal" ? "/admin" : null,
  });
}
