import Link from "next/link";
import { getAccess } from "@/lib/access";
import { DashboardClient } from "./DashboardClient";

function Centered({
  eyebrow,
  title,
  body,
  cta,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md text-center">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-subtle">{body}</p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
          >
            {cta.label} →
          </Link>
        )}
      </div>
    </main>
  );
}

export default async function DashboardPage() {
  const access = await getAccess();

  if (!access.signedIn) {
    return (
      <Centered
        eyebrow="No session"
        title="You're not signed in"
        body="Sign in to open your desk."
        cta={{ href: "/login", label: "Go to login" }}
      />
    );
  }

  if (!access.profile) {
    return (
      <Centered
        eyebrow="Setting up"
        title="Preparing your desk"
        body="We couldn't load your profile just yet. Refresh in a moment — if it persists, sign out and back in."
      />
    );
  }

  return (
    <DashboardClient
      email={access.profile.email}
      accountStatus={access.profile.account_status}
      daysLeft={access.daysLeft}
      tier={access.tier}
    />
  );
}
