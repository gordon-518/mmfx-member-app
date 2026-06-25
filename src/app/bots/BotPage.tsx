import { AppShell } from "@/components/AppShell";
import { ExternalIcon } from "@/components/icons";
import type { AccountStatus } from "@/lib/trial/status";
import { BotNav } from "./BotNav";

// Shared shell for the two gated bot pages: header + embedded bot iframe + an
// always-visible "Open in new tab" launcher. The launcher is the reliable
// path — if a bot app blocks framing (CSP frame-ancestors), the iframe renders
// blank but the button still works. Gating is the caller's requireFull().

export function BotPage({
  email,
  accountStatus,
  eyebrow,
  title,
  description,
  botUrl,
  embedUrl,
  embeddable = true,
}: {
  email: string;
  accountStatus: AccountStatus;
  eyebrow: string;
  title: string;
  description: string;
  botUrl: string;
  // Optional separate URL for the iframe (e.g. an "?app=1" embedded mode),
  // while the "Open in new tab" launcher stays on the plain botUrl. Defaults
  // to botUrl. Must share botUrl's origin so the postMessage guards still hold.
  embedUrl?: string;
  // Some bots block framing (X-Frame-Options / CSP). For those, set false so
  // we render a clean launch panel instead of a dead/broken iframe.
  embeddable?: boolean;
}) {
  // botUrl is rendered into iframe src + anchor hrefs — https only, so a
  // stray javascript: value can never slip through this reusable shell.
  if (!botUrl.startsWith("https://")) {
    throw new Error(`BotPage: botUrl must be an https URL, got "${botUrl}"`);
  }
  const iframeSrc = embedUrl ?? botUrl;
  if (!iframeSrc.startsWith("https://")) {
    throw new Error(`BotPage: embedUrl must be an https URL, got "${iframeSrc}"`);
  }

  return (
    <AppShell email={email} accountStatus={accountStatus} tier="Full">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-8 lg:py-10">
        {/* Header + launcher */}
        <div className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
              {eyebrow}
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
              {description}
            </p>
          </div>
          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
          >
            Open in new tab <ExternalIcon width={15} height={15} />
          </a>
        </div>

        {/* Lets the embedded bot request in-app navigation (deep-link buttons). */}
        {embeddable && <BotNav origin={new URL(botUrl).origin} />}

        {/* Embedded bot, or a clean launch panel when the bot blocks framing. */}
        <div className="rise relative min-h-[600px] flex-1 overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
          {embeddable ? (
            <iframe
              src={iframeSrc}
              title={title}
              loading="lazy"
              referrerPolicy="origin"
              allow="fullscreen"
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
                <ExternalIcon width={22} height={22} />
              </span>
              <p className="max-w-sm text-[14px] leading-relaxed text-subtle">
                {title} runs in its own window. Open it in a new tab — your
                session and progress stay there.
              </p>
              <a
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
              >
                Launch {title} <ExternalIcon width={16} height={16} />
              </a>
            </div>
          )}
        </div>
        {embeddable && (
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            Not loading above? Use{" "}
            <a
              href={botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange underline decoration-orange/40 underline-offset-2 hover:text-accent-ink"
            >
              Open in new tab
            </a>
            .
          </p>
        )}
      </div>
    </AppShell>
  );
}
