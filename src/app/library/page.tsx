import Link from "next/link";
import { requireFull } from "@/lib/access";
import { EBOOKS } from "./ebooks";

export default async function LibraryPage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  await requireFull();

  return (
    <main className="relative min-h-screen overflow-hidden bg-obsidian">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="session-grid absolute inset-0" />
        <div className="absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-orange/10 blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange/40 to-transparent" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-pearl/10 px-6 py-5 sm:px-10">
        <Link href="/dashboard" className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold tracking-tight text-pearl">
            MARKET MAKERS <span className="text-orange">FX</span>
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-muted sm:inline">
            Library
          </span>
        </Link>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-orange"
        >
          ← Desk
        </Link>
      </header>

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10 sm:px-10">
        {/* Header */}
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
          Library · eBooks
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-pearl sm:text-4xl">
          The MM Library
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          The written system and reference set. Read in your browser or
          download — each opens straight from your member access.
        </p>

        {/* Ebook grid */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EBOOKS.map((book) => (
            <article
              key={book.slug}
              className="flex flex-col rounded-lg border border-pearl/10 bg-graphite/70 p-5"
            >
              <span aria-hidden className="font-mono text-base text-orange/70">
                ▪
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold text-pearl">
                {book.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {book.blurb}
              </p>
              <a
                href={`/api/ebooks/${book.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex w-fit items-center gap-2 border border-orange/60 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-orange transition-colors hover:bg-orange hover:text-black"
              >
                Read / Download ↗
              </a>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
