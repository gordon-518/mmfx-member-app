import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdminApi, serviceClient } from "@/lib/journal/api";
import { loadBrokers } from "@/lib/journal/ibBrokers";
import { parseIbRows, parseIbBalances } from "@/lib/journal/ibParse";
import { reconcile } from "@/lib/journal/ibReconcile";

// POST /api/journal/ib/import (multipart: file, broker_id, mode, override)
// mode=preview → return the diff; mode=commit → full-replace the allowlist,
// flag connected-but-absent accounts, stamp allowlist_updated_at.

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if ("response" in guard) return guard.response;

  const form = await req.formData();
  const brokerId = String(form.get("broker_id") ?? "");
  const mode = String(form.get("mode") ?? "preview");
  const override = String(form.get("override") ?? "") === "1";
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const svc = serviceClient();
  const broker = (await loadBrokers(svc)).find((b) => b.id === brokerId);
  if (!broker) {
    return NextResponse.json({ error: "Unknown broker" }, { status: 400 });
  }

  // Read the workbook → rows for the configured sheet.
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = broker.parse_config.sheet ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return NextResponse.json(
      { error: `Sheet "${sheetName}" not found in the file` },
      { status: 400 }
    );
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
  });
  const parsed = parseIbRows(rows, broker.parse_config);
  const balances = parseIbBalances(rows, broker.parse_config);

  // Current allowlist for this broker — PAGINATE past PostgREST's 1000-row cap
  // (elev8_octa holds ~12k; a plain select would silently truncate the diff).
  const currentAllowlist: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await svc
      .from("ib_accounts")
      .select("mt5_login")
      .eq("broker_id", brokerId)
      .range(from, from + 999);
    const batch = (data ?? []).map((r) => r.mt5_login as string);
    currentAllowlist.push(...batch);
    if (batch.length < 1000) break;
  }

  // Connected accounts for this broker (small set — journal users).
  const { data: connRows } = await svc
    .from("journal_accounts")
    .select("mt5_login")
    .eq("broker_id", brokerId)
    .in("state", ["connecting", "deployed"]);
  const connectedLogins = (connRows ?? []).map((r) => r.mt5_login as string);

  const result = reconcile({
    currentAllowlist,
    newList: parsed.logins,
    connectedLogins,
  });

  const preview = {
    parsedCount: parsed.logins.length,
    skipped: parsed.skipped,
    sample: parsed.logins.slice(0, 10),
    referrerHint:
      brokerId === "elev8_octa"
        ? String((rows[0] as Record<string, unknown>)?.unique_referrer_id ?? "")
        : null,
    added: result.added.length,
    removed: result.removed.length,
    flaggedConnected: result.flaggedConnected,
    guardRemoval: result.guardRemoval,
    guardAddition: result.guardAddition,
    removalPct: result.removalPct,
    additionPct: result.additionPct,
  };

  if (mode !== "commit") {
    return NextResponse.json({ mode: "preview", ...preview });
  }

  if ((result.guardRemoval || result.guardAddition) && !override) {
    return NextResponse.json(
      { mode: "blocked", ...preview, needOverride: true },
      { status: 409 }
    );
  }

  // Commit: full-replace this broker's allowlist.
  await svc.from("ib_accounts").delete().eq("broker_id", brokerId);
  if (parsed.logins.length > 0) {
    const CHUNK = 1000;
    for (let i = 0; i < parsed.logins.length; i += CHUNK) {
      const batch = parsed.logins.slice(i, i + CHUNK).map((mt5_login) => ({
        broker_id: brokerId,
        mt5_login,
        balance: balances.get(mt5_login) ?? null,
      }));
      const { error } = await svc.from("ib_accounts").insert(batch);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  // Flag connected accounts not in the new list (only bump ok → flagged; never
  // downgrade a journal_blocked).
  if (result.flaggedConnected.length > 0) {
    await svc
      .from("journal_accounts")
      .update({ ib_review: "flagged" })
      .eq("broker_id", brokerId)
      .eq("ib_review", "ok")
      .in("mt5_login", result.flaggedConnected);
  }

  // Clear a stale `flagged` for connected accounts that reappeared in the list.
  // Operate on the small CONNECTED set (not the ~12k parsed list — an .in() with
  // 12k values would blow the request URL). reappeared = connected minus flagged.
  const flaggedSet = new Set(result.flaggedConnected);
  const reappeared = connectedLogins.filter((l) => !flaggedSet.has(l));
  if (reappeared.length > 0) {
    await svc
      .from("journal_accounts")
      .update({ ib_review: "ok" })
      .eq("broker_id", brokerId)
      .eq("ib_review", "flagged")
      .in("mt5_login", reappeared);
  }

  await svc
    .from("ib_brokers")
    .update({ allowlist_updated_at: new Date().toISOString() })
    .eq("id", brokerId);

  return NextResponse.json({ mode: "committed", ...preview });
}
