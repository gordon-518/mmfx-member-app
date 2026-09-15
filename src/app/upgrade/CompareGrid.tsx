import { buildComparison, FAQ, GRID_COLUMNS } from "@/lib/upgradeContent";
import { tierLabel, type MemberTier } from "@/lib/tiers";

// Every tier side by side, and the FAQ. The grid is built from the same
// feature map the page gates use, so it can't drift from real access.

function Tick() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-label="Included" className="mx-auto text-orange">
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CompareGrid({ current }: { current: MemberTier | null }) {
  const rows = buildComparison();
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-soft">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-faint">Feature</th>
            {GRID_COLUMNS.map((t) => (
              <th
                key={t}
                className={`px-3 py-3 text-center font-display text-[14px] font-bold tracking-tight ${
                  current === t ? "bg-accent-soft/60 text-accent-ink" : "text-ink"
                }`}
              >
                {tierLabel(t)}
                {current === t && <span className="block text-[10px] font-semibold uppercase tracking-wide">Your tier</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line last:border-b-0">
              <td className="px-4 py-2.5 text-ink">{r.label}</td>
              {GRID_COLUMNS.map((t) => {
                const cell = r.cells[t];
                return (
                  <td key={t} className={`px-3 py-2.5 text-center ${current === t ? "bg-accent-soft/30" : ""}`}>
                    {cell === true ? (
                      <Tick />
                    ) : cell === false ? (
                      <span className="text-faint" aria-label="Not included">
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

export function UpgradeFaq() {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-card shadow-soft">
      {FAQ.map((f) => (
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
