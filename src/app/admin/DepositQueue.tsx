import { reviewSubmission } from "./actions";

// The deposit review queue (conversion-fix 5.2). Pending submissions, oldest
// first, each with a short-lived signed link to its proof. Verify runs the
// Phase 3 rules through fn_review_deposit_submission -> fn_verify_deposit;
// Reject needs a reason, which the member sees on /upgrade.

export interface QueueRow {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  amount: number;
  broker: string;
  account: string;
  tradingview: string | null;
  telegram: string | null;
  /** The code the member was asked to send @MM_3000, to match their DM. */
  ref: string;
  createdAt: string;
  proofUrl: string | null;
  isTopUp: boolean;
}

const INPUT =
  "rounded-lg border border-line bg-paper px-2 py-1.5 text-ink placeholder:text-faint focus:border-orange/40 focus:outline-none focus:ring-2 focus:ring-orange/15";

export function DepositQueue({ rows, hiddenFilters }: { rows: QueueRow[]; hiddenFilters: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-orange/30 bg-card p-4">
      <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">
        Deposit submissions <span className="text-orange">·</span> {rows.length} pending
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-subtle">Nothing waiting. New submissions show up here.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-paper/50 p-3 text-[13px]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-ink">
                  {r.email}
                  {r.name ? <span className="font-normal text-subtle"> · {r.name}</span> : null}
                  <span className="ml-2 text-[11px] font-semibold text-orange">{r.tier}</span>
                </p>
                <p className="text-[11px] text-faint">{new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC</p>
              </div>
              <p className="mt-1 text-subtle">
                <span className="font-semibold text-ink">${r.amount.toLocaleString("en-US")}</span>{" "}
                {r.isTopUp ? "top-up" : "first deposit"} · {r.broker} · account{" "}
                <span className="font-mono text-ink">{r.account}</span>
                {r.tradingview ? ` · TV @${r.tradingview}` : ""}
              </p>
              <p className="mt-1 text-subtle">
                Telegram:{" "}
                {r.telegram ? (
                  <a href={`https://t.me/${r.telegram}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-orange hover:text-accent-ink">
                    @{r.telegram} ↗
                  </a>
                ) : (
                  <span className="text-faint">not given (submitted before it was required)</span>
                )}
                {" · "}ref <span className="font-mono font-semibold text-ink">{r.ref}</span>
                <span className="text-faint"> (in their DM to @MM_3000)</span>
              </p>
              <p className="mt-1">
                {r.proofUrl ? (
                  <a href={r.proofUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-orange hover:text-accent-ink">
                    Open the screenshot ↗
                  </a>
                ) : (
                  <span className="text-accent-ink">Proof link unavailable</span>
                )}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <form action={reviewSubmission} className="flex items-center gap-2">
                  <input type="hidden" name="submission_id" value={r.id} />
                  <input type="hidden" name="decision" value="verify" />
                  {hiddenFilters}
                  <label className="flex items-center gap-1 text-subtle">
                    <input name="ib_confirmed" type="checkbox" className="accent-orange" /> IB confirmed
                  </label>
                  <button
                    type="submit"
                    className="cursor-pointer rounded-lg bg-orange px-3 py-1.5 font-semibold text-white transition-colors hover:bg-[#f24e12]"
                  >
                    Verify
                  </button>
                </form>
                <form action={reviewSubmission} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="submission_id" value={r.id} />
                  <input type="hidden" name="decision" value="reject" />
                  {hiddenFilters}
                  <input name="reason" required placeholder="Reason the member will see" className={`min-w-0 flex-1 ${INPUT}`} />
                  <button
                    type="submit"
                    className="cursor-pointer rounded-lg border border-line-strong px-3 py-1.5 font-medium text-subtle transition-colors hover:border-orange/40 hover:text-accent-ink"
                  >
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
