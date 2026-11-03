import { requireFeature } from "@/lib/access";
import { LockedFeature } from "@/components/LockedFeature";
import { AppShell } from "@/components/AppShell";
import { getDeskAnalysis, getDeskSummary } from "@/lib/fa/desk";
import { deskInstrument } from "@/lib/fa/types";
import { DeskGrid } from "./DeskGrid";
import { DeskUnreachable } from "./parts";
import { Thesis } from "./Thesis";
import { getLocale, getT } from "@/i18n/server";
import { fmt } from "@/i18n/format";

// The Fundamental Analysis Desk, rendered natively (it used to be an iframe of
// the desk's own dashboard). One page serves both views so the feature gate
// stays in one place: no ?instrument= → the grid; a valid one → that thesis.

export default async function FundamentalPage({
  searchParams,
}: {
  searchParams: Promise<{ instrument?: string }>;
}) {
  // Gate (conversion-fix 2.2): signed-out -> /login; locked -> preview.
  const gate = await requireFeature("fundamental-desk");
  if (gate.locked) return <LockedFeature feature="fundamental-desk" gate={gate} />;
  const profile = gate.profile;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const desk = t.fundamental;

  const { instrument: requested } = await searchParams;
  // Unknown ids never reach the desk: its API answers with gold for anything
  // it doesn't recognise, which would render gold's thesis under another name.
  const instrument = deskInstrument(requested);

  const shell = (children: React.ReactNode) => (
    <AppShell
      email={profile.email}
      accountStatus={profile.account_status}
      memberTier={gate.viewer.tier}
      isAdmin={profile.is_admin}
    >
      {children}
    </AppShell>
  );

  // ---------------- Detail: one instrument's full thesis ----------------
  if (instrument) {
    const envelope = await getDeskAnalysis(instrument.id);
    if (!envelope) {
      return shell(
        <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
          <DeskUnreachable
            title={fmt(desk.noThesisTitle, { instrument: instrument.display })}
            detail={desk.noThesisDetail}
            backHref="/bots/fundamental"
          />
        </div>
      );
    }
    return shell(<Thesis instrument={instrument} envelope={envelope} />);
  }

  // ---------------- Grid: every instrument at a glance ----------------
  const rows = await getDeskSummary();

  return shell(
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="rise mb-7">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{desk.eyebrow}</p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">{desk.title}</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">{desk.subtitle}</p>
        {locale !== "en" && <p className="mt-1.5 text-[12.5px] text-faint">{desk.contentNote}</p>}
      </div>

      {rows === null ? (
        <DeskUnreachable title={desk.unreachableTitle} detail={desk.unreachableDetail} />
      ) : rows.length === 0 ? (
        <DeskUnreachable title={desk.emptyTitle} detail={desk.emptyDetail} />
      ) : (
        <>
          <DeskGrid rows={rows} />
          <p className="mt-8 text-[12px] leading-relaxed text-faint">{desk.gridDisclaimer}</p>
        </>
      )}
    </div>
  );
}
