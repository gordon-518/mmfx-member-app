"use client";

import type { CurvePoint, HistogramBin } from "@/lib/journal/analytics";

// Lightweight, dependency-free SVG charts for the Phase 2 dashboard. Hand-rolled
// rather than pulling in a charting library — keeps the bundle lean and matches
// the app's minimal-dependency convention. All charts are responsive via a
// fixed viewBox + width:100%.

const W = 600;
const H = 180;
const PAD = { t: 12, r: 12, b: 20, l: 44 };

const GREEN = "#059669";
const RED = "#ef4444";

function scale(
  values: number[],
  min: number,
  max: number,
  lo: number,
  hi: number
): (v: number) => number {
  const span = max - min || 1;
  return (v) => lo + ((v - min) / span) * (hi - lo);
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function EquityCurveChart({ points }: { points: CurvePoint[] }) {
  if (points.length < 2) {
    return <EmptyChart label="Not enough closed trades yet" />;
  }
  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const x = scale(
    points.map((_, i) => i),
    0,
    points.length - 1,
    PAD.l,
    W - PAD.r
  );
  const y = scale(values, min, max, H - PAD.b, PAD.t);
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const area = `${PAD.l},${y(0)} ${line} ${W - PAD.r},${y(0)}`;
  const up = values[values.length - 1] >= 0;
  const color = up ? GREEN : RED;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative profit and loss over time">
      <line x1={PAD.l} y1={y(0)} x2={W - PAD.r} y2={y(0)} stroke="#d1d5db" strokeWidth="1" />
      <polygon points={area} fill={color} opacity="0.08" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <text x={PAD.l - 6} y={y(max)} textAnchor="end" dominantBaseline="middle" className="fill-subtle text-[10px]">{fmtCompact(max)}</text>
      <text x={PAD.l - 6} y={y(min)} textAnchor="end" dominantBaseline="middle" className="fill-subtle text-[10px]">{fmtCompact(min)}</text>
    </svg>
  );
}

export function DrawdownChart({ points }: { points: CurvePoint[] }) {
  if (points.length < 2) {
    return <EmptyChart label="Not enough closed trades yet" />;
  }
  const values = points.map((p) => p.value); // all ≤ 0
  const min = Math.min(...values, 0);
  const x = scale(
    points.map((_, i) => i),
    0,
    points.length - 1,
    PAD.l,
    W - PAD.r
  );
  const y = scale([min, 0], min, 0, H - PAD.b, PAD.t);
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const area = `${PAD.l},${y(0)} ${line} ${W - PAD.r},${y(0)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Drawdown below running peak over time">
      <line x1={PAD.l} y1={y(0)} x2={W - PAD.r} y2={y(0)} stroke="#d1d5db" strokeWidth="1" />
      <polygon points={area} fill={RED} opacity="0.12" />
      <polyline points={line} fill="none" stroke={RED} strokeWidth="1.6" strokeLinejoin="round" />
      <text x={PAD.l - 6} y={y(min)} textAnchor="end" dominantBaseline="middle" className="fill-subtle text-[10px]">{fmtCompact(min)}</text>
      <text x={PAD.l - 6} y={y(0)} textAnchor="end" dominantBaseline="middle" className="fill-subtle text-[10px]">0</text>
    </svg>
  );
}

export function PnlHistogram({ bins }: { bins: HistogramBin[] }) {
  if (bins.length === 0) {
    return <EmptyChart label="No closed trades yet" />;
  }
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const gap = 4;
  const barW = (W - PAD.l - PAD.r - gap * (bins.length - 1)) / bins.length;
  const y = scale([0, maxCount], 0, maxCount, H - PAD.b, PAD.t);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Distribution of trade profit and loss">
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#d1d5db" strokeWidth="1" />
      {bins.map((b, i) => {
        const bx = PAD.l + i * (barW + gap);
        const by = y(b.count);
        const mid = (b.from + b.to) / 2;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={barW} height={H - PAD.b - by} rx="2" fill={mid >= 0 ? GREEN : RED} opacity="0.85" />
            {b.count > 0 && (
              <text x={bx + barW / 2} y={by - 3} textAnchor="middle" className="fill-subtle text-[9px]">{b.count}</text>
            )}
          </g>
        );
      })}
      <text x={PAD.l} y={H - 6} textAnchor="start" className="fill-subtle text-[9px]">{fmtCompact(bins[0].from)}</text>
      <text x={W - PAD.r} y={H - 6} textAnchor="end" className="fill-subtle text-[9px]">{fmtCompact(bins[bins.length - 1].to)}</text>
    </svg>
  );
}

// Generic radar/spider chart. Each axis value is normalised 0..1. Brand-tinted.
export function RadarChart({ axes }: { axes: { label: string; value: number }[] }) {
  const N = axes.length;
  const cx = 100;
  const cy = 94;
  const R = 60;
  const pt = (i: number, v: number): [number, number] => {
    const ang = (-90 + (360 / N) * i) * (Math.PI / 180);
    return [cx + R * v * Math.cos(ang), cy + R * v * Math.sin(ang)];
  };
  const ring = (g: number) => axes.map((_, i) => pt(i, g).join(",")).join(" ");
  const data = axes.map((a) => Math.max(0, Math.min(1, a.value || 0)));
  const dataPoly = axes.map((_, i) => pt(i, data[i]).join(",")).join(" ");

  return (
    // extra horizontal room in the viewBox so the side axis labels never clip
    <svg viewBox="-28 0 256 200" className="mx-auto w-full max-w-[260px]" role="img" aria-label="Trading profile across five dimensions">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon key={g} points={ring(g)} fill="none" className="stroke-line" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-line" strokeWidth="1" />;
      })}
      <polygon points={dataPoly} className="fill-orange/15 stroke-orange" strokeWidth="2" strokeLinejoin="round" />
      {axes.map((_, i) => {
        const [x, y] = pt(i, data[i]);
        return <circle key={i} cx={x} cy={y} r="3" className="fill-orange" />;
      })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1.24);
        const anchor = x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle";
        return (
          <text key={i} x={x} y={y + 3} textAnchor={anchor} className="fill-subtle text-[9px] font-semibold">
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[120px] items-center justify-center text-[13px] text-subtle">
      {label}
    </div>
  );
}
