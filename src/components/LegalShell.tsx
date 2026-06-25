import Link from "next/link";
import type { ReactNode } from "react";

// Plain, readable shell for the public legal pages (privacy / terms). Server
// component — no auth, warm-premium styling to match the app.
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange shadow-soft">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M2 13L6.5 7.5L9.5 10.5L16 3"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="3" r="1.6" fill="white" />
            </svg>
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight text-ink">
            Market Makers <span className="text-orange">FX</span>
          </span>
        </Link>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8 lg:py-14">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-2 text-[13px] text-faint">Last updated: {updated}</p>

        <div className="legal mt-8 space-y-6 text-[15px] leading-relaxed text-subtle">
          {children}
        </div>

        <footer className="mt-14 border-t border-line pt-6 text-[13px] text-faint">
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-accent-ink">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-accent-ink">Terms of Service</Link>
            <Link href="/login" className="hover:text-accent-ink">Sign in</Link>
            <a href="mailto:hello@marketmakersfx.net" className="hover:text-accent-ink">
              hello@marketmakersfx.net
            </a>
          </nav>
          <p className="mt-4">© {updated.slice(-4)} Market Makers FX. All rights reserved.</p>
        </footer>
      </article>
    </main>
  );
}

// Small heading helper for legal section titles.
export function LegalHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-lg font-bold tracking-tight text-ink">
      {children}
    </h2>
  );
}
