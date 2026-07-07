// Demo seeder for the AI Trading Journal.
//
// Populates journal_accounts / journal_deals / journal_trades /
// journal_cash_flows / journal_goals with a realistic ~90-day trade history for
// one user, so the whole /journal experience renders with believable data and
// ZERO external dependency (no MetaApi, no broker). Writes into the exact same
// tables the live MetaApi sync writes to — the UI can't tell the difference.
//
// Usage:  node scripts/seed-journal-demo.mjs [user-email]
//         (defaults to gordon@marketmakersfx.net)
//
// Idempotent: deletes the previous "Demo Account" for that user, then rebuilds.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const email = process.argv[2] || "gordon@marketmakersfx.net";
const password = decodeURIComponent(new URL(env.DATABASE_URL).password);

const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

// --- Trade generation ------------------------------------------------------

const START_BALANCE = 10_000;
const DAYS = 90;
const CLOSED_TRADES = 135;
const OPEN_TRADES = 3;

// Per-symbol config: price, pip value per lot, typical stop distance in price.
const SYMBOLS = [
  { s: "XAUUSD", price: 2400, spread: 120, weight: 5, commPerLot: 7 },
  { s: "EURUSD", price: 1.09, spread: 0.006, weight: 3, commPerLot: 7 },
  { s: "GBPUSD", price: 1.27, spread: 0.008, weight: 2, commPerLot: 7 },
  { s: "US30", price: 39000, spread: 250, weight: 2, commPerLot: 4 },
];
const SYMBOL_POOL = SYMBOLS.flatMap((c) => Array(c.weight).fill(c));

const NOTES = [
  "Clean break of the London high, followed my plan.",
  "Entered on the 15m retest — textbook.",
  "Moved my stop too early, got wicked out. Frustrating.",
  "Revenge traded after the last loss. Should have stopped.",
  "Waited for confirmation, good discipline today.",
  "News spiked against me, respected the stop.",
  "Sized up because I was confident — worked out.",
  "Chased the move, bad entry. Note for next time.",
  "Perfect session alignment, high conviction.",
  "Cut it early out of fear, left money on the table.",
];
const EMOTIONS = [
  "disciplined",
  "confident",
  "calm",
  "uncertain",
  "fomo",
  "revenge",
  "fear",
  "greed",
];
const TAG_POOL = [
  "breakout",
  "reversal",
  "trend",
  "news",
  "london",
  "ny",
  "scalp",
  "swing",
  "a-setup",
  "b-setup",
];

const rnd = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const round = (n, d = 2) => Number(n.toFixed(d));

function sessionHour() {
  // Weighted toward London (7-13) and NY (13-21) UTC.
  const r = Math.random();
  if (r < 0.15) return Math.floor(rnd(0, 7)); // Asian
  if (r < 0.6) return Math.floor(rnd(7, 13)); // London
  return Math.floor(rnd(13, 21)); // New York
}

function buildTrades() {
  const now = Date.now();
  const trades = [];
  for (let i = 0; i < CLOSED_TRADES + OPEN_TRADES; i++) {
    const cfg = pick(SYMBOL_POOL);
    const isOpen = i >= CLOSED_TRADES;
    const dir = Math.random() < 0.5 ? "buy" : "sell";
    const volume = round(
      cfg.s === "US30" ? rnd(0.1, 1) : rnd(0.05, 0.8),
      2
    );

    // Place the open time somewhere in the window, on a weekday, in-session.
    let open = new Date(now - rnd(0, DAYS) * 86_400_000);
    while (open.getUTCDay() === 0 || open.getUTCDay() === 6) {
      open = new Date(open.getTime() - 86_400_000);
    }
    open.setUTCHours(sessionHour(), Math.floor(rnd(0, 60)), 0, 0);

    const openPrice = round(
      cfg.price * (1 + rnd(-0.01, 0.01)),
      cfg.s === "EURUSD" || cfg.s === "GBPUSD" ? 5 : 2
    );

    // Win ~55%; wins average a bit bigger than losses (payoff > 1).
    const isWin = Math.random() < 0.55;
    const rMultiple = isWin ? rnd(0.6, 3.2) : -rnd(0.5, 1.4);
    const riskUsd = rnd(40, 180) * (volume / 0.2);
    const grossProfit = round(rMultiple * riskUsd, 2);

    const commission = -round(volume * cfg.commPerLot, 2);
    const swap = -round(rnd(0, 3), 2);
    const netProfit = round(grossProfit + commission + swap, 2);

    const durationSec = Math.floor(
      rnd(cfg.s === "US30" ? 300 : 900, 6 * 3600)
    );
    const close = isOpen ? null : new Date(open.getTime() + durationSec * 1000);

    // Derive a plausible close price from the gross P&L direction.
    const move = (grossProfit >= 0 ? 1 : -1) * (dir === "buy" ? 1 : -1);
    const closePrice = isOpen
      ? null
      : round(openPrice + move * cfg.spread * rnd(1, 6), 2);

    const annotated = Math.random() < 0.35;
    trades.push({
      positionId: `demo-${i}`,
      symbol: cfg.s,
      direction: dir,
      status: isOpen ? "open" : "closed",
      volume,
      openPrice,
      closePrice,
      openTime: open.toISOString(),
      closeTime: close ? close.toISOString() : null,
      profit: grossProfit,
      commission,
      swap,
      netProfit: isOpen ? 0 : netProfit,
      durationSec: isOpen ? null : durationSec,
      note: annotated ? pick(NOTES) : null,
      tags: annotated
        ? [...new Set([pick(TAG_POOL), pick(TAG_POOL)])]
        : null,
      emotion: annotated ? pick(EMOTIONS) : null,
      commPerLot: cfg.commPerLot,
    });
  }
  return trades;
}

