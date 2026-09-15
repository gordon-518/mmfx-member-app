"use client";

import { TelegramIcon, WhatsAppIcon } from "@/components/icons";
import {
  LIFETIME_PLANS,
  LIFETIME_PLAN_ORDER,
  CONTACT_TELEGRAM_URL,
  lifetimePrice,
  lifetimeWhatsAppUrl,
  type LifetimePlan,
} from "@/lib/lifetimePlans";
import { logUpgradeClick } from "./actions";

// The US/UK plans on /upgrade (conversion-fix Phase 6). Two lifetime plans,
// paid once; the trader messages us with the plan named, pays, and an admin
// grants it. The member's own plan is marked, and Team MM holders see how to
// add the Mentorship.

function track(channel: "whatsapp" | "telegram") {
  return () => {
    void logUpgradeClick("upgrade_contact_clicked", { channel });
  };
}

export function LifetimePlans({ currentPlan }: { currentPlan: LifetimePlan | null }) {
  return (
    <ol className="mt-3 space-y-3">
      {LIFETIME_PLAN_ORDER.map((plan) => {
        const info = LIFETIME_PLANS[plan];
        const isCurrent = currentPlan === plan;
        const covered = currentPlan === "team_mentorship" && plan === "team";
        const isAddOn = currentPlan === "team" && plan === "team_mentorship";
        return (
          <li
            key={plan}
            className={`rounded-2xl border bg-card p-5 shadow-soft sm:p-6 ${
              isCurrent ? "border-orange/50 ring-2 ring-orange/15" : "border-line"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-xl font-bold tracking-tight text-ink">{info.name}</p>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                {isCurrent ? "Your plan" : covered ? "Included" : "Lifetime · one payment"}
              </span>
            </div>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-orange">{lifetimePrice(plan)}</p>
            <p className="mt-1 text-[13.5px] text-subtle">{info.pitch}</p>
            <ul className="mt-4 space-y-1.5">
              {info.includes.map((line) => (
                <li key={line} className="flex gap-2 text-[13.5px] text-ink">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                  {line}
                </li>
              ))}
            </ul>
            {!isCurrent && !covered && (
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href={lifetimeWhatsAppUrl(plan, currentPlan)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={track("whatsapp")}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg sm:w-auto"
                >
                  <WhatsAppIcon className="h-[17px] w-[17px]" />
                  {isAddOn ? "Add the Mentorship" : `Get ${info.name}`}
                </a>
                <a
                  href={CONTACT_TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={track("telegram")}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong bg-card px-5 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink sm:w-auto"
                >
                  <TelegramIcon className="h-[17px] w-[17px]" />
                  Telegram
                </a>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
