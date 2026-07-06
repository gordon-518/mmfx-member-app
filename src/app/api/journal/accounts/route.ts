import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFullApi, serviceClient } from "@/lib/journal/api";
import { MetaApiError, createMetaApiAccount } from "@/lib/journal/metaapi";

// POST /api/journal/accounts — connect an MT5 account.
//
// The investor password is validated, passed through to MetaApi provisioning
// over TLS, and NEVER stored or logged. We keep only the MetaApi account id.
// Retrying a failed/disconnected connect upserts the same row (unique on
// user_id + mt5_login + broker_server).

interface ConnectBody {
  login?: string;
  password?: string;
  server?: string;
  label?: string;
}

export async function POST(req: NextRequest) {
  const guard = await requireFullApi();
  if ("response" in guard) return guard.response;
  const { profile } = guard;

  let body: ConnectBody;
  try {
    body = (await req.json()) as ConnectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const login = (body.login ?? "").trim();
  const password = body.password ?? "";
  const server = (body.server ?? "").trim();
  const label = (body.label ?? "").trim() || null;

  if (!/^\d{3,20}$/.test(login)) {
    return NextResponse.json(
      { error: "Account number must be digits only" },
      { status: 400 }
    );
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Investor password is required" },
      { status: 400 }
    );
  }
  if (server.length < 3) {
    return NextResponse.json(
      { error: "Broker server is required (e.g. Broker-MT5-Live)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Reject double-connect of a live account; allow retry of failed ones.
  const { data: existing } = await supabase
    .from("journal_accounts")
    .select("id, state")
    .eq("mt5_login", login)
    .eq("broker_server", server)
    .maybeSingle();
  if (existing && ["connecting", "deployed"].includes(existing.state)) {
    return NextResponse.json(
      { error: "This account is already connected" },
      { status: 409 }
    );
  }

  // Provision at MetaApi. On failure we still save the row (state=failed,
  // human-readable detail) so the UI can show what happened and offer retry.
  let metaapiAccountId: string | null = null;
  let state = "connecting";
  let stateDetail: string | null = null;
  try {
    const created = await createMetaApiAccount({
      login,
      password,
      server,
      name: `mmfx-${profile.id.slice(0, 8)}-${login}`,
    });
    metaapiAccountId = created.id;
  } catch (e) {
    state = "failed";
    stateDetail =
      e instanceof MetaApiError
        ? `MetaApi: ${e.message}`
        : "Could not reach MetaApi — please try again";
  }

  const { data: account, error } = await supabase
    .from("journal_accounts")
    .upsert(
      {
        user_id: profile.id,
        label,
        mt5_login: login,
        broker_server: server,
        metaapi_account_id: metaapiAccountId,
        state,
        state_detail: stateDetail,
        sync_error: null,
        disconnected_at: null,
      },
      { onConflict: "user_id,mt5_login,broker_server" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Queue the initial sync (jobs table is service-role only).
  if (state === "connecting") {
    await serviceClient()
      .from("journal_sync_jobs")
      .insert({ account_id: account.id });
  }

  return NextResponse.json({ account }, { status: state === "failed" ? 502 : 201 });
}
