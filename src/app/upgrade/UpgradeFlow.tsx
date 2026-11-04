"use client";

import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  UserPlusIcon, WalletIcon, ChatIcon, CheckIcon, SwapIcon, SparkIcon, TelegramIcon, WhatsAppIcon,
} from "@/components/icons";
import { logUpgradeClick } from "./actions";
import { ADMIN_DISPLAY_NAME, ADMIN_TELEGRAM_URL } from "@/lib/depositRef";
import {
  OCTA_SIGNUP, DUPOIN_SIGNUP, OCTA_CHANGE_IB, ELEV8_CHANGE_IB, IB_NUMBER, SWITCH_REASON,
} from "@/lib/brokerLinks";
import type { Region } from "@/lib/brokerRegion";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import type { Messages } from "@/i18n/messages/types";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
type Flow = Messages["upgrade"]["flow"];
export type { Region } from "@/lib/brokerRegion";

// --- Funnel links (see memory mmfx-broker-funnel) ----------------------------
// The WhatsApp prefills stay English in every language: the desk reads them.
const WHATSAPP_URL =
  "https://wa.me/6588035858?text=Hi%20MMFX%2C%20requesting%20upgrade.%20Broker%3A%20%5BOcta%2FDupoin%5D%20Account%23%3A%20%5Bnumber%5D%20Tier%3A%20%5BTeam%20MM%2FMentorship%5D";
const TELEGRAM_SWITCH = ADMIN_TELEGRAM_URL;
// US/UK contact path — these visitors can't open a partnered broker account, so
// the WhatsApp message + Telegram thread are dedicated to arranging access.
const CONTACT_WHATSAPP_URL =
  "https://wa.me/6588035858?text=" +
  encodeURIComponent(
    "Hi MMFX, I'd like full access. I'm in the US/UK and can't open a partnered broker account — how can I get set up?"
  );
const CONTACT_TELEGRAM_URL = "https://t.me/m/GIf6KqN9ZWZl";
// -----------------------------------------------------------------------------

// conversion-fix 1.3: CTAs that are funnel steps carry the event they emit.
type Track =
  | {
      event: "upgrade_broker_link_clicked";
      props: { broker: "octa" | "dupoin" | "elev8"; flow: "new" | "switch" };
    }
  | { event: "upgrade_contact_clicked"; props: { channel: "whatsapp" | "telegram" } };
type Cta = { label: string; href: string; primary?: boolean; icon?: Icon; track?: Track };

/** Fire-and-forget: the link opens in a new tab, so this page and its request survive. */
function track(t?: Track) {
  return t
    ? () => {
        void logUpgradeClick(t.event, t.props);
      }
    : undefined;
}
type Step = {
  icon: Icon;
  title: string;
  body: ReactNode;
  ctas?: Cta[];
  final?: boolean;
};

