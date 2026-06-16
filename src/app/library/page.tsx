import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { ExternalIcon } from "@/components/icons";
import { EBOOKS, type Ebook, type EbookTone } from "./ebooks";

const TONE: Record<EbookTone, { wrap: string; title: string; cat: string }> = {
  ink: { wrap: "bg-ink", title: "text-white", cat: "text-faint" },
  peach: { wrap: "bg-accent-soft", title: "text-accent-ink", cat: "text-accent-ink/60" },
  paper: { wrap: "bg-[#FBF3EC]", title: "text-ink", cat: "text-faint" },
};

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-orange" aria-hidden>
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Wordmark({ className }: { className: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-[3px] bg-orange" />
      <span className={`text-[7px] font-bold uppercase tracking-[0.14em] ${className}`}>Market Makers FX</span>
    </span>
  );
}

/** The designed cover — keeps titles crisp and on-brand (no AI text). */
function Cover({ book, variant }: { book: Ebook; variant: "flagship" | "grid" }) {
  const t = TONE[book.tone];
  if (variant === "flagship") {
    return (
      <div className={`flex h-48 w-36 shrink-0 flex-col justify-between rounded-xl p-4 shadow-soft ${t.wrap}`}>
        <Wordmark className={t.title} />
        <div>
          <span className="mb-2 block h-0.5 w-7 bg-orange" />
          <span className={`block font-display text-[17px] font-bold leading-tight tracking-tight ${t.title}`}>{book.title}</span>
          <span className={`mt-2 block text-[8px] font-semibold uppercase tracking-wider ${t.cat}`}>{book.category}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex h-32 flex-col justify-between p-4 ${t.wrap}`}>
      <Wordmark className={t.title} />
      <span className={`block font-display text-[16px] font-bold leading-tight tracking-tight ${t.title}`}>{book.title}</span>
    </div>
  );
}

function ReadDownload({ slug, compact }: { slug: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className="mt-3 flex items-center gap-3 text-[13px]">
        <a href={`/api/ebooks/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center gap-1 font-semibold text-orange transition-colors hover:text-accent-ink">
          Read <ExternalIcon width={13} height={13} />
        </a>
        <span className="text-line-strong">·</span>
        <a href={`/api/ebooks/${slug}`} download={`${slug}.pdf`} className="cursor-pointer font-medium text-subtle transition-colors hover:text-ink">
          Download
        </a>
      </div>
    );
  }
  return (
    <div className="mt-5 flex flex-wrap gap-2.5">
      <a href={`/api/ebooks/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg">
        Read in browser <ExternalIcon width={15} height={15} />
      </a>
      <a href={`/api/ebooks/${slug}`} download={`${slug}.pdf`} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent-soft px-5 py-3 text-[14px] font-semibold text-accent-ink transition-colors hover:bg-orange hover:text-white">
        Download PDF
      </a>
    </div>
  );
}

export default async function LibraryPage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();

  const featured = EBOOKS.find((b) => b.featured);
  const rest = EBOOKS.filter((b) => !b.featured);

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            Library · {EBOOKS.length} eBooks
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
            The MM Library
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            The written system and reference set — read in your browser or download.
            Pairs with the course; keep the cheat sheets open while you trade.
          </p>
        </div>

        {/* Featured flagship */}
        {featured && (
          <article className="rise mt-8 flex flex-col gap-5 rounded-2xl border border-line bg-card p-5 shadow-soft sm:flex-row sm:gap-6 sm:p-6">
            <Cover book={featured} variant="flagship" />
            <div className="flex flex-1 flex-col">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-orange">
                Flagship · {featured.category}
              </span>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink">
                {featured.title}
              </h2>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-subtle">{featured.blurb}</p>
              {featured.whatsInside && (
                <ul className="mt-3 space-y-1.5">
                  {featured.whatsInside.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink">
                      <CheckIcon /> {line}
                    </li>
                  ))}
                </ul>
              )}
              <ReadDownload slug={featured.slug} />
            </div>
          </article>
        )}

        {/* The rest of the shelf */}
        <p className="rise mb-4 mt-10 text-[12px] font-semibold uppercase tracking-wider text-faint">
          The rest of the shelf
        </p>
        <div className="rise grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((book) => (
            <article key={book.slug} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg">
              <Cover book={book} variant="grid" />
              <div className="flex flex-1 flex-col p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                  {book.category} · PDF
                </span>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-subtle">{book.blurb}</p>
                <ReadDownload slug={book.slug} compact />
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
