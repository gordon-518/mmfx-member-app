// Presentation shared by the agency and sponsor views of /partners/<slug>.
// Server components with no client JS.

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-2 font-display text-[34px] font-bold leading-none tracking-tight text-ink">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[12px] text-subtle">{sub}</p>}
    </div>
  );
}

// Inline-SVG sparkline, same shape as /stats: no charting dependency.
export function Sparkline({ values }: { values: number[] }) {
  const W = 120;
  const H = 28;
  const pad = 3;
  if (values.length < 2) return <span className="text-[11px] text-faint">—</span>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (H - pad * 2) * (1 - (v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-[120px]" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--color-orange)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Seg({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-lg bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-ink shadow-soft"
          : "rounded-lg px-3 py-1.5 text-[13px] font-medium text-subtle transition-colors hover:text-accent-ink"
      }
    >
      {children}
    </a>
  );
}