function CtaButton({ cta }: { cta: Cta }) {
  const cls = cta.primary
    ? "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg sm:w-auto"
    : "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong bg-card px-5 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink sm:w-auto";
  const Icon = cta.icon;
  // "#…" jumps to a section of this page, so it stays in the same tab.
  const inPage = cta.href.startsWith("#");
  return (
    <a
      href={cta.href}
      {...(inPage ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className={cls}
      onClick={track(cta.track)}
    >
      {Icon && <Icon className="h-[17px] w-[17px]" />}
      {cta.label}
      {!Icon && <span aria-hidden>{inPage ? "↓" : cta.primary ? "→" : "↗"}</span>}
    </a>
  );
}

/** Animated vertical pathway — nodes stagger in, the spine draws top-to-bottom. */
function StepPath({ steps, f }: { steps: Step[]; f: Flow }) {
  const reduce = useReducedMotion();
  return (
    <motion.ol
      className="relative mt-2"
      initial={reduce ? undefined : "hidden"}
      animate={reduce ? undefined : "show"}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } } }}
    >
      {/* The spine */}
      <motion.span
        aria-hidden
        className="absolute left-[21px] top-3 bottom-8 w-px bg-gradient-to-b from-orange/50 via-line-strong to-line"
        style={{ originY: 0 }}
        initial={reduce ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />

      {steps.map((s, i) => (
        <motion.li
          key={i}
          className="relative flex gap-4 pb-8 last:pb-0"
          variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Node */}
          <span
            className={`relative z-10 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border shadow-soft ${
              s.final
                ? "border-orange bg-orange text-white"
                : "border-line bg-card text-orange"
            }`}
          >
            <s.icon className="h-[20px] w-[20px]" />
          </span>

          {/* Content */}
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-faint">
                {s.final ? f.done : fmt(f.step, { n: i + 1 })}
              </span>
            </div>
            <h3 className="mt-0.5 font-display text-[17px] font-bold tracking-tight text-ink">
              {s.title}
            </h3>
            <div className="mt-1 text-[14.5px] leading-relaxed text-subtle">{s.body}</div>
            {s.ctas && s.ctas.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.ctas.map((c) => (
                  <CtaButton key={c.label} cta={c} />
                ))}
              </div>
            )}
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}

