// TradingView username validation. People routinely paste their EMAIL or their
// TradingView DISPLAY NAME (which can differ from the @username) into the
// indicator/strategy access field — the grant then goes nowhere and they think
// the indicators are broken (see the novamase/"Dcmase" ticket, 2026-08).
//
// We can't prove a handle exists without calling TradingView, but we can catch
// the obvious mistakes (email, spaces, illegal characters) with a hard error,
// and always warn the user to use their @username rather than a display name.
// The DB function fn_set_tradingview_username enforces the same shape server-side.

import { en } from "@/i18n/messages/en";
import type { Messages } from "@/i18n/messages/types";

/** Why a username was refused. The actions redirect with ?tv_error=<code>, and
 *  the page shows the message in the reader's language. */
export type TvErrorCode = keyof Messages["tv"]["errors"];

export type TvUsernameCheck = { ok: true; code: null; message: "" } | { ok: false; code: TvErrorCode; message: string };

export function validateTradingViewUsername(value: string, e: Messages["tv"]["errors"] = en.tv.errors): TvUsernameCheck {
  const v = value.trim();
  const fail = (code: TvErrorCode): TvUsernameCheck => ({ ok: false, code, message: e[code] });
  if (!v) return fail("empty");
  if (v.includes("@")) return fail("email");
  if (/\s/.test(v)) return fail("spaces");
  if (!/^[A-Za-z0-9_]{2,30}$/.test(v)) return fail("chars");
  return { ok: true, code: null, message: "" };
}

/** fn_set_tradingview_username raises the same checks in English; read them back as codes. */
export function tvErrorCodeFromDb(dbMessage: string): TvErrorCode {
  if (/cannot be empty/i.test(dbMessage)) return "empty";
  if (/looks like an email/i.test(dbMessage)) return "email";
  if (/letters, numbers and underscores/i.test(dbMessage)) return "chars";
  return "generic";
}

/** The message for a ?tv_error= value; anything unrecognised reads as generic. */
export function tvErrorMessage(code: string | null, e: Messages["tv"]["errors"]): string | null {
  if (!code) return null;
  return code in e ? e[code as TvErrorCode] : e.generic;
}
