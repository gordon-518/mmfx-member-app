// Trading account number (MT4/MT5 login) validation — single source of truth for
// the client-side check. The DB function fn_set_trading_account enforces the same
// rule server-side (digits only, 4-15 chars).

export type TradingAccountCheck = { ok: boolean; message: string };

export function validateTradingAccount(value: string): TradingAccountCheck {
  const v = value.trim();
  if (!v) return { ok: false, message: "Enter your trading account number." };
  if (!/^[0-9]{4,15}$/.test(v)) {
    return { ok: false, message: "Use your MT4/MT5 number — 4 to 15 digits, numbers only." };
  }
  return { ok: true, message: "" };
}
