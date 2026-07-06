import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MetaApiError,
  fetchAccountInformation,
  fetchDealsByTimeRange,
  getMetaApiAccount,
} from "./metaapi";
import { reconstructTrades } from "./reconstruct";
import type { JournalAccountRow, MetaApiDeal } from "./types";

// Per-account sync orchestration, called by the worker route with a
// service-role client. One invocation = one incremental sync:
//
//   resolve `connecting` state → fetch deals since cursor → upsert raw deals
//   → rebuild trades for TOUCHED positions from the FULL deal history we hold
//   → upsert trades + cash flows → refresh balance/equity → advance cursor.
//
// The cursor only advances after a successful upsert batch, so a failure at
// any step is safely retried by the queue with no data loss.

/** Accounts with no cursor backfill from here — far enough for any history. */
const DEFAULT_START = "2000-01-01T00:00:00.000Z";

/** Re-fetch this much behind the cursor so boundary-time deals never slip. */
const OVERLAP_MS = 60_000;

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

/**
 * Resolve a `connecting` account against MetaApi's provisioning state.
 * Returns true when the account is deployed and syncable.
 */
async function resolveConnecting(
  db: SupabaseClient,
  account: JournalAccountRow
): Promise<boolean> {
  const remote = await getMetaApiAccount(account.metaapi_account_id!);
  if (remote.state === "DEPLOYED") {
    await db
      .from("journal_accounts")
      .update({ state: "deployed", state_detail: remote.connectionStatus ?? null })
      .eq("id", account.id);
    return true;
  }
  if (remote.state === "DEPLOYING" || remote.state === "CREATED") {
    // Still provisioning — leave `connecting`, try again next tick.
    await db
      .from("journal_accounts")
      .update({ state_detail: remote.state })
      .eq("id", account.id);
    return false;
  }
  // UNDEPLOYED / anything else: surface as failed so the user can retry.
  await db
    .from("journal_accounts")
    .update({ state: "failed", state_detail: `MetaApi state: ${remote.state}` })
    .eq("id", account.id);
  return false;
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

/**
 * One incremental sync for one account. Throws nothing — returns an outcome
 * the worker maps onto job status (retry vs fail).
 */
export async function syncAccount(
  db: SupabaseClient,
  account: JournalAccountRow
): Promise<SyncOutcome> {
  try {
    if (!account.metaapi_account_id) {
      return { ok: false, error: "Account has no MetaApi id", permanent: true };
    }

    if (account.state === "connecting") {
      const deployed = await resolveConnecting(db, account);
      if (!deployed) {
        return { ok: true, dealsFetched: 0, tradesUpserted: 0 };
      }
    }

    const start = syncWindowStart(account.sync_cursor);
    const now = new Date();
    const deals = await fetchDealsByTimeRange(
      account.metaapi_account_id,
      start,
      now
    );

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
        const { data: rows, error: readErr } = await db
          .from("journal_deals")
          .select(DEAL_COLUMNS)
          .eq("account_id", account.id)
          .in("position_id", touched);
        if (readErr) {
          return { ok: false, error: readErr.message, permanent: false };
        }
        const balanceDeals = deals.filter((d) => d.type === "DEAL_TYPE_BALANCE");
        allDeals = [...(rows ?? []).map(rowToDeal), ...balanceDeals];
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
      snapshot = await fetchAccountInformation(account.metaapi_account_id);
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
  }
}
