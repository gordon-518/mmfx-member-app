import type { GlossaryContent } from "../types";

// English explainers — the source the other languages are translated from.
// Written for someone with no economics background: what the thing is, then
// which way it usually pushes {asset}. "Usually" and "tends to" on purpose —
// these are tendencies, not rules, and never a reason to trade on their own.

export const glossaryEn: GlossaryContent = {
  dxy: {
    name: "DXY (US dollar index)",
    what: "A single number for how strong the US dollar is against a basket of other major currencies. Up means the dollar is getting stronger; down means weaker.",
    moves: {
      metal: "{asset} is priced in dollars, so a stronger dollar usually weighs on it and a weaker dollar usually helps it.",
      fxUsdQuote: "The dollar is the second currency in {asset}, so a stronger dollar usually pushes {asset} down and a weaker dollar pushes it up.",
      fxUsdBase: "The dollar is the first currency in {asset}, so a stronger dollar usually pushes {asset} up and a weaker dollar pushes it down.",
      crypto: "{asset} is priced in dollars, so a weaker dollar often helps it, though crypto follows the general mood of markets more closely than the dollar.",
    },
  },
  realYield: {
    name: "Real yield",
    what: "The interest a US government bond pays after taking inflation out. It's the 'true' reward for holding safe dollar savings.",
    moves: {
      metal: "{asset} pays no interest, so when real yields rise, holding it costs more in missed interest and it usually struggles. Falling real yields usually help it.",
      fxUsdQuote: "Higher real yields make dollar savings more attractive, which tends to strengthen the dollar and push {asset} down.",
      fxUsdBase: "Higher real yields make dollar savings more attractive, which tends to strengthen the dollar and push {asset} up.",
      crypto: "Higher real yields make safe savings more attractive than riskier assets, which tends to weigh on {asset}.",
    },
  },
  treasuryYield: {
    name: "Treasury yield (US 2y, 10y, 30y)",
    what: "The interest rate the US government pays to borrow for 2, 10 or 30 years. Markets watch it as the going rate for dollar savings.",
    moves: {
      metal: "Rising yields make interest-paying savings more attractive than {asset}, which pays nothing, so they usually weigh on it.",
      fxUsdQuote: "Rising US yields tend to attract money into the dollar, which pushes {asset} down.",
      fxUsdBase: "Rising US yields tend to attract money into the dollar, which pushes {asset} up.",
      crypto: "Rising yields tend to pull money away from riskier assets like {asset}.",
    },
  },
  fed: {
    name: "The Fed (US Federal Reserve)",
    what: "America's central bank. It sets US interest rates, and its decisions and speeches move the dollar more than almost anything else.",
    moves: {
      metal: "When the Fed leans towards cutting rates, the dollar and yields usually soften, which tends to help {asset}. Talk of higher rates usually weighs on it.",
      fxUsdQuote: "When the Fed leans towards higher rates, the dollar usually strengthens and {asset} falls; when it leans towards cuts, {asset} tends to rise.",
      fxUsdBase: "When the Fed leans towards higher rates, the dollar usually strengthens and {asset} rises; when it leans towards cuts, {asset} tends to fall.",
      crypto: "Easier Fed policy (lower rates) has tended to help {asset}; tighter policy has tended to weigh on it.",
    },
  },
  rateCut: {
    name: "Rate cut",
    what: "When a central bank lowers its interest rate. Borrowing gets cheaper and savings in that currency pay less.",
    moves: {
      metal: "A US rate cut usually means a softer dollar and lower yields, which tends to help {asset}.",
      fxUsdQuote: "A US rate cut usually weakens the dollar, which tends to lift {asset}. A cut by the other central bank in the pair does the opposite.",
      fxUsdBase: "A US rate cut usually weakens the dollar, which tends to push {asset} down. A cut by the other central bank in the pair does the opposite.",
      crypto: "Rate cuts make borrowing cheaper and tend to put investors in a mood for riskier assets like {asset}.",
    },
  },
  rateHike: {
    name: "Rate hike",
    what: "When a central bank raises its interest rate, usually to cool inflation. Borrowing gets dearer and savings in that currency pay more.",
    moves: {
      metal: "A US rate hike usually strengthens the dollar and lifts yields, which tends to weigh on {asset}.",
      fxUsdQuote: "A US rate hike usually strengthens the dollar, which tends to push {asset} down. A hike by the other central bank in the pair does the opposite.",
      fxUsdBase: "A US rate hike usually strengthens the dollar, which tends to push {asset} up. A hike by the other central bank in the pair does the opposite.",
      crypto: "Rate hikes make money tighter and tend to cool demand for riskier assets like {asset}.",
    },
  },
  hawkish: {
    name: "Hawkish",
    what: "A central bank (or one of its officials) leaning towards higher interest rates to fight inflation. The opposite is dovish.",
    moves: "A hawkish tone usually strengthens that bank's currency. For {asset}, it depends which side of the trade that currency is on.",
  },
  dovish: {
    name: "Dovish",
    what: "A central bank leaning towards lower interest rates to support growth and jobs. The opposite is hawkish.",
    moves: "A dovish tone usually weakens that bank's currency. For {asset}, it depends which side of the trade that currency is on.",
  },
  policyGap: {
    name: "Rate gap (policy divergence)",
    what: "The difference between two countries' interest rates. Money tends to drift towards the currency that pays more interest.",
    moves: "When the gap widens in favour of one currency in {asset}, that currency tends to strengthen against the other.",
  },
  carryTrade: {
    name: "Carry trade",
    what: "Borrowing in a currency with low interest rates to hold one with higher rates, collecting the difference. Popular with big funds when markets are calm.",
    moves: "Carry trades tend to keep low-rate currencies (like the yen or franc) weak while markets are calm, and can unwind sharply when fear rises — the low-rate currency then jumps.",
  },
  basisPoints: {
    name: "Basis points (bp)",
    what: "A way of measuring small moves in interest rates. 100 basis points = 1%, so a 25bp cut lowers a rate by a quarter of a percent.",
    moves: "The bigger the move in basis points, the bigger the change in interest rates the market has to react to.",
  },

  ecb: {
    name: "ECB (European Central Bank)",
    what: "The central bank for the euro. It sets interest rates for the 20 countries that use it.",
    moves: "A more hawkish ECB tends to lift the euro; a more dovish one tends to weigh on it.",
  },
  boe: {
    name: "BoE (Bank of England)",
    what: "The UK's central bank. It sets interest rates for the pound.",
    moves: "A more hawkish BoE tends to lift the pound; a more dovish one tends to weigh on it.",
  },
  boj: {
    name: "BoJ (Bank of Japan)",
    what: "Japan's central bank. It has kept rates very low for years, so any hint of raising them gets a lot of attention.",
    moves: "Signs the BoJ will raise rates tend to strengthen the yen; signs it will stay put tend to keep the yen weak.",
  },
  snb: {
    name: "SNB (Swiss National Bank)",
    what: "Switzerland's central bank. It sets rates for the franc and sometimes steps into markets to stop the franc getting too strong.",
    moves: "A more hawkish SNB tends to lift the franc; a dovish one, or talk of stepping in to weaken it, tends to weigh on it.",
  },
  rba: {
    name: "RBA (Reserve Bank of Australia)",
    what: "Australia's central bank. It sets interest rates for the Australian dollar.",
    moves: "A more hawkish RBA tends to lift the Australian dollar; a more dovish one tends to weigh on it.",
  },
  rbnz: {
    name: "RBNZ (Reserve Bank of New Zealand)",
    what: "New Zealand's central bank. It sets interest rates for the New Zealand dollar.",
    moves: "A more hawkish RBNZ tends to lift the New Zealand dollar; a more dovish one tends to weigh on it.",
  },
  boc: {
    name: "BoC (Bank of Canada)",
    what: "Canada's central bank. It sets interest rates for the Canadian dollar.",
    moves: "A more hawkish BoC tends to lift the Canadian dollar; a more dovish one tends to weigh on it.",
  },

  inflation: {
    name: "Inflation",
    what: "How fast prices are rising across the economy. Central banks raise rates when it runs too hot and cut when it cools.",
    moves: "Hotter-than-expected inflation usually means higher rates for longer, which tends to strengthen that country's currency. Gold is also seen as a long-term shelter from rising prices.",
  },
  cpi: {
    name: "CPI / PCE (inflation reports)",
    what: "Monthly reports on how much prices rose. CPI is the headline measure; PCE is the one the Fed prefers. 'Core' leaves out food and energy, which jump around.",
    moves: "A hot reading usually lifts the currency as markets expect higher rates; a soft reading usually weakens it. These releases often cause sharp moves.",
  },
  jobsReport: {
    name: "Jobs report (NFP, ADP, jobless claims)",
    what: "Data on how many jobs the US economy added. NFP (non-farm payrolls) is the big monthly one; ADP and weekly jobless claims are earlier clues.",
    moves: {
      metal: "Strong jobs data usually lifts the dollar and yields, which tends to weigh on {asset}. Weak data tends to help it.",
      fxUsdQuote: "Strong jobs data usually lifts the dollar, which tends to push {asset} down. Weak data tends to lift it.",
      fxUsdBase: "Strong jobs data usually lifts the dollar, which tends to push {asset} up. Weak data tends to push it down.",
      crypto: "Weak jobs data can raise hopes of rate cuts, which has tended to help {asset}, unless it sparks wider fear about the economy.",
    },
  },
  pmi: {
    name: "PMI / ISM (business surveys)",
    what: "Monthly surveys asking businesses whether activity is growing or shrinking. Above 50 means growing; below 50 means shrinking.",
    moves: "Strong surveys tend to support a country's currency; weak ones tend to weigh on it.",
  },

  vix: {
    name: "VIX (the 'fear gauge')",
    what: "A measure of how nervous the US stock market is, based on what investors pay to protect themselves. Under about 15 is calm; above 25 is fearful.",
    moves: "A rising VIX usually means money is moving to safety: gold, the yen, the franc and the dollar tend to gain, while risk-sensitive currencies and crypto tend to fall.",
  },
  riskOff: {
    name: "Risk-off",
    what: "A market mood where investors get nervous and move money out of riskier assets into safer ones.",
    moves: "In risk-off moods, safe havens like gold, the yen, the franc and often the dollar tend to rise; the Australian and New Zealand dollars and crypto tend to fall.",
  },
  riskOn: {
    name: "Risk-on",
    what: "A market mood where investors feel confident and are happy to own riskier assets like stocks and crypto.",
    moves: "In risk-on moods, stocks, crypto and the Australian and New Zealand dollars tend to rise; safe havens like the yen and franc tend to lag.",
  },
  safeHaven: {
    name: "Safe haven",
    what: "An asset people rush to when they're scared — traditionally gold, the Japanese yen, the Swiss franc and US government bonds.",
    moves: "Safe havens tend to rise when fear rises, even when other reasons point the other way.",
  },
  equities: {
    name: "Stock markets (S&P 500, Nasdaq)",
    what: "The main US stock indexes. The desk watches them as a read on how confident investors feel.",
    moves: "Rising stocks usually signal a confident, risk-on mood; falling stocks a nervous, risk-off one.",
  },
  oil: {
    name: "Oil (Brent, WTI)",
    what: "The two benchmark prices for crude oil. Oil feeds into inflation and matters a lot for oil-exporting countries like Canada.",
    moves: "Rising oil tends to support the Canadian dollar and can push inflation up, which affects how central banks think about rates.",
  },
  geopolitics: {
    name: "Geopolitical risk",
    what: "Wars, conflicts, sanctions and tensions between countries that can unsettle markets.",
    moves: "Rising tensions usually push money towards safe havens like gold, the yen and the franc.",
  },
  election: {
    name: "Elections (incl. US midterms)",
    what: "Votes that can change a government's spending, tax and trade plans. US midterms decide control of Congress halfway through a president's term.",
    moves: "Markets move on what an election result means for future spending, debt and rates — the surprise matters more than the result itself.",
  },

  etfFlows: {
    name: "ETF flows",
    what: "Money going into or out of exchange-traded funds that hold the asset for investors. It's a read on how much real demand there is.",
    moves: "Steady money flowing into {asset} funds tends to support its price; money flowing out tends to weigh on it.",
  },
  structuralBid: {
    name: "Structural bid",
    what: "Steady, long-term buying that doesn't depend on day-to-day news — for example, central banks adding to their reserves year after year.",
    moves: "A structural bid tends to cushion {asset} on dips, even when shorter-term drivers point the other way.",
  },
  positioning: {
    name: "Positioning (COT)",
    what: "How heavily big traders are already betting one way. The COT report shows this weekly for futures markets.",
    moves: "When a trade gets very crowded, there are fewer new buyers or sellers left, and any surprise can cause a sharp move the other way.",
  },

  goldSilverRatio: {
    name: "Gold/silver ratio",
    what: "How many ounces of silver it takes to buy one ounce of gold. It shows whether silver is cheap or dear compared with gold.",
    moves: "A falling ratio means silver is outpacing gold; a rising ratio means gold is outpacing silver.",
  },
  copper: {
    name: "Copper",
    what: "An industrial metal used in building and electronics, often watched as a sign of how strong the global economy is.",
    moves: "Silver is partly an industrial metal, so strong copper often goes with stronger silver demand.",
  },
  wgc: {
    name: "WGC (World Gold Council)",
    what: "The gold industry's market research body. It publishes data on who is buying gold — central banks, funds and jewellery buyers.",
    moves: "Its reports show whether demand for {asset} is growing or fading.",
  },
  centralBankBuying: {
    name: "Central bank gold buying",
    what: "Central banks around the world adding gold to their reserves, often to rely less on the US dollar.",
    moves: "Steady central bank buying has been one of the biggest long-term supports under {asset}.",
  },

  btcDominance: {
    name: "Bitcoin dominance",
    what: "Bitcoin's share of the total value of all cryptocurrencies.",
    moves: "Rising dominance means money is favouring bitcoin over other coins; falling dominance means it's spreading into coins like ether.",
  },
  fundingRate: {
    name: "Funding rate",
    what: "A small fee traders pay each other to keep leveraged crypto bets open. Positive means more traders are betting on a rise.",
    moves: "Very high funding means the market is crowded on one side, which can lead to sharp moves the other way when those bets are forced to close.",
  },

  ema: {
    name: "EMA (moving average)",
    what: "A line on the chart showing the average price over recent candles, weighted towards the latest ones. The desk uses the 50 EMA to judge the trend.",
    moves: "Price above the line suggests the recent trend is up; below it suggests the trend is down. 'Reclaiming' the line means price has climbed back above it.",
  },
  timeframe: {
    name: "Chart timeframes (H1, H4, D1)",
    what: "How much time each candle on the chart covers: H1 = 1 hour, H4 = 4 hours, D1 = 1 day, W1 = 1 week.",
    moves: "Longer timeframes show the bigger trend; shorter ones show the moves within it.",
  },
  supportResistance: {
    name: "Support and resistance",
    what: "Price areas where buying (support, below) or selling (resistance, above) has stepped in before.",
    moves: "Price often pauses or turns at these areas. A clean move through one can change the picture.",
  },
  breakout: {
    name: "Breakout / breakdown",
    what: "When price moves decisively through a level it had been stuck under (breakout) or above (breakdown).",
    moves: "A breakout that holds often leads to further movement in that direction; one that quickly reverses is called a false break.",
  },
  invalidation: {
    name: "Invalidation",
    what: "The point where the desk's view would be proven wrong — a price level or an event that would make it drop or rethink the thesis.",
    moves: "If price crosses an invalidation level, the desk's current view on {asset} no longer stands.",
  },
  conviction: {
    name: "Conviction",
    what: "How strongly the desk holds its view, based on how many of the main drivers agree.",
    moves: "High conviction means the drivers line up; low conviction means they're mixed and the picture could change quickly.",
  },
  regime: {
    name: "Regime",
    what: "The bigger backdrop driving markets right now — for example, 'rates are falling' or 'investors are nervous'. It can last weeks or months.",
    moves: "The regime decides which news matters most for {asset}; when it shifts, the usual reactions can flip.",
  },
  tactical: {
    name: "Tactical",
    what: "A short-term view, for the next hours or days, rather than the bigger picture.",
    moves: "A tactical view can point one way while the longer-term picture points the other.",
  },
};
