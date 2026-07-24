import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Member Audit: check every member's registered trading_account_number against
// the IB allowlist (both brokers) + the Dupoin balance, independent of whether
// they've connected the journal.

/** Members whose Dupoin balance is under this are top-up candidates. */
export const LOW_BALANCE_THRESHOLD = 50;

export type MemberFlag = "ok" | "not_under_ib" | "low_balance";

/** Pure classifier — see ibMemberAudit.test.ts. */
export function classifyMember(
  m: { underIb: boolean; dupoinBalance: number | null },
  threshold: number = LOW_BALANCE_THRESHOLD
): MemberFlag {
  if (!m.underIb) return "not_under_ib";
  if (m.dupoinBalance !== null && m.dupoinBalance < threshold) return "low_balance";
  return "ok";
}

export interface MemberAuditRow {
  acct: string;
  full_name: string | null;
  email: string | null;
  account_status: string;
  dupoinBalance: number | null;
}

/** member_active first, then a stable secondary sort. */
function byPriority(a: MemberAuditRow, b: MemberAuditRow): number {
  const rank = (r: MemberAuditRow) => (r.account_status === "member_active" ? 0 : 1);
  return rank(a) - rank(b);
}

/**
 * Audit all members with a registered account against the loaded IB book.
 * Returns the two flag lists (not under IB, low Dupoin balance).
 */
export async function loadMemberAudit(
  db: SupabaseClient,
  threshold: number = LOW_BALANCE_THRESHOLD
): Promise<{ notUnderIb: MemberAuditRow[]; lowBalance: MemberAuditRow[] }> {
  const { data: members } = await db
    .from("profiles")
    .select("trading_account_number, full_name, email, account_status")
    .not("trading_account_number", "is", null)
    .neq("trading_account_number", "");

  // Union of both brokers' logins — paginate past PostgREST's 1000-row cap.
  const allow = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("ib_accounts")
      .select("mt5_login")
      .range(from, from + 999);
    const batch = data ?? [];
    for (const r of batch) allow.add(r.mt5_login as string);
    if (batch.length < 1000) break;
  }

  // Dupoin balances (login → balance).
  const bal = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("ib_accounts")
      .select("mt5_login, balance")
      .eq("broker_id", "dupoin")
      .range(from, from + 999);
    const batch = data ?? [];
    for (const r of batch) {
      if (r.balance !== null) bal.set(r.mt5_login as string, Number(r.balance));
    }
    if (batch.length < 1000) break;
  }

  const notUnderIb: MemberAuditRow[] = [];
  const lowBalance: MemberAuditRow[] = [];
  for (const m of members ?? []) {
    const acct = String(m.trading_account_number);
    const dupoinBalance = bal.has(acct) ? (bal.get(acct) as number) : null;
    const flag = classifyMember({ underIb: allow.has(acct), dupoinBalance }, threshold);
    const row: MemberAuditRow = {
      acct,
      full_name: m.full_name as string | null,
      email: m.email as string | null,
      account_status: m.account_status as string,
      dupoinBalance,
    };
    if (flag === "not_under_ib") notUnderIb.push(row);
    else if (flag === "low_balance") lowBalance.push(row);
  }

  notUnderIb.sort((a, b) => byPriority(a, b) || a.acct.localeCompare(b.acct));
  lowBalance.sort(
    (a, b) => byPriority(a, b) || (a.dupoinBalance ?? 0) - (b.dupoinBalance ?? 0)
  );
  return { notUnderIb, lowBalance };
}
