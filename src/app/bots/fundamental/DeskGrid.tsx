import Link from "next/link";
import { formatAge, groupByAssetClass } from "@/lib/fa/format";
import { deskInstrument, type SummaryInstrument } from "@/lib/fa/types";
import { BiasPill, ConvictionBar, StateBadge } from "./parts";

// The desk's hub: every instrument's current read at a glance, grouped by
// asset class. One /api/summary call feeds the whole grid.

function Tile({ row, delay }: { row: SummaryInstrument; delay: number }) {
  const meta = deskInstrument(row.id);
  // A registry instrument the desk hasn't synthesized yet: show it, say so,
  // and don't link to a thesis that doesn't exist.
  const open = row.available && row.bias != null;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-[19px] font-bold tracking-tight text-ink">
            {row.display}
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-faint">
            {meta?.nickname ?? row.asset_class}
          </p>
        </div>
        {open ? (
          <StateBadge state={row.state} />
        ) : (
          <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
            soon
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        {open ? (
          <BiasPill bias={row.bias} />
        ) : (
          <span className="text-[12px] text-faint">No thesis yet</span>
        )}
        {open && row.generated_at && (
          <span className="text-[11px] text-faint">{formatAge(row.generated_at)}</span>
        )}
      </div>

      <div className="mt-4">
        <ConvictionBar confidence={open ? row.confidence : 0} />
      </div>
    </>
  );

  const shell = "rise block h-full rounded-2xl border border-line bg-card p-4 shadow-soft";
  return (
    <li>
      {open ? (
        <Link
          href={`/bots/fundamental?instrument=${row.id}`}
          style={{ animationDelay: `${delay}s` }}
          className={`${shell} transition-all hover:border-orange/40 hover:shadow-soft-lg`}
        >
          {body}
        </Link>
      ) : (
        <div className={`${shell} opacity-60`} style={{ animationDelay: `${delay}s` }}>
          {body}
        </div>
      )}
    </li>
  );
}

export function DeskGrid({ rows }: { rows: SummaryInstrument[] }) {
  const groups = groupByAssetClass(rows);
  // The rise animation staggers across the whole grid, not per section, so
  // each tile's delay comes from its position in the flattened order.
  const order = new Map(groups.flatMap((g) => g.items).map((i, idx) => [i.id, idx]));

  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const live = group.items.filter((i) => i.available).length;
        return (
          <section key={group.key}>
            <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2">
              <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">
                {group.label}
              </h2>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                {live}/{group.items.length} live
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((row) => (
                <Tile
                  key={row.id}
                  row={row}
                  delay={((order.get(row.id) ?? 0) + 1) * 0.04}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
