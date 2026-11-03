// Trading account number (MT4/MT5 login) validation — single source of truth for
// the client-side check. The DB function fn_set_trading_account enforces the same
// rule server-side (digits only, 4-15 chars).

import { en } from "@/i18n/messages/en";
import type { Messages } from "@/i18n/messages/types";

export type TradingAccountCheck = { ok: boolean; message: string };

export function validateTradingAccount(
  value: string,
  /** The reader's copy; English by default (server-side checks, tests). */
  m: Messages["account"] = en.account
): TradingAccountCheck {
  const v = value.trim();
  if (!v) return { ok: false, message: m.errEmpty };
  if (!/^[0-9]{4,15}$/.test(v)) return { ok: false, message: m.errFormat };
  return { ok: true, message: "" };
}
