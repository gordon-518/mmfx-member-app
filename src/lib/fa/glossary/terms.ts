// The Fundamental Desk's term explainers (Gordon, 4 Nov): the jargon the desk
// writes with, each with a plain-language "what it means" and "how it moves"
// this instrument. Pure data — safe on the server and in tests.
//
// The list comes from counting what the desk actually wrote across all 11
// live theses on 4 Nov (EMA 99×, DXY 65×, H4 51×, yields 45×, D1 36×, VIX 29×,
// real yield 25×, risk-off 19×…), not from a textbook. A term earns a place
// by being something members meet in the theses and can't be expected to know.
//
// The desk writes in English, so the patterns are English; the explanations
// are in the reader's language (content/<locale>.ts).

import type { AssetClass } from "../types";

export const TERM_IDS = [
  // The dollar and interest rates
  "dxy",
  "realYield",
  "treasuryYield",
  "fed",
  "rateCut",
  "rateHike",
  "hawkish",
  "dovish",
  "policyGap",
  "carryTrade",
  "basisPoints",
  // Other central banks
  "ecb",
  "boe",
  "boj",
  "snb",
  "rba",
  "rbnz",
  "boc",
  // Economic data
  "inflation",
  "cpi",
  "jobsReport",
  "pmi",
  // Risk mood and other markets
  "vix",
  "riskOff",
  "riskOn",
  "safeHaven",
  "equities",
  "oil",
  "geopolitics",
  "election",
  // Money flows and positioning
  "etfFlows",
  "structuralBid",
  "positioning",
  // Metals
  "goldSilverRatio",
  "copper",
  "wgc",
  "centralBankBuying",
  // Crypto
  "btcDominance",
  "fundingRate",
  // Charts and the desk's own vocabulary
  "ema",
  "timeframe",
  "supportResistance",
  "breakout",
  "invalidation",
  "conviction",
  "regime",
  "tactical",
] as const;

export type TermId = (typeof TERM_IDS)[number];

/**
 * Which way a dollar-driven term moves an instrument. A stronger dollar pushes
 * EUR/USD down but USD/JPY up, so "how it moves" can't be written once:
 *   metal       XAU/USD, XAG/USD — priced in dollars
 *   fxUsdQuote  EUR/USD, GBP/USD, AUD/USD, NZD/USD — the dollar is second
 *   fxUsdBase   USD/JPY, USD/CHF, USD/CAD — the dollar is first
 *   crypto      BTC/USD, ETH/USD
 */
export const MOVE_KEYS = ["metal", "fxUsdQuote", "fxUsdBase", "crypto"] as const;
export type MoveKey = (typeof MOVE_KEYS)[number];

export interface TermDef {
  id: TermId;
  /** Matched against the desk's English text. Acronyms stay case-sensitive. */
  patterns: RegExp[];
  /** Only underlined on these asset classes (e.g. BTC dominance on crypto). */
  scope?: AssetClass[];
  /** True when "how it moves" differs per MoveKey; false = one text fits all. */
  perAsset: boolean;
}

const b = (src: string, flags = "") => new RegExp(`\\b(?:${src})\\b`, flags);

