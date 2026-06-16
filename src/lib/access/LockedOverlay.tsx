import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Locked-state wrapper for member-surface cards. Renders the card content
 * dimmed and inert under a lock veil with the upgrade CTA. Pure presentation
 * — pair it with the server-side gate (getAccess / requireFull); it is never
 * the gate itself.
 *
 *   <LockedOverlay>...card content...</LockedOverlay>
 */
export function LockedOverlay({
  children,
  ctaHref = "/upgrade",
  ctaLabel = "Upgrade to unlock",
}: {
  children: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  // App paths only — a "javascript:" or external href here would be an
  // injection vector once pages start passing dynamic values.
  const safeHref =
    ctaHref.startsWith("/") && !ctaHref.startsWith("//")
      ? ctaHref
      : "/upgrade";

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div aria-hidden className="pointer-events-none select-none opacity-40 blur-[1.5px]">
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-paper/70 backdrop-blur-sm">
        <span
          aria-hidden
          className="text-[11px] font-semibold uppercase tracking-wider text-faint"
        >
          Locked
        </span>
        <Link
          href={safeHref}
          className="cursor-pointer rounded-xl bg-orange px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
