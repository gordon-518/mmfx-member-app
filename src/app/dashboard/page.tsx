import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { resolveTrialView, type TrialSnapshot } from "@/lib/trial/status";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolve trial state ONLY when signed in. If not signed in we render a
  // message + link below and never touch the RPC.
  let view: ReturnType<typeof resolveTrialView> | null = null;
  let profileUnavailable = false;

  if (user) {
    // Lazily expire the trial if due, then read the refreshed profile row.
    const { data: profile, error } = await supabase.rpc(
      "fn_resolve_trial_status"
    );

    if (!error && profile) {
      view = resolveTrialView(profile as TrialSnapshot);
    } else {
      profileUnavailable = true;
    }
  }

  const tierIsFull = view?.accessTier === "Full";

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
        {!user ? (
          /* ---- Not signed in: no redirect, no RPC ---- */
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
        ) : view ? (
          /* ---- Signed in: real trial state ---- */
          <div className="w-full max-w-lg">
            <p
              className={`font-mono text-[10px] uppercase tracking-[0.28em] ${
                tierIsFull ? "text-orange/80" : "text-muted"
              }`}
            >
              Access · {view.accessTier}
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-pearl">
              {tierIsFull ? "Your desk is live." : "Access limited."}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {view.accountStatus === "member_active"
                ? "Membership active — full access."
                : tierIsFull
                  ? `${view.daysRemaining} day${
                      view.daysRemaining === 1 ? "" : "s"
                    } remaining in your trial.`
                  : "Your trial period has ended."}
            </p>

            <div className="mt-8 rounded-lg border border-pearl/10 bg-graphite/70 p-5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-pearl/10 pb-3 uppercase tracking-[0.2em] text-muted">
                <span>Account</span>
                <span className={tierIsFull ? "text-orange" : "text-muted"}>
                  ● {view.accessTier.toLowerCase()} access
                </span>
              </div>
              <dl className="mt-3 space-y-2">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">STATUS</dt>
                  <dd className="text-pearl">{view.statusLabel}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">
                    {view.accountStatus === "member_active"
                      ? "MEMBERSHIP"
                      : "DAYS LEFT"}
                  </dt>
                  <dd className="text-pearl">
                    {view.accountStatus === "member_active"
                      ? "permanent"
                      : view.daysRemaining}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">ACCESS</dt>
                  <dd className={tierIsFull ? "text-orange" : "text-pearl"}>
                    {view.accessTier}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">EMAIL</dt>
                  <dd className="truncate text-pearl">{user.email}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          /* ---- Signed in but no profile row yet / unavailable ---- */
          <div className="w-full max-w-md text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              {profileUnavailable ? "Profile Unavailable" : "Setting Up"}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-pearl">
              Preparing your desk.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              We couldn&apos;t load your profile just yet. Refresh in a moment —
              if it persists, sign out and back in.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
