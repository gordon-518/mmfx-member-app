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
    <div className="relative overflow-hidden rounded-lg">
      <div aria-hidden className="pointer-events-none select-none opacity-40 blur-[1.5px]">
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-obsidian/60">
        <span
          aria-hidden
          className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted"
        >
          ▪ Locked
        </span>
        <Link
          href={safeHref}
          className="border border-orange/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-orange transition-colors hover:bg-orange hover:text-black"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
