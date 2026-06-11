import Link from "next/link";

// Shared shell for the two gated bot pages: header + embedded bot iframe + an
// always-visible "Open in new tab" launcher. The launcher is the reliable
// path — if a bot app blocks framing (CSP frame-ancestors), the iframe renders
// blank but the button still works. Gating is the caller's requireFull().

export function BotPage({
  eyebrow,
  title,
  description,
  botUrl,
  embeddable = true,
}: {
  eyebrow: string;
  title: string;
  description: string;
  botUrl: string;
  // Some bots block framing (X-Frame-Options / CSP). For those, set false so
  // we render a clean launch panel instead of a dead/broken iframe.
  embeddable?: boolean;
}) {
  // botUrl is rendered into iframe src + anchor hrefs — https only, so a
  // stray javascript: value can never slip through this reusable shell.
  if (!botUrl.startsWith("https://")) {
    throw new Error(`BotPage: botUrl must be an https URL, got "${botUrl}"`);
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-obsidian">
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
            Bots
          </span>
        </Link>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-orange"
        >
          ← Desk
        </Link>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8 sm:px-10">
        {/* Header + launcher */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
              {eyebrow}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-pearl sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {description}
            </p>
          </div>
          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-orange px-5 py-3 font-display text-sm font-semibold uppercase tracking-wider text-black transition-transform duration-150 hover:-translate-y-px"
          >
            Open in new tab ↗
          </a>
        </div>

        {/* Embedded bot, or a clean launch panel when the bot blocks framing. */}
        <div className="relative min-h-[600px] flex-1 overflow-hidden rounded-lg border border-pearl/10 bg-graphite/40">
          {embeddable ? (
            <iframe
              src={botUrl}
              title={title}
              loading="lazy"
              referrerPolicy="origin"
              allow="fullscreen"
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <span
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-full border border-orange/40 bg-orange/10 font-mono text-xl text-orange"
              >
                ↗
              </span>
              <p className="max-w-sm text-sm leading-relaxed text-muted">
                {title} runs in its own window. Open it in a new tab — your
                session and progress stay there.
              </p>
              <a
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-orange px-6 py-3.5 font-display text-sm font-semibold uppercase tracking-wider text-black transition-transform duration-150 hover:-translate-y-px"
              >
                Launch {title} ↗
              </a>
            </div>
          )}
        </div>
        {embeddable && (
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted/70">
            Not loading above? Use{" "}
            <a
              href={botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange underline decoration-orange/50 underline-offset-2"
            >
              Open in new tab ↗
            </a>
            .
          </p>
        )}
      </div>
    </main>
  );
}