/** Small framed value, e.g. the IB number or the reason line. */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mt-2">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</span>
      <div lang="en" className={`mt-1 select-all rounded-lg border border-line bg-paper px-3 py-2 text-[13.5px] text-ink ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

// Tiers count every verified deposit, so $50 is the real starting point
// (conversion-fix tiers: Foundation $50, Desk $200, Team MM $500).
function withLadder(f: Flow, template: string, nodes: Record<string, ReactNode> = {}): ReactNode {
  return rich(fmt(template, { ladder: f.ladder }), nodes);
}

/** The emphasised "your" in "your account, under your name". */
function yours(f: Flow): Record<string, ReactNode> {
  return { your: <em className="font-medium not-italic text-ink">{f.your}</em> };
}

const admin = { admin: ADMIN_DISPLAY_NAME };

// The deposit form on this page (#submit-deposit) is how a deposit gets
// verified, so every path ends there instead of "send us your details".
function formStep(f: Flow): Step {
  return {
    icon: ChatIcon,
    title: f.formTitle,
    body: fmt(f.formBody, admin),
    ctas: [{ label: f.formCta, href: "#submit-deposit", primary: true }],
  };
}

function newAccountSteps(f: Flow, region: "octa" | "dupoin"): Step[] {
  const signup = region === "octa" ? OCTA_SIGNUP : DUPOIN_SIGNUP;
  const brand = region === "octa" ? f.brandOcta : "Dupoin";
  return [
    {
      icon: UserPlusIcon,
      title: fmt(f.openTitle, { brand }),
      body: f.openBody,
      ctas: [
        {
          label: f.openCta,
          href: signup,
          primary: true,
          track: { event: "upgrade_broker_link_clicked", props: { broker: region, flow: "new" } },
        },
      ],
    },
    {
      icon: WalletIcon,
      title: f.fundTitle,
      body: withLadder(f, f.fundBody, yours(f)),
    },
    formStep(f),
    {
      icon: CheckIcon,
      title: f.reopenTitle,
      body: f.reopenNew,
      final: true,
    },
  ];
}

function octaSwitchSteps(f: Flow): Step[] {
  return [
    {
      icon: SwapIcon,
      title: f.changeTitle,
      body: f.changeBody,
      ctas: [
        {
          label: f.octaForm,
          href: OCTA_CHANGE_IB,
          track: { event: "upgrade_broker_link_clicked", props: { broker: "octa", flow: "switch" } },
        },
        {
          label: f.elev8Form,
          href: ELEV8_CHANGE_IB,
          track: { event: "upgrade_broker_link_clicked", props: { broker: "elev8", flow: "switch" } },
        },
      ],
    },
    {
      icon: SparkIcon,
      title: f.detailsTitle,
      // The IB number and reason are pasted into the broker's form, so they
      // stay exactly as the broker expects them, in English.
      body: (
        <>
          <Field label={f.ibLabel} value={IB_NUMBER} mono />
          <Field label={f.reasonLabel} value={`“${SWITCH_REASON}”`} />
          <p className="mt-2 text-[12.5px] text-faint">{f.pasteExactly}</p>
        </>
      ),
    },
    {
      icon: WalletIcon,
      title: f.holdTitle,
      body: withLadder(f, f.holdOcta),
    },
    formStep(f),
    {
      icon: CheckIcon,
      title: f.reopenTitle,
      body: f.reopenSwitch,
      final: true,
    },
  ];
}

function dupoinSwitchSteps(f: Flow): Step[] {
  return [
    {
      icon: WalletIcon,
      title: f.holdTitle,
      body: withLadder(f, f.holdDupoin),
    },
    {
      icon: SparkIcon,
      title: f.uidTitle,
      body: f.uidBody,
    },
    {
      icon: ChatIcon,
      title: fmt(f.sendTitle, admin),
      body: fmt(f.sendBody, admin),
      ctas: [
        { label: fmt(f.messageAdmin, admin), href: TELEGRAM_SWITCH, primary: true, icon: TelegramIcon, track: { event: "upgrade_contact_clicked", props: { channel: "telegram" } } },
        { label: f.whatsapp, href: WHATSAPP_URL, icon: WhatsAppIcon, track: { event: "upgrade_contact_clicked", props: { channel: "whatsapp" } } },
      ],
    },
    { ...formStep(f), body: f.formDupoin },
    {
      icon: CheckIcon,
      title: f.reopenTitle,
      body: f.reopenDupoin,
      final: true,
    },
  ];
}

function ContactCard({ f }: { f: Flow }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
      <div className="flex items-center justify-center gap-3 border-b border-line bg-accent-soft/40 px-6 py-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-orange/30 bg-card text-orange shadow-soft">
          <ChatIcon className="h-5 w-5" />
        </span>
        <p className="font-display text-[18px] font-bold tracking-tight text-ink">{f.contactTitle}</p>
      </div>
      <div className="px-6 py-6 text-center">
        <p className="text-[15px] leading-relaxed text-subtle">{f.contactBody}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a href={CONTACT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={track({ event: "upgrade_contact_clicked", props: { channel: "whatsapp" } })} className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg sm:w-auto">
            <WhatsAppIcon className="h-[17px] w-[17px]" />
            {f.contactWhatsapp}
          </a>
          <a href={CONTACT_TELEGRAM_URL} target="_blank" rel="noopener noreferrer" onClick={track({ event: "upgrade_contact_clicked", props: { channel: "telegram" } })} className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong bg-card px-5 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink sm:w-auto">
            <TelegramIcon className="h-[17px] w-[17px]" />
            {f.telegram}
          </a>
        </div>
      </div>
    </div>
  );
}

export function UpgradeFlow({ region }: { region: Region }) {
  const [tab, setTab] = useState<"new" | "switch">("new");
  const f = useT().upgrade.flow;

  if (region === "contact") return <ContactCard f={f} />;

  const steps =
    tab === "new"
      ? newAccountSteps(f, region)
      : region === "octa"
        ? octaSwitchSteps(f)
        : dupoinSwitchSteps(f);

  const tabs: { key: "new" | "switch"; label: string }[] = [
    { key: "new", label: f.tabNew },
    { key: "switch", label: region === "octa" ? f.tabOcta : f.tabDupoin },
  ];

  return (
    <div>
      {/* Segmented tab control */}
      <div className="flex rounded-xl border border-line bg-card p-1 shadow-soft">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={active}
              className={`flex-1 cursor-pointer rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                active ? "bg-orange text-white shadow-soft" : "text-subtle hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-7">
        <StepPath key={tab} steps={steps} f={f} />
      </div>
    </div>
  );
}
