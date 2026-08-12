// TradingView username validation. People routinely paste their EMAIL or their
// TradingView DISPLAY NAME (which can differ from the @username) into the
// indicator/strategy access field — the grant then goes nowhere and they think
// the indicators are broken (see the novamase/"Dcmase" ticket, 2026-08).
//
// We can't prove a handle exists without calling TradingView, but we can catch
// the obvious mistakes (email, spaces, illegal characters) with a hard error,
// and always warn the user to use their @username rather than a display name.
// The DB function fn_set_tradingview_username enforces the same shape server-side.

export type TvUsernameCheck = { ok: boolean; message: string };

export function validateTradingViewUsername(value: string): TvUsernameCheck {
  const v = value.trim();
  if (!v) {
    return { ok: false, message: "Enter your TradingView username." };
  }
  if (v.includes("@")) {
    return {
      ok: false,
      message: "That looks like an email — enter your TradingView username (the @handle), not your email.",
    };
  }
  if (/\s/.test(v)) {
    return {
      ok: false,
      message: "TradingView usernames have no spaces — enter your @username, not your display name.",
    };
  }
  if (!/^[A-Za-z0-9_]{2,30}$/.test(v)) {
    return {
      ok: false,
      message: "Use only letters, numbers and underscores — this is your TradingView username, not your display name.",
    };
  }
  return { ok: true, message: "" };
}

/** Static reminder shown next to the field. */
export const TV_USERNAME_HINT =
  "Use your TradingView username (the @handle), not your display name or email — they're often different. Find it at tradingview.com → your avatar → the @name.";
