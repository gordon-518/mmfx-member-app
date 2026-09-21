// The admin's "new deposit submission" alert (conversion-fix 5.3).
//
// One builder, two channels (17 Sep): a Telegram message to the alert bot and
// an email, so a silent Telegram failure can't hide a waiting deposit. The
// trading account number is in both, including the email subject, so Gordon
// can check the broker's back office straight from the alert.

export interface DepositAlertInput {
  email: string;
  amount: number;
  broker: string;
  /** The member's trading account number at the broker. */
  account: string;
  tradingview: string | null;
  /** Telegram @handle, without the @. */
  telegram: string;
  /** The MM-XXXXXX code the member puts in their DM to Admin Amelia. */
  ref: string;
}

export interface DepositAlert {
  subject: string;
  /** Telegram HTML (parse_mode HTML). */
  html: string;
  /** Plain text, for the email body. */
  text: string;
}

const ADMIN_URL = "https://app.marketmakersfx.net/admin";

function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The three characters Telegram treats as special inside HTML text. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildDepositAlert(v: DepositAlertInput): DepositAlert {
  const subject = `New deposit: ${usd(v.amount)} · ${v.broker} · account ${v.account}`;

  const text = [
    v.email,
    `Amount: ${usd(v.amount)}`,
    `Broker: ${v.broker}`,
    `Trading account: ${v.account}`,
    `Telegram: @${v.telegram} · ref ${v.ref}`,
    v.tradingview ? `TradingView: @${v.tradingview}` : null,
    `Review: ${ADMIN_URL}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const html = [
    "💰 <b>New deposit submission</b>",
    `${esc(v.email)}: <b>${esc(usd(v.amount))}</b> · ${esc(v.broker)}`,
    `Trading account: <code>${esc(v.account)}</code>`,
    `Telegram: @${esc(v.telegram)} · ref <code>${esc(v.ref)}</code>`,
    v.tradingview ? `TradingView: @${esc(v.tradingview)}` : null,
    `Review: ${ADMIN_URL}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return { subject, html, text };
}
