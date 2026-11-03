import { buildComparison, faq, GRID_COLUMNS } from "@/lib/upgradeContent";
import type { MemberTier } from "@/lib/tiers";
import { getT } from "@/i18n/server";

// Every tier side by side, and the FAQ. The grid is built from the same
// feature map the page gates use, so it can't drift from real access.

function Tick({ label }: { label: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-label={label} className="mx-auto text-orange">
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export async function CompareGrid({ current }: { current: MemberTier | null }) {
  const t = await getT();
  const p = t.plans;
  const rows = buildComparison(p);
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-soft">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-faint">{p.gridFeature}</th>
            {GRID_COLUMNS.map((tier) => (
              <th
                key={tier}
                className={`px-3 py-3 text-center font-display text-[14px] font-bold tracking-tight ${
                  current === tier ? "bg-accent-soft/60 text-accent-ink" : "text-ink"
                }`}
              >
                {t.tiers[tier]}
                {current === tier && <span className="block text-[10px] font-semibold uppercase tracking-wide">{p.yourTier}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line last:border-b-0">
              <td className="px-4 py-2.5 text-ink">{r.label}</td>
              {GRID_COLUMNS.map((tier) => {
                const cell = r.cells[tier];
                return (
                  <td key={tier} className={`px-3 py-2.5 text-center ${current === tier ? "bg-accent-soft/30" : ""}`}>
                    {cell === true ? (
                      <Tick label={p.includedInTier} />
                    ) : cell === false ? (
                      <span className="text-faint" aria-label={p.notIncluded}>
                        —
                      </span>
                    ) : (
                      <span className="text-[12px] font-medium text-subtle">{cell}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function UpgradeFaq() {
  const { plans } = await getT();
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-card shadow-soft">
      {faq(plans).map((f) => (
        <details key={f.q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14.5px] font-semibold text-ink">
            {f.q}
            <span aria-hidden className="text-faint transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-2 text-[14px] leading-relaxed text-subtle">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
