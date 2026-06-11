import Link from "next/link";
import { getAccess } from "@/lib/access";
import { LockedOverlay } from "@/lib/access/LockedOverlay";
import { signOut } from "./actions";
import { StatusHeader } from "./StatusHeader";

// ---------------------------------------------------------------------------
// PLACEHOLDERS — Gordon fills these in (Telegram invite / Zoom registration).
const SIGNALS_URL = "#"; // TODO: Telegram signals channel invite link
const LIVE_CLASSES_URL = "#"; // TODO: Zoom live-class registration link
// ---------------------------------------------------------------------------

interface MemberCard {
  key: string;
  eyebrow: string;
  title: string;
  desc: string;
  href: string;
  external?: boolean;
  comingSoon?: boolean;
}

// Every member surface, gated as one grid. Content pages land Day 6–7 —
// until then their cards carry the "soon" state rather than dead links.
const CARDS: MemberCard[] = [
  {
    key: "indicators",
    eyebrow: "Tools",
    title: "Indicators",
    desc: "The TradingView suite, keyed to your username.",
    href: "/indicators",
  },
  {
    key: "strategies",
    eyebrow: "Tools",
    title: "Strategies",
    desc: "Backtestable setups with rules you can audit.",
    href: "/strategies",
  },
  {
    key: "library",
    eyebrow: "Library",
    title: "eBook Library",
    desc: "MM System, Decision Tree, If-Then, Cheat Sheet.",
    href: "/library",
  },
  {
    key: "course",
    eyebrow: "Education",
    title: "Video Course",
    desc: "The full curriculum, session by session.",
    href: "/course",
  },
  {
    key: "signals",
    eyebrow: "Live",
    title: "Signals",
    desc: "Three to five high-conviction calls a day.",
    href: SIGNALS_URL,
    external: true,
  },
  {
    key: "live-classes",
    eyebrow: "Live",
    title: "Live Classes",
    desc: "Two sessions a week, London and New York.",
    href: LIVE_CLASSES_URL,
    external: true,
  },
  {
    key: "know-your-style",
    eyebrow: "Bots",
    title: "Know Your Style",
    desc: "Find the trading profile you'll actually stick to.",
    href: "#",
    comingSoon: true,
  },
  {
    key: "fundamental-desk",
    eyebrow: "Bots",
    title: "Fundamental Analysis Desk",
    desc: "Macro context for the pairs you trade.",
    href: "#",
    comingSoon: true,
  },
];

function CardBody({ card }: { card: MemberCard }) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-pearl/10 bg-graphite/70 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
        {card.eyebrow}
      </p>
      <h3 className="mt-2 font-display text-lg font-semibold text-pearl">
        {card.title}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{card.desc}</p>
      <p className="mt-auto pt-4 font-mono text-[11px] uppercase tracking-[0.2em]">
        {card.comingSoon ? (
          <span className="text-muted">● coming to your member area</span>
        ) : card.external ? (
          <span className="text-orange">open ↗</span>
        ) : (
          <span className="text-orange">open →</span>
        )}
      </p>
    </div>
  );
}

function UnlockedCard({ card }: { card: MemberCard }) {
  if (card.comingSoon) {
    return <CardBody card={card} />;
  }
  if (card.external) {
    return (
      <a
        href={card.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full transition-transform duration-150 hover:-translate-y-0.5 [&>div]:hover:border-orange/50"
      >
        <CardBody card={card} />
      </a>
    );
  }
  return (
    <Link
      href={card.href}
      className="block h-full transition-transform duration-150 hover:-translate-y-0.5 [&>div]:hover:border-orange/50"
    >
      <CardBody card={card} />
    </Link>
  );
}

export default async function DashboardPage() {
  const access = await getAccess();

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
        <div className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold tracking-tight text-pearl">
            MARKET MAKERS <span className="text-orange">FX</span>
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-muted sm:inline">
            Desk
          </span>
        </div>

        {access.signedIn && access.profile && (
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-xs text-muted sm:inline">
              Signed in as{" "}
              <span className="text-pearl">{access.profile.email}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-pearl/15 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-orange/60 hover:text-pearl"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </header>

      {!access.signedIn ? (
        /* ---- Not signed in: message + link, no redirect ---- */
        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-16">
          <div className="w-full max-w-md text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              No Session
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-pearl">
              Not signed in.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              You don&apos;t have an active session on this desk.
            </p>
            <Link
              href="/login"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-orange px-6 py-3.5 font-display text-sm font-semibold uppercase tracking-wider text-black transition-transform duration-150 hover:-translate-y-px"
            >
              Go to login <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      ) : !access.profile ? (
        /* ---- Signed in, profile unavailable ---- */
        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-16">
          <div className="w-full max-w-md text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              Setting Up
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-pearl">
              Preparing your desk.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              We couldn&apos;t load your profile just yet. Refresh in a moment
              — if it persists, sign out and back in.
            </p>
          </div>
        </div>
      ) : (
        /* ---- The member hub: status strip + gated grid ---- */
        <div className="relative z-10 flex-1">
          <StatusHeader
            status={access.profile.account_status}
            daysLeft={access.daysLeft}
          />

          <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              Member Surfaces
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CARDS.map((card) =>
                access.tier === "Full" ? (
                  <UnlockedCard key={card.key} card={card} />
                ) : (
                  <LockedOverlay key={card.key}>
                    <CardBody card={card} />
                  </LockedOverlay>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
