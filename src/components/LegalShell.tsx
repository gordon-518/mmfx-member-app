import Link from "next/link";
import type { ReactNode } from "react";
import { getLocale, getT } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Plain, readable shell for the public legal pages (privacy / terms). Server
// component — no auth, warm-premium styling to match the app. The policies are
// in English, which is the version that applies; readers in another language
// are told so, and the frame around the text is in their language.
export async function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const l = t.legal;
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-card/60 px-5 py-4 sm:px-8">
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
        <LanguageSwitcher short />
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8 lg:py-14">
        {locale !== "en" && (
          <p className="mb-6 rounded-xl border border-line bg-card px-4 py-3 text-[13.5px] text-subtle">
            {t.common.englishGoverns}
          </p>
        )}
        <h1 lang="en" className="font-display text-3xl font-bold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-2 text-[13px] text-faint">{fmt(l.lastUpdated, { date: updated })}</p>

        <div lang="en" className="legal mt-8 space-y-6 text-[15px] leading-relaxed text-subtle">
          {children}
        </div>

        <footer className="mt-14 border-t border-line pt-6 text-[13px] text-faint">
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-accent-ink">{l.privacy}</Link>
            <Link href="/terms" className="hover:text-accent-ink">{l.terms}</Link>
            <Link href="/login" className="hover:text-accent-ink">{l.signIn}</Link>
            <a href="mailto:hello@marketmakersfx.net" className="hover:text-accent-ink">
              hello@marketmakersfx.net
            </a>
          </nav>
          <p className="mt-4">{fmt(l.rights, { year: updated.slice(-4) })}</p>
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
