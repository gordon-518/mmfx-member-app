"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";
import { useLocale, useT } from "@/i18n/client";

// A native <select>: it is keyboard- and screen-reader-correct for free, and
// on a phone it opens the OS picker, which is the best list UI there is.
// Each language is written in its own script, so nobody has to read English
// to find theirs.
//
// `short` is for tight headers (the upgrade and legal pages on a phone): it
// shows a two-letter tag, with the same native select laid invisibly over it,
// so tapping still opens the full list.

export function LanguageSwitcher({ compact = false, short = false }: { compact?: boolean; short?: boolean }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  const options = LOCALES.map((l) => (
    <option key={l} value={l} lang={l}>
      {LOCALE_LABEL[l]}
    </option>
  ));

  if (short) {
    return (
      <label
        className={`relative flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-card px-2.5 py-1.5 text-subtle transition-colors focus-within:border-orange/50 hover:border-line-strong ${
          pending ? "opacity-60" : ""
        }`}
      >
        <Globe />
        <span aria-hidden className="text-[12.5px] font-semibold text-ink">{LOCALE_SHORT[locale]}</span>
        <span className="sr-only">{t.common.chooseLanguage}</span>
        <select
          value={locale}
          disabled={pending}
          onChange={(e) => change(e.target.value as Locale)}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
        >
          {options}
        </select>
      </label>
    );
  }

  return (
    <label
      className={`relative flex items-center gap-2 rounded-xl border border-line bg-card text-subtle transition-colors focus-within:border-orange/50 hover:border-line-strong ${
        compact ? "px-2.5 py-1.5" : "px-3 py-2"
      } ${pending ? "opacity-60" : ""}`}
    >
      <Globe />
      <span className="sr-only">{t.common.chooseLanguage}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => change(e.target.value as Locale)}
        className={`w-full cursor-pointer appearance-none bg-transparent pr-5 font-medium text-ink outline-none ${
          compact ? "text-[12.5px]" : "text-[13px]"
        }`}
      >
        {options}
      </select>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="pointer-events-none absolute right-2.5 text-faint">
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

function Globe() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-faint">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