async function main() {
  await client.connect();

  const { rows: users } = await client.query(
    "select id from auth.users where email = $1",
    [email]
  );
  if (users.length === 0) {
    throw new Error(
      `No auth user found for ${email}. Pass an existing account email as the first arg.`
    );
  }
  const userId = users[0].id;

  await client.query("begin");

  // Fresh start: drop any prior demo account (cascades to deals/trades/flows).
  await client.query(
    "delete from public.journal_accounts where user_id = $1 and label = 'Demo Account'",
    [userId]
  );

  const trades = buildTrades();
  const netAll = trades.reduce((s, t) => s + t.netProfit, 0);
  const balance = round(START_BALANCE + netAll, 2);

  const { rows: acctRows } = await client.query(
    `insert into public.journal_accounts
       (user_id, label, mt5_login, broker_server, state, state_detail,
        balance, equity, currency, last_synced_at, sync_cursor)
     values ($1,'Demo Account','5099887','MMFX-Demo','deployed','CONNECTED',
        $2,$2,'USD', now(), now())
     returning id`,
    [userId, balance]
  );
  const accountId = acctRows[0].id;

  // Opening deposit, dated before the earliest trade.
  const earliest = trades.reduce(
    (min, t) => Math.min(min, new Date(t.openTime).getTime()),
    Date.now()
  );
  const depositTime = new Date(earliest - 86_400_000).toISOString();
  await client.query(
    `insert into public.journal_cash_flows (account_id, deal_id, amount, time, comment)
     values ($1, 'demo-deposit', $2, $3, 'Initial deposit')`,
    [accountId, START_BALANCE, depositTime]
  );
  // A mid-period withdrawal for realism.
  await client.query(
    `insert into public.journal_cash_flows (account_id, deal_id, amount, time, comment)
     values ($1, 'demo-wd', -1500, $2, 'Withdrawal')`,
    [accountId, new Date(Date.now() - 20 * 86_400_000).toISOString()]
  );

  // Deals (entry + exit legs) and reconstructed trades.
  for (const t of trades) {
    const inType = t.direction === "buy" ? "DEAL_TYPE_BUY" : "DEAL_TYPE_SELL";
    const outType = t.direction === "buy" ? "DEAL_TYPE_SELL" : "DEAL_TYPE_BUY";

    await client.query(
      `insert into public.journal_deals
         (account_id, deal_id, position_id, symbol, type, entry_type, volume, price,
          profit, commission, swap, time)
       values ($1,$2,$3,$4,$5,'DEAL_ENTRY_IN',$6,$7,0,$8,0,$9)`,
      [
        accountId,
        `${t.positionId}-in`,
        t.positionId,
        t.symbol,
        inType,
        t.volume,
        t.openPrice,
        round(-t.volume * t.commPerLot, 2),
        t.openTime,
      ]
    );
    if (t.status === "closed") {
      await client.query(
        `insert into public.journal_deals
           (account_id, deal_id, position_id, symbol, type, entry_type, volume, price,
            profit, commission, swap, time)
         values ($1,$2,$3,$4,$5,'DEAL_ENTRY_OUT',$6,$7,$8,0,$9,$10)`,
        [
          accountId,
          `${t.positionId}-out`,
          t.positionId,
          t.symbol,
          outType,
          t.volume,
          t.closePrice,
          t.profit,
          t.swap,
          t.closeTime,
        ]
      );
    }

    await client.query(
      `insert into public.journal_trades
         (account_id, user_id, position_id, symbol, direction, status, volume,
          open_price, close_price, open_time, close_time, profit, commission, swap,
          net_profit, duration_sec, note, tags, emotion)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        accountId,
        userId,
        t.positionId,
        t.symbol,
        t.direction,
        t.status,
        t.volume,
        t.openPrice,
        t.closePrice,
        t.openTime,
        t.closeTime,
        t.profit,
        t.commission,
        t.swap,
        t.netProfit,
        t.durationSec,
        t.note,
        t.tags,
        t.emotion,
      ]
    );
  }

  // Goals for this user (benchmark for the AI coach later).
  await client.query(
    `insert into public.journal_goals
       (user_id, style, account_size, monthly_target_pct, max_drawdown_pct,
        risk_per_trade_pct, instruments, focus_text, updated_at)
     values ($1,'day',$2,8,10,1,$3,
        'Stop moving my stop loss early. Trade London and NY only.', now())
     on conflict (user_id) do update set
       style = excluded.style, account_size = excluded.account_size,
       monthly_target_pct = excluded.monthly_target_pct,
       max_drawdown_pct = excluded.max_drawdown_pct,
       risk_per_trade_pct = excluded.risk_per_trade_pct,
       instruments = excluded.instruments, focus_text = excluded.focus_text,
       updated_at = now()`,
    [userId, START_BALANCE, ["XAUUSD", "EURUSD", "GBPUSD", "US30"]]
  );

  await client.query("commit");

  const closed = trades.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => t.netProfit > 0).length;
  console.log(`✔ Seeded demo journal for ${email}`);
  console.log(
    `  account ${accountId} · balance $${balance} · ${closed.length} closed + ${OPEN_TRADES} open`
  );
  console.log(
    `  net P&L $${round(netAll, 2)} · win rate ${Math.round(
      (wins / closed.length) * 100
    )}%`
  );
  console.log(`  → open /journal while signed in as ${email}`);
}

main()
  .catch(async (e) => {
    await client.query("rollback").catch(() => {});
    console.error("FAILED:", e.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
