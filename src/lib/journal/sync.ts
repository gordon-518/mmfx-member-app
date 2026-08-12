import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MetaApiError,
  deployMetaApiAccount,
  fetchAccountInformation,
  fetchDealsByTimeRange,
  getMetaApiAccount,
  undeployMetaApiAccount,
} from "./metaapi";
import { reconstructTrades } from "./reconstruct";
import type { JournalAccountRow, MetaApiDeal } from "./types";

// Per-account sync orchestration, called by the worker route with a
// service-role client. One invocation = one incremental sync:
//
//   DEPLOY the account → wait for the broker connection → fetch deals since the
//   cursor → upsert raw deals → rebuild trades for TOUCHED positions → upsert
//   trades + cash flows → refresh balance/equity → advance cursor → UNDEPLOY.
//
// COST: MetaApi bills only while an account is deployed (6-hour minimum block
// per deploy). Accounts therefore sit UNDEPLOYED between syncs and are deployed
// only for the moment they're being read. With a ~once-daily cadence (see the
// worker's STALE_SYNC) that's ~one 6h block/day (~180 deployed-hours/month)
// instead of ~720 for an always-on account — roughly a 75% cost cut.
//
// The cursor only advances after a successful upsert batch, so a failure at any
// step is safely retried by the queue with no data loss. Undeploy runs in a
// finally so we never leave an account deployed (which would defeat the saving).

/**
 * First-sync backfill window start. Bounded (not epoch) so a very active
 * account's initial sync can't pull a decade of history in one shot and blow
 * past the worker's maxDuration — which would leave the account deployed and
 * billing. A few years is ample for a trading journal; older history is out of
 * scope. Combined with the reaper's attempts-bump + undeploy, a genuinely huge
 * account fails safely rather than looping.
 */
const DEFAULT_START = "2024-01-01T00:00:00.000Z";

/** Re-fetch this much behind the cursor so boundary-time deals never slip. */
const OVERLAP_MS = 60_000;

/** How long to wait for a freshly-deployed account to connect to the broker. */
const CONNECT_TIMEOUT_MS = 120_000;
const CONNECT_POLL_MS = 3_000;

/** Window start for an incremental sync. Pure — see sync.test.ts. */
export function syncWindowStart(cursor: string | null): Date {
  if (!cursor) return new Date(DEFAULT_START);
  return new Date(new Date(cursor).getTime() - OVERLAP_MS);
}

/** Max deal time, never behind the previous cursor. Pure — see sync.test.ts. */
export function nextCursor(
  deals: MetaApiDeal[],
  prev: string | null
): string | null {
  let max = prev ? new Date(prev).getTime() : null;
  for (const d of deals) {
    const t = new Date(d.time).getTime();
    if (!Number.isNaN(t) && (max === null || t > max)) max = t;
  }
  return max === null ? null : new Date(max).toISOString();
}

export type SyncOutcome =
  | { ok: true; dealsFetched: number; tradesUpserted: number }
  | { ok: false; error: string; permanent: boolean };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface ConnectResult {
  connected: boolean;
  state?: string;
  connectionStatus?: string;
}

/** Poll the account until it's DEPLOYED + CONNECTED, or the timeout elapses. */
async function waitForConnected(accountId: string): Promise<ConnectResult> {
  const deadline = Date.now() + CONNECT_TIMEOUT_MS;
  let state: string | undefined;
  let connectionStatus: string | undefined;
  while (Date.now() < deadline) {
    const remote = await getMetaApiAccount(accountId);
    state = remote.state;
    connectionStatus = remote.connectionStatus;
    if (state === "DEPLOYED" && connectionStatus === "CONNECTED") {
      return { connected: true, state, connectionStatus };
    }
    await sleep(CONNECT_POLL_MS);
  }
  return { connected: false, state, connectionStatus };
}

