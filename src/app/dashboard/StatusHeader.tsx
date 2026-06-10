import Link from "next/link";
import type { AccountStatus } from "@/lib/trial/status";
import { headerContent } from "./headerContent";

// Status strip under the top bar. One component, variant by account_status —
// the temperature changes (calm member / counting trial / pushed expiry),
// the layout doesn't.

export function StatusHeader({
  status,
  daysLeft,
}: {
  status: AccountStatus;
  daysLeft: number;
}) {
  const c = headerContent(status, daysLeft);
  const isMember = status === "member_active";
  const expired = c.cta?.kind === "push";

  return (
    <section
      className={`border-b px-6 py-8 sm:px-10 ${
        expired ? "border-orange/25 bg-orange/[0.04]" : "border-pearl/10"
      }`}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-6">
        <div>
          <p
            className={`font-mono text-[10px] uppercase tracking-[0.28em] ${
              isMember ? "text-orange/80" : expired ? "text-muted" : "text-orange/80"
            }`}
          >
            {c.eyebrow}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-pearl sm:text-4xl">
            {isMember && (
              <span
                aria-hidden
                className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-orange/50 bg-orange/10 align-middle font-mono text-sm text-orange"
              >
                ✓
              </span>
            )}
            {c.title}
          </h1>
          {c.body && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
          )}
        </div>

        {c.cta &&
          (c.cta.kind === "push" ? (
            <Link
              href={c.cta.href}
              className="inline-flex items-center gap-2 rounded-lg bg-orange px-6 py-3.5 font-display text-sm font-semibold uppercase tracking-wider text-black transition-transform duration-150 hover:-translate-y-px"
            >
              {c.cta.label} <span aria-hidden>→</span>
            </Link>
          ) : (
            <Link
              href={c.cta.href}
              className="font-mono text-xs text-muted underline decoration-orange/50 underline-offset-4 transition-colors hover:text-orange"
            >
              {c.cta.label} →
            </Link>
          ))}
      </div>
    </section>
  );
}
