import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";
import { MetaApiError, createMetaApiAccount } from "@/lib/journal/metaapi";
import { loadBrokers, serverMatchesBroker } from "@/lib/journal/ibBrokers";

// POST /api/journal/accounts — connect an MT5 account.
//
// The journal tracks the member's one registered active account: the login is
// taken from profiles.trading_account_number (not the client). The investor
// password is validated, passed through to MetaApi over TLS, and NEVER stored.
// Broker is chosen from the registry; a mismatched server is rejected; an
// account previously removed as not-under-IB (ib_review = journal_blocked) can't
// reconnect.

interface ConnectBody {
  broker_id?: string;
  password?: string;
  server?: string;
  label?: string;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const { profile } = guard;

  // The journal tracks the member's one registered active account.
  const login = (profile.trading_account_number ?? "").trim();
  if (!/^\d{4,15}$/.test(login)) {
    return NextResponse.json(
      { error: "Add your trading account number to your profile first." },
      { status: 400 }
    );
  }

  let body: ConnectBody;
  try {
    body = (await req.json()) as ConnectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brokerId = (body.broker_id ?? "").trim();
  const password = body.password ?? "";
  const server = (body.server ?? "").trim();
  const label = (body.label ?? "").trim() || null;

  const svc = serviceClient();
  const brokers = await loadBrokers(svc);
  const broker = brokers.find((b) => b.id === brokerId);
  if (!broker) {
    return NextResponse.json({ error: "Choose your broker" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Investor password is required" },
      { status: 400 }
    );
  }
  if (server.length < 3) {
    return NextResponse.json(
      { error: "Broker server is required (from your MT5 login screen)" },
      { status: 400 }
    );
  }
  if (!serverMatchesBroker(server, brokerId)) {
    return NextResponse.json(
      { error: `That server doesn't look like a ${broker.display_name} server.` },
      { status: 400 }
    );
  }

  // Block reconnect of an account previously removed as not-under-IB.
  const { data: prior } = await svc
    .from("journal_accounts")
    .select("id, ib_review")
    .eq("mt5_login", login)
    .eq("broker_id", brokerId)
    .maybeSingle();
  if (prior?.ib_review === "journal_blocked") {
    return NextResponse.json(
      { error: "This account can't be connected. Please contact support." },
      { status: 403 }
    );
  }

  const supabase = await createClient();

  // Reject double-connect of a live account; allow retry of failed ones.
  const { data: existing } = await supabase
    .from("journal_accounts")
    .select("id, state")
    .eq("mt5_login", login)
    .eq("broker_id", brokerId)
    .maybeSingle();
  if (existing && ["connecting", "deployed"].includes(existing.state)) {
    return NextResponse.json(
      { error: "This account is already connected" },
      { status: 409 }
    );
  }

  // Provision at MetaApi. On failure we still save the row (state=failed) so the
  // UI can show what happened and offer retry.
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
        broker_id: brokerId,
        ib_review: "ok",
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
