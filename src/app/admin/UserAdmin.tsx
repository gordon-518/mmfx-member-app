"use client";

import { useState } from "react";
import { lookupUser, banUser, deleteUser, type FoundUser } from "./actions";

// Admin user-management: look up one user by exact email, then Ban/Unban
// (reversible) or Delete (permanent, type-to-confirm). All mutations re-resolve
// and re-authorize server-side.
export function UserAdmin() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<FoundUser | null>(null);
  const [confirm, setConfirm] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function reset() {
    setUser(null);
    setConfirm("");
    setShowDelete(false);
  }

  async function onLookup() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    reset();
    const r = await lookupUser(email);
    if (r.ok) setUser(r.user);
    else setMsg({ kind: "err", text: r.error });
    setBusy(false);
  }

  async function onBan(ban: boolean) {
    if (!user || busy) return;
    setBusy(true);
    setMsg(null);
    const r = await banUser(user.email, ban);
    setMsg(r.ok ? { kind: "ok", text: r.message } : { kind: "err", text: r.error });
    if (r.ok) await refresh();
    setBusy(false);
  }

  async function onDelete() {
    if (!user || busy) return;
    setBusy(true);
    setMsg(null);
    const r = await deleteUser(user.email, confirm);
    if (r.ok) {
      setMsg({ kind: "ok", text: r.message });
      reset();
      setEmail("");
    } else {
      setMsg({ kind: "err", text: r.error });
    }
    setBusy(false);
  }

  async function refresh() {
    const r = await lookupUser(user!.email);
    if (r.ok) setUser(r.user);
    else reset();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink placeholder:text-faint focus:border-orange focus:outline-none"
        />
        <button
          type="button"
          onClick={onLookup}
          disabled={busy}
          className="rounded-lg bg-ink px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-ink/90 disabled:opacity-60"
        >
          {busy ? "…" : "Look up"}
        </button>
      </div>

      {msg && (
        <p className={`mt-3 text-[13px] ${msg.kind === "ok" ? "text-green-700" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}

      {user && (
        <div className="mt-3 rounded-lg border border-line bg-paper/60 p-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-semibold text-ink">{user.email}</span>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
              {user.account_status ?? "no profile"}
            </span>
            {user.banned && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                banned
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onBan(!user.banned)}
              disabled={busy}
              className="rounded-lg border border-line bg-card px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-60"
            >
              {user.banned ? "Unban" : "Ban (reversible)"}
            </button>
            {!showDelete ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                disabled={busy}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                Delete permanently…
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={`type ${user.email} to confirm`}
                  className="min-w-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-faint focus:border-red-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy || confirm.trim().toLowerCase() !== user.email.toLowerCase()}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDelete(false); setConfirm(""); }}
                  className="text-[13px] font-medium text-subtle hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-faint">
            Ban is reversible. Delete is permanent (no backups) and refuses paying members.
          </p>
        </div>
      )}
    </div>
  );
}
