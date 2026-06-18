"use client";

import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  UserPlusIcon, WalletIcon, ChatIcon, CheckIcon, SwapIcon, SparkIcon,
} from "@/components/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
export type Region = "octa" | "dupoin" | "contact";

// --- Funnel links (see memory mmfx-broker-funnel) ----------------------------
const OCTA_SIGNUP = "https://clickto.trade/bT8tAZDKvQY?ib=47807426";
const DUPOIN_SIGNUP = "https://dupoin.me/ett5od077";
const OCTA_CHANGE_IB = "https://my.octabroker.com/change-partner-request/";
const ELEV8_CHANGE_IB = "https://my.elev8.com/change-partner-request/";
const IB_NUMBER = "47807426";
const SWITCH_REASON = "They are assisting me in my trading with signals and analysis.";
const WHATSAPP_URL =
  "https://wa.me/6588035858?text=Hi%20MMFX%2C%20requesting%20upgrade.%20Broker%3A%20%5BOcta%2FDupoin%5D%20Account%23%3A%20%5Bnumber%5D%20Tier%3A%20%5BTeam%20MM%2FMentorship%5D";
const TELEGRAM_URL = "https://t.me/m/QBXboWUEMWRl";
const TELEGRAM_SWITCH = "https://t.me/MM_3000";
// -----------------------------------------------------------------------------

type Cta = { label: string; href: string; primary?: boolean };
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
  return (
    <a href={cta.href} target="_blank" rel="noopener noreferrer" className={cls}>
      {cta.label} <span aria-hidden>{cta.primary ? "→" : "↗"}</span>
    </a>
  );
}

/** Animated vertical pathway — nodes stagger in, the spine draws top-to-bottom. */
function StepPath({ steps }: { steps: Step[] }) {
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
                {s.final ? "Done" : `Step ${i + 1}`}
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
      <div className={`mt-1 select-all rounded-lg border border-line bg-paper px-3 py-2 text-[13.5px] text-ink ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

const DETAILS_LINE =
  "your full name, Telegram username, trading account number, balance, country, and TradingView username";

function newAccountSteps(region: "octa" | "dupoin"): Step[] {
  const signup = region === "octa" ? OCTA_SIGNUP : DUPOIN_SIGNUP;
  const brand = region === "octa" ? "Octa or Elev8" : "Dupoin";
  return [
    {
      icon: UserPlusIcon,
      title: `Open your ${brand} account`,
      body: <>It takes a couple of minutes, and we&apos;re set as your partner automatically through the link.</>,
      ctas: [{ label: "Open your account", href: signup, primary: true }],
    },
    {
      icon: WalletIcon,
      title: "Fund it with $500",
      body: <>The capital sits in <em className="font-medium not-italic text-ink">your</em> account, under <em className="font-medium not-italic text-ink">your</em> name. You trade it, you withdraw it — nothing is paid to us.</>,
    },
    {
      icon: ChatIcon,
      title: "Send us your details",
      body: <>Once you&apos;ve funded, message us with {DETAILS_LINE} so we can match your account and switch you on.</>,
      ctas: [
        { label: "WhatsApp", href: WHATSAPP_URL, primary: true },
        { label: "Telegram", href: TELEGRAM_URL },
      ],
    },
    {
      icon: CheckIcon,
      title: "Your desk reopens",
      body: <>We confirm your deposit and restore full access — usually within the hour.</>,
      final: true,
    },
  ];
}

function octaSwitchSteps(): Step[] {
  return [
    {
      icon: SwapIcon,
      title: "Open the change-partner form",
      body: <>Keep your existing account — just request a partner change with your broker.</>,
      ctas: [
        { label: "Octa form", href: OCTA_CHANGE_IB },
        { label: "Elev8 form", href: ELEV8_CHANGE_IB },
      ],
    },
    {
      icon: SparkIcon,
      title: "Enter our details",
      body: (
        <>
          <Field label="IB number" value={IB_NUMBER} mono />
          <Field label="Reason for switching" value={`“${SWITCH_REASON}”`} />
        </>
      ),
    },
    {
      icon: WalletIcon,
      title: "Hold at least $500",
      body: <>Keep $500 in the account so your access can be restored.</>,
    },
    {
      icon: ChatIcon,
      title: "Send us your details",
      body: <>Message @MM_3000 with {DETAILS_LINE} so we can add you. It switches over within about an hour.</>,
      ctas: [{ label: "Message @MM_3000", href: TELEGRAM_SWITCH, primary: true }],
    },
    {
      icon: CheckIcon,
      title: "Your desk reopens",
      body: <>Once the switch lands, we restore full access.</>,
      final: true,
    },
  ];
}

function dupoinSwitchSteps(): Step[] {
  return [
    {
      icon: WalletIcon,
      title: "Hold at least $500",
      body: <>Keep $500 in your existing Dupoin account so access can be restored.</>,
    },
    {
      icon: SparkIcon,
      title: "Find your Dupoin UID",
      body: <>It&apos;s shown next to your name in your Dupoin profile.</>,
    },
    {
      icon: ChatIcon,
      title: "Send us your Full Name + UID",
      body: <>Message @MM_3000 and we&apos;ll process the partner switch with Dupoin by hand.</>,
      ctas: [{ label: "Message @MM_3000", href: TELEGRAM_SWITCH, primary: true }],
    },
    {
      icon: CheckIcon,
      title: "Your desk reopens",
      body: <>Once Dupoin confirms the switch, we restore full access.</>,
      final: true,
    },
  ];
}

function ContactCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
      <div className="flex items-center justify-center gap-3 border-b border-line bg-accent-soft/40 px-6 py-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-orange/30 bg-card text-orange shadow-soft">
          <ChatIcon className="h-5 w-5" />
        </span>
        <p className="font-display text-[18px] font-bold tracking-tight text-ink">
          Access in your region is arranged directly
        </p>
      </div>
      <div className="px-6 py-6 text-center">
        <p className="text-[15px] leading-relaxed text-subtle">
          The partnered brokers can&apos;t operate where you are — so we set you up personally. Reach out and we&apos;ll take it from there.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg sm:w-auto">
            Contact us on WhatsApp <span aria-hidden>→</span>
          </a>
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong bg-card px-5 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink sm:w-auto">
            Telegram ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export function UpgradeFlow({ region }: { region: Region }) {
  const [tab, setTab] = useState<"new" | "switch">("new");

  if (region === "contact") return <ContactCard />;

  const steps =
    tab === "new"
      ? newAccountSteps(region)
      : region === "octa"
        ? octaSwitchSteps()
        : dupoinSwitchSteps();

  const tabs: { key: "new" | "switch"; label: string }[] = [
    { key: "new", label: "Open a new account" },
    { key: "switch", label: region === "octa" ? "I trade with Octa / Elev8" : "I trade with Dupoin" },
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
        <StepPath key={tab} steps={steps} />
      </div>
    </div>
  );
}
