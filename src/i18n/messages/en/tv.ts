// The TradingView access block on /indicators and /strategies, and the
// username errors (by code: the actions redirect with ?tv_error=<code>).
export const tv = {
  grantedBadge: "Access granted · automated",
  grantedBody: "Access has been automatically granted to {username} on TradingView. You should see {what} available in your account within 1–3 hours.",
  updatePlaceholder: "update username",
  update: "Update",
  request: "Request access",
  usernamePlaceholder: "your TradingView username",
  hint: "Use your TradingView username (the @handle), not your display name or email — they're often different. Find it at tradingview.com → your avatar → the @name.",
  errors: {
    empty: "Enter your TradingView username.",
    email: "That looks like an email — enter your TradingView username (the @handle), not your email.",
    spaces: "TradingView usernames have no spaces — enter your @username, not your display name.",
    chars: "Use only letters, numbers and underscores — this is your TradingView username, not your display name.",
    generic: "That username couldn't be saved. Check it and try again.",
  },
} as const;
