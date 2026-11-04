"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { en } from "./messages/en";
import type { Messages } from "./messages/types";

// Client components get the active dictionary from the root layout, which has
// already resolved the locale on the server — so the server render and the
// client hydrate from the same strings and never disagree.

interface I18nValue {
  locale: Locale;
  t: Messages;
}

// English is the fallback for anything rendered outside the provider (an
// isolated test render, an error boundary above the layout).
const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, t: en });

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={{ locale, t: messages }}>{children}</I18nContext.Provider>;
}

/** `const t = useT(); t.nav.dashboard` */
export function useT(): Messages {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
