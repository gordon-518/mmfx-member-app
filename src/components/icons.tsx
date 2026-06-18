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
export const MenuIcon = (p: I) => (
  <svg {...base(p)}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
);
export const CloseIcon = (p: I) => (
  <svg {...base(p)}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
);
export const CheckIcon = (p: I) => (
  <svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7" /></svg>
);
export const WalletIcon = (p: I) => (
  <svg {...base(p)}><path d="M4 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" /><path d="M4 9.5h13a2 2 0 0 1 2 2V13" /><circle cx="16.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" /></svg>
);
export const ChatIcon = (p: I) => (
  <svg {...base(p)}><path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.3-4.1A7.5 7.5 0 1 1 20 11.5Z" /><path d="M9 11h6M9 8.5h4" /></svg>
);
export const SwapIcon = (p: I) => (
  <svg {...base(p)}><path d="M7 4 3.5 7.5 7 11" /><path d="M3.5 7.5H15a4 4 0 0 1 4 4" /><path d="M17 20l3.5-3.5L17 13" /><path d="M20.5 16.5H9a4 4 0 0 1-4-4" /></svg>
);
export const UserPlusIcon = (p: I) => (
  <svg {...base(p)}><circle cx="9.5" cy="8" r="3.3" /><path d="M3.5 19.5a6 6 0 0 1 12 0" /><path d="M19 7.5v5M16.5 10h5" /></svg>
);
// Brand glyphs — filled, inherit currentColor (white on the orange button, ink
// on the outline button). Paths from simple-icons.
export const TelegramIcon = (p: I) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);
export const WhatsAppIcon = (p: I) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.582 0 11.94-5.359 11.943-11.945a11.821 11.821 0 0 0-3.495-8.4" />
  </svg>
);
