import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

        {user && (
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-xs text-muted sm:inline">
              Signed in as <span className="text-pearl">{user.email}</span>
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

      {/* Body */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-16">
        {user ? (
          <div className="w-full max-w-lg">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
              Session Active
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-pearl">
              Welcome to your desk.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:hidden">
              Signed in as{" "}
              <span className="text-pearl">{user.email}</span>
            </p>

            <div className="mt-8 rounded-lg border border-pearl/10 bg-graphite/70 p-5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-pearl/10 pb-3 uppercase tracking-[0.2em] text-muted">
                <span>Session</span>
                <span className="text-orange">● authenticated</span>
              </div>
              <dl className="mt-3 space-y-2">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">EMAIL</dt>
                  <dd className="truncate text-pearl">{user.email}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">USER ID</dt>
                  <dd className="truncate text-pearl/70">{user.id}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </main>
  );
}
