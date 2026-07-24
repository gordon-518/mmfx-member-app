import { NextResponse } from "next/server";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";
import { loadMemberAudit } from "@/lib/journal/ibMemberAudit";

// GET /api/journal/ib/member-report — CSV of all flagged members (registered
// account not under IB, or Dupoin balance below the threshold).

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;

  const { notUnderIb, lowBalance } = await loadMemberAudit(serviceClient());

  const header = [
    "flag",
    "account",
    "member_name",
    "member_email",
    "status",
    "dupoin_balance",
  ];
  const lines = [header.join(",")];
  for (const m of notUnderIb) {
    lines.push(
      ["not_under_ib", m.acct, m.full_name, m.email, m.account_status, ""]
        .map(csvCell)
        .join(",")
    );
  }
  for (const m of lowBalance) {
    lines.push(
      [
        "low_balance",
        m.acct,
        m.full_name,
        m.email,
        m.account_status,
        m.dupoinBalance,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ib-member-audit.csv"`,
    },
  });
}
