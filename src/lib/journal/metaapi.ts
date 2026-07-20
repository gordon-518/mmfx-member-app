import "server-only";

import type { MetaApiDeal } from "./types";

// Thin MetaApi REST wrapper — raw fetch, no SDK, matching the codebase
// convention (tv/, sendpulse). No retries here: the sync-job queue owns retry
// semantics. The investor password passes through to MetaApi over TLS and is
// never persisted or logged.
//
// Endpoints verified against https://metaapi.cloud/docs (2026-07-06):
// - Provisioning: mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai
// - Client API:   mt-client-api-v1.{region}.agiliumtrade.ai

const PROVISIONING_HOST =
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

const TIMEOUT_MS = 15_000;

export class MetaApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

function token(): string {
  const t = process.env.METAAPI_TOKEN;
  if (!t) throw new MetaApiError(0, "METAAPI_TOKEN is not configured");
  return t;
}

function region(): string {
  return process.env.METAAPI_REGION || "london";
}

function clientHost(): string {
  return `https://mt-client-api-v1.${region()}.agiliumtrade.ai`;
}

/** 32-char random transaction id required by the provisioning API. */
function transactionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function metaApiFetch(
  url: string,
  init: RequestInit & { headers?: Record<string, string> } = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "auth-token": token(),
      "content-type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    // MetaApi error bodies carry a useful `message`; never echo credentials.
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) detail = body.message;
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new MetaApiError(res.status, detail);
  }
  return res;
}

export interface MetaApiAccountState {
  id: string;
  /** CREATED | DEPLOYING | DEPLOYED | UNDEPLOYING | UNDEPLOYED | DELETING */
  state: string;
  /** e.g. CONNECTED | DISCONNECTED_FROM_BROKER | DISCONNECTED */
  connectionStatus?: string;
}

/**
 * Provision an MT5 account at MetaApi with the trader's investor password.
 * Returns the MetaApi account id. 201 = deployed, 202 = still provisioning —
 * both resolve; the worker polls state afterwards.
 */
export async function createMetaApiAccount(params: {
  login: string;
  password: string;
  server: string;
  name: string;
}): Promise<{ id: string; state: string }> {
  const res = await metaApiFetch(`${PROVISIONING_HOST}/users/current/accounts`, {
    method: "POST",
    headers: { "transaction-id": transactionId() },
    body: JSON.stringify({
      name: params.name,
      login: params.login,
      password: params.password,
      server: params.server,
      platform: "mt5",
      magic: 0,
      region: region(),
      // cloud-g1 + regular = the cheapest single-region tier. A read-only
      // journal that syncs a few times/day and retries on failure doesn't need
      // multi-region reliability meant for live trade execution.
      //
      // `type` MUST be cloud-g1: MetaApi does NOT offer `regular` reliability on
      // cloud-g2 (its default) — a g2 account silently comes back as `high`
      // regardless of the reliability we send. Only cloud-g1 honours `regular`.
      type: "cloud-g1",
      reliability: "regular",
    }),
  });
  return (await res.json()) as { id: string; state: string };
}

/** Read provisioning state (used to resolve `connecting` accounts). */
export async function getMetaApiAccount(
  accountId: string
): Promise<MetaApiAccountState> {
  const res = await metaApiFetch(
    `${PROVISIONING_HOST}/users/current/accounts/${accountId}`
  );
  return (await res.json()) as MetaApiAccountState;
}

/**
 * Remove the account from MetaApi. Called on disconnect — this is what stops
 * MetaApi billing for the account, so disconnect must always attempt it.
 */
export async function deleteMetaApiAccount(accountId: string): Promise<void> {
  await metaApiFetch(
    `${PROVISIONING_HOST}/users/current/accounts/${accountId}`,
    { method: "DELETE" }
  );
}

/**
 * Deploy the account (start its API server / connect to the broker). MetaApi
 * bills only while an account is deployed, so we deploy on demand right before
 * a sync and undeploy right after — keeping accounts UNDEPLOYED between syncs.
 * Idempotent: deploying an already-deployed account is a no-op.
 */
export async function deployMetaApiAccount(accountId: string): Promise<void> {
  await metaApiFetch(
    `${PROVISIONING_HOST}/users/current/accounts/${accountId}/deploy`,
    { method: "POST" }
  );
}

/** Undeploy the account (stop its API server) so it stops accruing charges. */
export async function undeployMetaApiAccount(accountId: string): Promise<void> {
  await metaApiFetch(
    `${PROVISIONING_HOST}/users/current/accounts/${accountId}/undeploy`,
    { method: "POST" }
  );
}

const DEALS_PAGE_LIMIT = 1000;

/**
 * Fetch all deals in [start, end), transparently paginating past the
 * 1000-deal page limit.
 */
export async function fetchDealsByTimeRange(
  accountId: string,
  start: Date,
  end: Date
): Promise<MetaApiDeal[]> {
  const all: MetaApiDeal[] = [];
  let offset = 0;
  for (;;) {
    const url =
      `${clientHost()}/users/current/accounts/${accountId}` +
      `/history-deals/time/${start.toISOString()}/${end.toISOString()}` +
      `?offset=${offset}&limit=${DEALS_PAGE_LIMIT}`;
    const res = await metaApiFetch(url);
    const page = (await res.json()) as MetaApiDeal[];
    all.push(...page);
    if (page.length < DEALS_PAGE_LIMIT) return all;
    offset += DEALS_PAGE_LIMIT;
  }
}

export interface MetaApiAccountInformation {
  balance?: number;
  equity?: number;
  currency?: string;
}

/** Balance/equity/currency snapshot for the account card. */
export async function fetchAccountInformation(
  accountId: string
): Promise<MetaApiAccountInformation> {
  const res = await metaApiFetch(
    `${clientHost()}/users/current/accounts/${accountId}/account-information`
  );
  return (await res.json()) as MetaApiAccountInformation;
}
