// fn_submit_deposit raises member-facing messages in English. The deposit form
// shows errors in the member's language, so each message the function can
// raise maps to a key in the dictionary (upgrade.errors). Anything else is
// unexpected: the caller logs it and shows the generic error.

export type DepositErrorKey = "broker" | "account" | "minimum" | "telegram" | "tradingview" | "screenshot" | "waiting";

// In the order fn_submit_deposit checks them (20260915000005_submission_telegram.sql).
const RAISED: readonly (readonly [RegExp, DepositErrorKey])[] = [
  [/choose your broker/i, "broker"],
  [/trading account number/i, "account"],
  [/minimum deposit/i, "minimum"],
  [/telegram username/i, "telegram"],
  [/tradingview username/i, "tradingview"],
  [/screenshot/i, "screenshot"],
  [/waiting for review/i, "waiting"],
];

export function depositErrorKey(dbMessage: string): DepositErrorKey | null {
  return RAISED.find(([pattern]) => pattern.test(dbMessage))?.[1] ?? null;
}
