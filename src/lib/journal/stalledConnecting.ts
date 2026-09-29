// Accounts stranded in 'connecting' (Gordon, 29 Sep).
//
// The connect flow saves the account as 'connecting' and queues ONE job. If
// that job exhausts its attempts without the broker link coming up, nothing
// ever touches the account again: fn_enqueue_due_sync_jobs only picks up
// state='deployed', and the escalation to 'failed' lives inside a sync run
// that now never happens. The member is left watching "connecting" forever —
// no retry, no error, no email. Gordon's own account sat like that for six
// days.
//
// So the worker sweeps them: an account still 'connecting', with no job
// queued or running and nothing attempted for a while, is failed with the
// same message the in-sync path uses, and its MetaApi account is deleted (it
// can't be trusted to be undeployed, and a stale id would orphan on reconnect).

/** What the member sees, identical to sync.ts's terminal connect failure. */
export const CONNECT_STALLED_DETAIL =
  "We couldn't connect to your account. Reconnect with your read-only investor password and the correct server.";

export interface ConnectingAccount {
  id: string;
  metaapi_account_id: string | null;
  /** When the account row was created. */
  created_at: string;
}

export interface AccountJob {
  account_id: string;
  status: string;
  /** Null while queued or running. */
  finished_at: string | null;
}

/**
 * Which of these still-connecting accounts are stranded: nothing in flight,
 * and the last attempt (or the connect itself, if no job ever ran) is older
 * than `afterMs`.
 */
export function stalledConnecting(
  accounts: ConnectingAccount[],
  jobs: AccountJob[],
  now: Date,
  afterMs: number
): ConnectingAccount[] {
  const cutoff = now.getTime() - afterMs;
  const inFlight = new Set(
    jobs.filter((j) => j.status === "queued" || j.status === "running").map((j) => j.account_id)
  );
  const lastFinish = new Map<string, number>();
  for (const j of jobs) {
    if (!j.finished_at) continue;
    const t = new Date(j.finished_at).getTime();
    if (Number.isNaN(t)) continue;
    lastFinish.set(j.account_id, Math.max(lastFinish.get(j.account_id) ?? 0, t));
  }

  return accounts.filter((a) => {
    if (inFlight.has(a.id)) return false;
    // No job ever finished for it: fall back to when the member connected, so
    // a row whose job row was pruned is still swept.
    const last = lastFinish.get(a.id) ?? new Date(a.created_at).getTime();
    return !Number.isNaN(last) && last < cutoff;
  });
}
