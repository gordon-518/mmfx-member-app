// Compact line-icon set (24x24, stroke=currentColor). SVG only — no emoji.
import type { SVGProps } from "react";

type I = SVGProps<SVGSVGElement>;
const base = (p: I) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const HomeIcon = (p: I) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9.5 20v-6h5v6" /></svg>
);
export const IndicatorsIcon = (p: I) => (
  <svg {...base(p)}><path d="M4 19h16" /><rect x="5.5" y="11" width="2.6" height="5" rx="0.6" /><rect x="11" y="7" width="2.6" height="9" rx="0.6" /><rect x="16.5" y="13" width="2.6" height="3" rx="0.6" /><path d="M4 5l4 3 4-4 4 3 4-4" /></svg>
);
export const StrategiesIcon = (p: I) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg>
);
export const LibraryIcon = (p: I) => (
  <svg {...base(p)}><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" /><path d="M5 17.5h13" /><path d="M9 4v12" /></svg>
);
export const CourseIcon = (p: I) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10.5 9.2v5.6l4.5-2.8-4.5-2.8Z" fill="currentColor" stroke="none" /></svg>
);
export const AnalysisIcon = (p: I) => (
  <svg {...base(p)}><path d="M4 18 9 12l3.5 3.5L20 7" /><path d="M20 11V7h-4" /></svg>
);
export const SignalsIcon = (p: I) => (
  <svg {...base(p)}><path d="M6 9a8 8 0 0 0 0 6M18 9a8 8 0 0 1 0 6M9 11a4 4 0 0 0 0 2M15 11a4 4 0 0 1 0 2" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>
);
export const LiveIcon = (p: I) => (
  <svg {...base(p)}><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="m16 10 5-2.5v9L16 14" /></svg>
);
export const StyleIcon = (p: I) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="m14.5 9.5-1.6 4.4-4.4 1.6 1.6-4.4 4.4-1.6Z" /></svg>
);
export const DeskIcon = (p: I) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5C9.8 18.2 8.6 15.2 8.6 12S9.8 5.8 12 3.5Z" /></svg>
);
export const ArrowIcon = (p: I) => (
  <svg {...base(p)}><path d="M5 12h13M12 6l6 6-6 6" /></svg>
);
export const ExternalIcon = (p: I) => (
  <svg {...base(p)}><path d="M14 5h5v5M19 5l-7 7" /><path d="M18 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18V9a1.5 1.5 0 0 1 1.5-1.5H12" /></svg>
);
export const LockIcon = (p: I) => (
  <svg {...base(p)}><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const LogoutIcon = (p: I) => (
  <svg {...base(p)}><path d="M14 5h-7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" /><path d="M16 12h6M19 8l4 4-4 4" /></svg>
);
export const SparkIcon = (p: I) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
);
export const NewsIcon = (p: I) => (
  <svg {...base(p)}><path d="M4 5h12v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Z" /><path d="M16 9h3a1 1 0 0 1 1 1v8a1 1 0 0 1-2 0" /><path d="M7 8.5h6M7 11.5h6M7 14.5h4" /></svg>
);
export const CalendarIcon = (p: I) => (
  <svg {...base(p)}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" /><path d="M8 13h2M14 13h2M8 16.5h2M14 16.5h2" /></svg>
);
