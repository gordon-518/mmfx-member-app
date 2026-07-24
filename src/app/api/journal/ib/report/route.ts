import { NextResponse } from "next/server";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";

// GET /api/journal/ib/report — CSV of currently-flagged accounts, enriched with
// member name/email + balance so an admin can check each against the broker CRM.

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;
  const svc = serviceClient();

  const { data: accounts } = await svc
    .from("journal_accounts")
    .select(
      "id, user_id, mt5_login, broker_id, broker_server, balance, equity, currency, last_synced_at, ib_review"
    )
    .eq("ib_review", "flagged");

  const rows = accounts ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const { data: profiles } = await svc
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds.length ? userIds : ["__none__"]);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const header = [
    "account_id",
    "mt5_login",
    "broker",
    "server",
    "member_name",
    "member_email",
    "balance",
    "equity",
    "currency",
    "last_synced_at",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const p = byId.get(r.user_id as string);
    lines.push(
      [
        r.id,
        r.mt5_login,
        r.broker_id,
        r.broker_server,
        p?.full_name ?? "",
        p?.email ?? "",
        r.balance,
        r.equity,
        r.currency,
        r.last_synced_at,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ib-flagged-accounts.csv"`,
    },
  });
}
