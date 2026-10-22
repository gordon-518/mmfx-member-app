import Link from "next/link";
import { INVENTORY_STATS } from "@/lib/deskInventory";

// The desk by the numbers. Every figure is counted from the content modules
// themselves (src/lib/deskInventory.ts), so none of it can drift from what a
// member finds when they open the page.

export function WhatsInside() {
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">
        What&apos;s behind the six steps
      </p>
      <h3 className="mt-1.5 font-display text-[19px] font-bold tracking-tight text-ink">
        Everything your membership already includes
      </h3>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {INVENTORY_STATS.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className="group block h-full rounded-2xl border border-line bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-orange/40 hover:bg-accent-soft/50 hover:shadow-soft-lg"
            >
              <span className="block font-display text-[30px] font-bold leading-none tracking-tight text-orange">
                {s.n}
              </span>
              <span className="mt-1.5 block text-[13px] font-bold leading-snug text-ink">
                {s.label}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-faint">{s.sub}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
