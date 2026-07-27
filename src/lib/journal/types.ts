// Shared types for the AI Trading Journal. The reconstruction/metrics layer
// is source-agnostic — MetaApiDeal mirrors the MT5 deal shape MetaApi returns,
// but any feed (e.g. a broker Manager API later) can map into it.

/** Raw MT5 deal as returned by MetaApi's history-deals endpoints. */
export interface MetaApiDeal {
  id: string;
  positionId?: string;
  orderId?: string;
  symbol?: string;
  /** DEAL_TYPE_BUY | DEAL_TYPE_SELL | DEAL_TYPE_BALANCE | ... */
  type: string;
  /** DEAL_ENTRY_IN | DEAL_ENTRY_OUT | DEAL_ENTRY_INOUT | DEAL_ENTRY_OUT_BY */
  entryType?: string;
  volume?: number;
  price?: number;
  profit?: number;
  commission?: number;
  swap?: number;
  /** ISO 8601 */
  time: string;
  brokerTime?: string;
  magic?: number;
  comment?: string;
}

/** A round-trip trade reconstructed from one position's deals. */
export interface ReconstructedTrade {
  positionId: string;
  symbol: string;
  direction: "buy" | "sell";
  status: "open" | "closed";
  /** Total entered volume (sum of entry legs). */
  volume: number;
  /** Volume-weighted average entry price; null if entries fell outside history. */
  openPrice: number | null;
  /** Volume-weighted average exit price; null while open. */
  closePrice: number | null;
  openTime: string | null;
  closeTime: string | null;
  /** Realized so far (open trades show realized partial-close profit). */
  profit: number;
  commission: number;
  swap: number;
  netProfit: number;
  durationSec: number | null;
}

/** Deposit/withdrawal derived from a DEAL_TYPE_BALANCE deal. */
export interface CashFlow {
  dealId: string;
  amount: number;
  time: string;
  comment: string | null;
}

export interface ReconstructionResult {
  trades: ReconstructedTrade[];
  cashFlows: CashFlow[];
}

export type JournalAccountState =
  | "connecting"
  | "deployed"
  | "failed"
  | "disconnected";

/** Row shape of public.journal_accounts (subset the app reads/writes). */
export interface JournalAccountRow {
  id: string;
  user_id: string;
  label: string | null;
  mt5_login: string;
  broker_server: string;
  metaapi_account_id: string | null;
  state: JournalAccountState;
  state_detail: string | null;
  balance: number | null;
  equity: number | null;
  currency: string | null;
  sync_cursor: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
  created_at: string;
  disconnected_at: string | null;
}

/** Row shape of public.journal_trades (subset the UI reads). */
export interface JournalTradeRow {
  id: string;
  account_id: string;
  position_id: string;
  symbol: string;
  direction: "buy" | "sell";
  status: "open" | "closed";
  volume: number;
  open_price: number | null;
  close_price: number | null;
  open_time: string | null;
  close_time: string | null;
  profit: number;
  commission: number;
  swap: number;
  net_profit: number;
  duration_sec: number | null;
  note: string | null;
  tags: string[] | null;
  emotion: string | null;
}

export interface JournalCashFlowRow {
  id: string;
  account_id: string;
  deal_id: string;
  amount: number;
  time: string;
  comment: string | null;
}

/** The per-trade emotions a user can tag (Phase 2 journaling). */
export const JOURNAL_EMOTIONS = [
  "disciplined",
  "confident",
  "calm",
  "uncertain",
  "fomo",
  "revenge",
  "fear",
  "greed",
] as const;

export type JournalEmotion = (typeof JOURNAL_EMOTIONS)[number];

/** One AI-detected habit surfaced in a coaching report. */
export interface CoachHabit {
  kind: "good" | "bad";
  title: string;
  detail: string;
}

export type CoachStatus = "ahead" | "on_track" | "behind" | "at_risk";

/** The structured output the AI coach returns for a report. */
export interface CoachReport {
  summary: string;
  status: CoachStatus;
  habits: CoachHabit[];
  tips: string[];
}

export interface JournalReportRow {
  id: string;
  user_id: string;
  report_date: string;
  status: CoachStatus | null;
  summary: string;
  habits: CoachHabit[];
  tips: string[];
  stats: Record<string, unknown> | null;
  model: string | null;
  gen_count: number;
  created_at: string;
}

export interface JournalGoalsRow {
  user_id: string;
  style: "scalper" | "day" | "swing" | "position" | null;
  account_size: number | null;
  monthly_target_pct: number | null;
  max_drawdown_pct: number | null;
  risk_per_trade_pct: number | null;
  instruments: string[] | null;
  focus_text: string | null;
  updated_at: string;
}

// --- IB attribution ---------------------------------------------------------

export type IbReview = "ok" | "flagged" | "journal_blocked";

export interface IbBrokerRow {
  id: string;
  display_name: string;
  enforcement_mode: "strict" | "monitor";
  parse_config: {
    sheet?: string;
    column: string;
    strip: string[];
    split: boolean;
  };
  allowlist_updated_at: string | null;
}

// --- Discipline rules (Survival Engine Layer 2) -----------------------------

export interface RuleCfg { enabled?: boolean; value?: number; is_pct?: boolean }
export interface SessionRuleCfg { enabled?: boolean; value?: string[] }

export interface JournalRulesConfig {
  max_daily_loss?: RuleCfg;
  max_trades_per_day?: RuleCfg;
  max_consec_losses?: RuleCfg;
  max_lots?: RuleCfg;
  instruments_only?: { enabled?: boolean };
  allowed_sessions?: SessionRuleCfg;
}

export interface JournalRulesRow {
  user_id: string;
  config: JournalRulesConfig;
  updated_at: string;
}

// --- Proactive interventions (Survival Engine Layer 3) ----------------------

export interface JournalInterventionRow {
  id: string;
  user_id: string;
  kind: string;
  episode_key: string;
  channel: string;
  sent_at: string;
}

export interface JournalEmailPrefsRow {
  user_id: string;
  opted_out: boolean;
  unsub_token: string;
  updated_at: string;
}