/** Map a MetaApi deal to a journal_deals row. */
function dealRow(accountId: string, d: MetaApiDeal) {
  return {
    account_id: accountId,
    deal_id: d.id,
    position_id: d.positionId ?? null,
    order_id: d.orderId ?? null,
    symbol: d.symbol ?? null,
    type: d.type,
    entry_type: d.entryType ?? null,
    volume: d.volume ?? null,
    price: d.price ?? null,
    profit: d.profit ?? 0,
    commission: d.commission ?? 0,
    swap: d.swap ?? 0,
    time: d.time,
    broker_time: d.brokerTime ?? null,
    magic: d.magic ?? null,
    comment: d.comment ?? null,
  };
}

/** Map a stored journal_deals row back to the MetaApiDeal shape. */
function rowToDeal(r: Record<string, unknown>): MetaApiDeal {
  return {
    id: r.deal_id as string,
    positionId: (r.position_id as string) ?? undefined,
    orderId: (r.order_id as string) ?? undefined,
    symbol: (r.symbol as string) ?? undefined,
    type: r.type as string,
    entryType: (r.entry_type as string) ?? undefined,
    volume: r.volume == null ? undefined : Number(r.volume),
    price: r.price == null ? undefined : Number(r.price),
    profit: r.profit == null ? 0 : Number(r.profit),
    commission: r.commission == null ? 0 : Number(r.commission),
    swap: r.swap == null ? 0 : Number(r.swap),
    time: new Date(r.time as string).toISOString(),
    comment: (r.comment as string) ?? undefined,
  };
}

const DEAL_COLUMNS =
  "deal_id, position_id, order_id, symbol, type, entry_type, volume, price, profit, commission, swap, time, comment";

/** PostgREST caps a single response at 1000 rows — page past it. */
const DEAL_PAGE = 1000;
/** Keep the `position_id IN (...)` list short enough to not blow the URL. */
const POSITION_ID_CHUNK = 150;

/**
 * Every stored deal for the given positions, as MetaApiDeal[]. Pages past
 * PostgREST's 1000-row cap and chunks the id list so neither a busy account
 * (>1000 deals) nor a long touched-position list silently truncates history.
 * Truncation here would drop exit legs and leave trades un-reconstructed —
 * see reconstruct's need for the FULL history of any touched position.
 */