export const TERMS: Record<TermId, TermDef> = {
  dxy: { id: "dxy", patterns: [b("DXY"), b("dollar index", "i")], perAsset: true },
  // "US 10y real yield" is one idea: the longer match wins over "10y".
  realYield: { id: "realYield", patterns: [b("(?:US\\s+)?(?:10y\\s+)?real yields?", "i")], perAsset: true },
  treasuryYield: {
    id: "treasuryYield",
    patterns: [b("(?:US\\s+)?(?:10|2|30)y(?:\\s+yields?)?", "i"), b("(?:10|2|30)-year(?:\\s+yields?)?", "i"), b("Treasury yields?", "i")],
    perAsset: true,
  },
  fed: { id: "fed", patterns: [b("Fed"), b("FOMC"), b("Federal Reserve")], perAsset: true },
  rateCut: { id: "rateCut", patterns: [b("rate cuts?", "i"), b("cut(?:ting)? cycle", "i"), b("easing cycle", "i")], perAsset: true },
  rateHike: { id: "rateHike", patterns: [b("rate hikes?", "i"), b("hiking cycle", "i"), b("tightening cycle", "i")], perAsset: true },
  hawkish: { id: "hawkish", patterns: [b("hawkish(?:ness)?", "i"), b("hawks?", "i")], perAsset: false },
  dovish: { id: "dovish", patterns: [b("dovish(?:ness)?", "i"), b("doves?", "i")], perAsset: false },
  policyGap: {
    id: "policyGap",
    patterns: [b("(?:policy|rate|yield|interest[- ]rate) (?:gap|differentials?|spread)s?", "i")],
    perAsset: false,
  },
  carryTrade: { id: "carryTrade", patterns: [b("carry(?: trades?)?", "i")], perAsset: false },
  basisPoints: { id: "basisPoints", patterns: [new RegExp("\\b\\d+(?:\\.\\d+)?\\s?bps?\\b"), b("basis points?", "i")], perAsset: false },

  ecb: { id: "ecb", patterns: [b("ECB"), b("European Central Bank")], perAsset: false },
  boe: { id: "boe", patterns: [b("BoE"), b("Bank of England")], perAsset: false },
  boj: { id: "boj", patterns: [b("BoJ"), b("BOJ"), b("Bank of Japan")], perAsset: false },
  snb: { id: "snb", patterns: [b("SNB"), b("Swiss National Bank")], perAsset: false },
  rba: { id: "rba", patterns: [b("RBA"), b("Reserve Bank of Australia")], perAsset: false },
  rbnz: { id: "rbnz", patterns: [b("RBNZ"), b("Reserve Bank of New Zealand")], perAsset: false },
  boc: { id: "boc", patterns: [b("BoC"), b("BOC"), b("Bank of Canada")], perAsset: false },

  inflation: { id: "inflation", patterns: [b("inflation(?:ary)?", "i")], perAsset: false },
  cpi: { id: "cpi", patterns: [b("(?:core\\s+)?CPI"), b("PCE"), b("consumer price index", "i")], perAsset: false },
  jobsReport: {
    id: "jobsReport",
    patterns: [b("NFP"), b("ADP"), b("non-?farm(?: payrolls?| employment)?", "i"), b("payrolls?", "i"), b("jobless claims", "i")],
    perAsset: true,
  },
  pmi: { id: "pmi", patterns: [b("PMIs?"), b("ISM")], perAsset: false },

  vix: { id: "vix", patterns: [b("VIX")], perAsset: false },
  riskOff: { id: "riskOff", patterns: [b("risk-?off", "i")], perAsset: false },
  riskOn: { id: "riskOn", patterns: [b("risk-?on", "i"), b("risk appetite", "i")], perAsset: false },
  safeHaven: { id: "safeHaven", patterns: [b("safe[- ]havens?", "i")], perAsset: false },
  equities: { id: "equities", patterns: [b("SPX"), b("S&P(?: 500)?"), b("Nasdaq")], perAsset: false },
  oil: { id: "oil", patterns: [b("Brent(?: crude)?"), b("WTI"), b("crude(?: oil)?", "i")], perAsset: false },
  geopolitics: { id: "geopolitics", patterns: [b("geopolitic(?:al|s)", "i")], perAsset: false },
  election: { id: "election", patterns: [b("midterms?", "i"), b("elections?", "i")], perAsset: false },

  etfFlows: { id: "etfFlows", patterns: [b("ETF (?:in|out)flows?", "i"), b("ETFs?")], scope: ["metal", "crypto"], perAsset: false },
  structuralBid: { id: "structuralBid", patterns: [b("structural bid", "i")], perAsset: false },
  positioning: { id: "positioning", patterns: [b("COT"), b("positioning", "i"), b("crowded (?:longs|shorts|trades?)", "i")], perAsset: false },

  goldSilverRatio: { id: "goldSilverRatio", patterns: [b("gold[/-]silver ratio", "i")], scope: ["metal"], perAsset: false },
  copper: { id: "copper", patterns: [b("copper", "i")], scope: ["metal"], perAsset: false },
  wgc: { id: "wgc", patterns: [b("WGC"), b("World Gold Council")], scope: ["metal"], perAsset: false },
  centralBankBuying: {
    id: "centralBankBuying",
    patterns: [b("central[- ]bank (?:buying|purchases|demand|gold buying)", "i")],
    scope: ["metal"],
    perAsset: false,
  },

  btcDominance: { id: "btcDominance", patterns: [b("(?:BTC |bitcoin )?dominance", "i")], scope: ["crypto"], perAsset: false },
  fundingRate: { id: "fundingRate", patterns: [b("funding(?: rates?)?", "i")], scope: ["crypto"], perAsset: false },

  ema: { id: "ema", patterns: [b("EMAs?"), b("moving averages?", "i")], perAsset: false },
  timeframe: { id: "timeframe", patterns: [b("H1"), b("H4"), b("D1"), b("W1")], perAsset: false },
  supportResistance: { id: "supportResistance", patterns: [b("resistance", "i"), b("support (?:levels?|zones?)", "i")], perAsset: false },
  breakout: { id: "breakout", patterns: [b("break(?:out|down)s?", "i")], perAsset: false },
  invalidation: { id: "invalidation", patterns: [b("invalidat(?:e[sd]?|ion|ing)", "i")], perAsset: false },
  conviction: { id: "conviction", patterns: [b("conviction", "i")], perAsset: false },
  regime: { id: "regime", patterns: [b("regime", "i")], perAsset: false },
  tactical: { id: "tactical", patterns: [b("tactical", "i")], perAsset: false },
};
