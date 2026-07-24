"use client";

import { useState } from "react";

type Broker = { id: string; name: string; mode: string; updatedAt: string | null };
type Flagged = {
  id: string;
  mt5_login: string;
  broker_id: string;
  broker_server: string;
  balance: number | null;
  currency: string | null;
  last_synced_at: string | null;
};

const card =
  "rounded-2xl border border-line-strong bg-card p-5 shadow-soft space-y-3";
const btn =
  "cursor-pointer rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#f24e12] disabled:opacity-50";
const ghost =
  "cursor-pointer rounded-xl border border-line-strong px-3 py-2 text-[13px] font-semibold text-ink hover:border-orange/40 disabled:opacity-50";

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function BrokerCard({ broker }: { broker: Broker }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const stale = daysSince(broker.updatedAt);

  async function send(mode: "preview" | "commit", override = false) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("broker_id", broker.id);
    fd.set("mode", mode);
    if (override) fd.set("override", "1");
    const res = await fetch("/api/journal/ib/import", { method: "POST", body: fd });
    const body = await res.json();
    setBusy(false);
    if (body.mode === "committed") {
      setPreview(null);
      setMsg(
        `Committed: ${body.parsedCount} accounts · ${
          (body.flaggedConnected as string[])?.length ?? 0
        } flagged. Reload to see the flagged table.`
      );
    } else {
      setPreview(body);
      if (body.needOverride) setMsg("Guardrail tripped — review, then Confirm anyway.");
    }
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">{broker.name}</h3>
        <span className="text-[12px] text-subtle">
          {broker.mode} ·{" "}
          {stale === null ? "never imported" : `updated ${stale}d ago`}
          {stale !== null && stale > 10 ? " ⚠️" : ""}
        </span>
      </div>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="text-[13px]"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap gap-2">
        <button className={ghost} disabled={!file || busy} onClick={() => send("preview")}>
          Preview
        </button>
        {preview && !preview.needOverride && (
          <button className={btn} disabled={busy} onClick={() => send("commit")}>
            Confirm &amp; import
          </button>
        )}
        {preview?.needOverride ? (
          <button className={btn} disabled={busy} onClick={() => send("commit", true)}>
            Confirm anyway (override)
          </button>
        ) : null}
      </div>
      {preview && (
        <div className="space-y-0.5 rounded-xl bg-canvas/60 p-3 text-[12px] text-ink">
          <div>
            Parsed: {String(preview.parsedCount)} · skipped:{" "}
            {String(preview.skipped)}
          </div>
          <div>
            +{String(preview.added)} added · −{String(preview.removed)} removed (
            {String(preview.removalPct)}%)
          </div>
          <div>
            Will flag {(preview.flaggedConnected as string[])?.length ?? 0}{" "}
            connected accounts
          </div>
          <div className="text-subtle">
            Sample: {(preview.sample as string[])?.join(", ")}
          </div>
          {preview.referrerHint ? (
            <div className="text-subtle">
              Referrer id in file: {String(preview.referrerHint)}
            </div>
          ) : null}
        </div>
      )}
      {msg && <p className="text-[13px] text-ink">{msg}</p>}
    </div>
  );
}

export function IbAdmin({
  brokers,
  flagged,
}: {
  brokers: Broker[];
  flagged: Flagged[];
}) {
  const [rows, setRows] = useState(flagged);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: "block_journal" | "full_removal") {
    setBusyId(id);
    const res = await fetch(`/api/journal/accounts/${id}/ib-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await res.json();
    setBusyId(null);
    if (res.ok) {
      setRows((r) => r.filter((x) => x.id !== id));
      if (body.handoff) window.open(body.handoff, "_blank");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          IB reconciliation
        </h1>
        <p className="mt-1 text-[13px] text-subtle">
          Upload each broker&apos;s weekly export. Accounts not in the list are
          flagged for manual review — nothing is removed automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {brokers.map((b) => (
          <BrokerCard key={b.id} broker={b} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-ink">
          Flagged accounts ({rows.length})
        </h2>
        <a className={ghost} href="/api/journal/ib/report">
          Download CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line-strong">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas/60 text-left text-subtle">
            <tr>
              <th className="p-3">Login</th>
              <th className="p-3">Broker</th>
              <th className="p-3">Balance</th>
              <th className="p-3">Last sync</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="p-3 font-mono">{r.mt5_login}</td>
                <td className="p-3">{r.broker_id}</td>
                <td className="p-3">
                  {r.balance ?? "—"} {r.currency ?? ""}
                </td>
                <td className="p-3">
                  {r.last_synced_at
                    ? new Date(r.last_synced_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      className={ghost}
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "block_journal")}
                    >
                      Block journal (A)
                    </button>
                    <button
                      className={ghost}
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "full_removal")}
                    >
                      Full removal (B)
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-subtle" colSpan={5}>
                  No flagged accounts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