export async function fetchStoredDealsForPositions(
  db: SupabaseClient,
  accountId: string,
  positionIds: string[]
): Promise<MetaApiDeal[]> {
  const out: MetaApiDeal[] = [];
  for (let i = 0; i < positionIds.length; i += POSITION_ID_CHUNK) {
    const idChunk = positionIds.slice(i, i + POSITION_ID_CHUNK);
    for (let from = 0; ; from += DEAL_PAGE) {
      const { data, error } = await db
        .from("journal_deals")
        .select(DEAL_COLUMNS)
        .eq("account_id", accountId)
        .in("position_id", idChunk)
        .range(from, from + DEAL_PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Record<string, unknown>[];
      out.push(...rows.map(rowToDeal));
      if (rows.length < DEAL_PAGE) break;
    }
  }
  return out;
}

/**
 * One incremental sync for one account. Throws nothing — returns an outcome the
 * worker maps onto job status (retry vs fail). Deploys for the read and always
 * undeploys afterwards.
 */
export async function syncAccount(
  db: SupabaseClient,
  account: JournalAccountRow
): Promise<SyncOutcome> {
  if (!account.metaapi_account_id) {
    return { ok: false, error: "Account has no MetaApi id", permanent: true };
  }
  const accountId = account.metaapi_account_id;
  let deployed = false;

  try {
    // Deploy on demand (no-op if already deployed) and wait for the broker link.
    await deployMetaApiAccount(accountId);
    deployed = true;

    const conn = await waitForConnected(accountId);
    if (!conn.connected) {
      // Deployed but the broker connection didn't establish in time. Usually a
      // transient broker-side delay; a persistently wrong investor
      // password/server fails repeatedly and the queue surfaces it after its
      // retry budget. UNDEPLOYED here means MetaApi rejected the deploy outright.
      return {
        ok: false,
        error: `Account did not connect (state ${conn.state ?? "?"}${
          conn.connectionStatus ? `, ${conn.connectionStatus}` : ""
        })`,
        permanent: conn.state === "UNDEPLOYED",
      };
    }

    // First successful connect promotes a still-connecting account to active.
    if (account.state === "connecting") {
      await db
        .from("journal_accounts")
        .update({ state: "deployed", state_detail: "CONNECTED" })
        .eq("id", account.id);
    }

    const start = syncWindowStart(account.sync_cursor);
    const now = new Date();
    const deals = await fetchDealsByTimeRange(accountId, start, now);

    let tradesUpserted = 0;

    if (deals.length > 0) {
      const { error: dealsErr } = await db
        .from("journal_deals")
        .upsert(
          deals.map((d) => dealRow(account.id, d)),
          { onConflict: "account_id,deal_id" }
        );
      if (dealsErr) {
        return { ok: false, error: dealsErr.message, permanent: false };
      }

      // Rebuild every touched position from the FULL history we hold, so a
      // partial fetch (e.g. the exit leg of an old trade) merges correctly.
      const touched = [
        ...new Set(
          deals.map((d) => d.positionId).filter((p): p is string => !!p)
        ),
      ];

      let allDeals: MetaApiDeal[] = deals;
      if (touched.length > 0) {
        const stored = await fetchStoredDealsForPositions(
          db,
          account.id,
          touched
        );
        const balanceDeals = deals.filter((d) => d.type === "DEAL_TYPE_BALANCE");
        allDeals = [...stored, ...balanceDeals];
      }

      const { trades, cashFlows } = reconstructTrades(allDeals);

      if (trades.length > 0) {
        const { error: tradesErr } = await db.from("journal_trades").upsert(
          trades.map((t) => ({
            account_id: account.id,
            user_id: account.user_id,
            position_id: t.positionId,
            symbol: t.symbol,
            direction: t.direction,
            status: t.status,
            volume: t.volume,
            open_price: t.openPrice,
            close_price: t.closePrice,
            open_time: t.openTime,
            close_time: t.closeTime,
            profit: t.profit,
            commission: t.commission,
            swap: t.swap,
            net_profit: t.netProfit,
            duration_sec: t.durationSec,
            // note/tags/emotion intentionally omitted — user edits survive.
          })),
          { onConflict: "account_id,position_id" }
        );
        if (tradesErr) {
          return { ok: false, error: tradesErr.message, permanent: false };
        }
        tradesUpserted = trades.length;
      }

      if (cashFlows.length > 0) {
        const { error: cfErr } = await db.from("journal_cash_flows").upsert(
          cashFlows.map((c) => ({
            account_id: account.id,
            deal_id: c.dealId,
            amount: c.amount,
            time: c.time,
            comment: c.comment,
          })),
          { onConflict: "account_id,deal_id" }
        );
        if (cfErr) {
          return { ok: false, error: cfErr.message, permanent: false };
        }
      }
    }

    // Balance/equity snapshot — best-effort, never fails the sync.
    let snapshot: { balance?: number; equity?: number; currency?: string } = {};
    try {
      snapshot = await fetchAccountInformation(accountId);
    } catch {
      // account may be transiently disconnected from broker — fine.
    }

    await db
      .from("journal_accounts")
      .update({
        sync_cursor: nextCursor(deals, account.sync_cursor),
        last_synced_at: now.toISOString(),
        sync_error: null,
        ...(snapshot.balance != null ? { balance: snapshot.balance } : {}),
        ...(snapshot.equity != null ? { equity: snapshot.equity } : {}),
        ...(snapshot.currency ? { currency: snapshot.currency } : {}),
      })
      .eq("id", account.id);

    return { ok: true, dealsFetched: deals.length, tradesUpserted };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    // 4xx from MetaApi (bad account / auth) won't heal by retrying.
    const permanent =
      e instanceof MetaApiError && e.status >= 400 && e.status < 500;
    return { ok: false, error: err, permanent };
  } finally {
    // Always undeploy so the account stops billing — even on error. Best-effort:
    // if this fails, the next sync's finally undeploys it.
    if (deployed) {
      try {
        await undeployMetaApiAccount(accountId);
      } catch {
        // leave for the next sync to clean up
      }
    }
  }
}
