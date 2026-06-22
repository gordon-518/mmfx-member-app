import "server-only";

// Gold/macro news via forexnewsapi.com. The token lives ONLY in the server
// env (FOREXNEWSAPI_TOKEN) — never shipped to the client. One cached fetch
// serves all members (revalidate window below) so we don't burn the call quota.
//
// CONFIRM with Gordon's working request: the `topic`/`items`/`type` params and
// base path below are the documented forexnewsapi shape; adjust NEWS_QUERY if
// his exact URL differs. Response shape is taken from a real API response.

export type Sentiment = "Positive" | "Negative" | "Neutral";

export interface NewsItem {
  url: string;
  title: string;
  text: string;
  source: string;
  date: string; // RFC-2822 string from the API
  topics: string[];
  sentiment: Sentiment;
  type: "Article" | "Video";
  image: string; // API image_url — mostly generic forex placeholders
}

const REVALIDATE_SECONDS = 1800; // 30 min — fresh enough, quota-friendly
// Filterable assets. "All" (empty value) hits the general feed (every pair +
// commodities); a specific value hits that currencypair. Verified symbols
// against the live API 2026-06-16. This list is the allowlist — only these are
// ever passed to the API URL (no arbitrary searchParam reaches the request).
export const NEWS_PAIRS = [
  { label: "All", value: "" },
  { label: "Gold", value: "XAU-USD" },
  { label: "Silver", value: "XAG-USD" },
  { label: "EUR/USD", value: "EUR-USD" },
  { label: "GBP/USD", value: "GBP-USD" },
  { label: "USD/JPY", value: "USD-JPY" },
  { label: "AUD/USD", value: "AUD-USD" },
  { label: "USD/CAD", value: "USD-CAD" },
  { label: "USD/CHF", value: "USD-CHF" },
  { label: "NZD/USD", value: "NZD-USD" },
  { label: "EUR/GBP", value: "EUR-GBP" },
  { label: "EUR/JPY", value: "EUR-JPY" },
  { label: "GBP/JPY", value: "GBP-JPY" },
  { label: "AUD/JPY", value: "AUD-JPY" },
  { label: "EUR/AUD", value: "EUR-AUD" },
  { label: "EUR/CHF", value: "EUR-CHF" },
  { label: "GBP/CHF", value: "GBP-CHF" },
  { label: "CAD/JPY", value: "CAD-JPY" },
  { label: "NZD/JPY", value: "NZD-JPY" },
] as const;

const VALID_PAIRS = new Set<string>(NEWS_PAIRS.map((p) => p.value).filter(Boolean));

function newsUrl(pair: string | undefined, token: string): string {
  const base = "https://forexnewsapi.com/api/v1";
  if (pair && VALID_PAIRS.has(pair)) {
    return `${base}?currencypair=${encodeURIComponent(pair)}&items=40&type=article&token=${token}`;
  }
  // General feed — all forex pairs + commodities, newest first.
  return `${base}/category?section=general&items=40&token=${token}`;
}

interface ApiItem {
  news_url?: string;
  title?: string;
  text?: string;
  source_name?: string;
  date?: string;
  topics?: string[];
  sentiment?: string;
  type?: string;
  image_url?: string;
}

function normalize(raw: ApiItem): NewsItem | null {
  if (!raw.news_url || !raw.title) return null;
  const s = raw.sentiment;
  const sentiment: Sentiment =
    s === "Positive" || s === "Negative" ? s : "Neutral";
  return {
    url: raw.news_url,
    title: raw.title,
    text: raw.text ?? "",
    source: raw.source_name ?? "",
    date: raw.date ?? "",
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    sentiment,
    type: raw.type === "Video" ? "Video" : "Article",
    image: raw.image_url ?? "",
  };
}

export async function getNews(pair?: string): Promise<NewsItem[]> {
  const token = process.env.FOREXNEWSAPI_TOKEN;

  // No token yet: show the sample layout in dev; empty in prod (fail safe).
  if (!token) {
    return process.env.NODE_ENV === "development" ? SAMPLE_NEWS : [];
  }

  try {
    const res = await fetch(newsUrl(pair, token), {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: ApiItem[] };
    const data = Array.isArray(json.data) ? json.data : [];
    return data.map(normalize).filter((n): n is NewsItem => n !== null);
  } catch {
    return [];
  }
}

// ── Economic calendar ───────────────────────────────────────────────────
// forexnewsapi's economic-calendar endpoint. We pull the next 7 days of
// High+Medium-impact events (the market-movers — CPI, rate decisions, NFP).
// The API returns newest-first and caps at 50, so a 7-day High/Medium window
// (~20 events) is fully covered; we sort ascending for a real calendar.

export type Impact = "High" | "Medium" | "Low";

export interface CalEvent {
  event: string;
  country: string;
  currency: string;
  date: string; // RFC-2822
  importance: Impact;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

interface ApiCalItem {
  event_name?: string;
  country?: string;
  currency?: string;
  date?: string;
  importance?: string;
  actual?: string | number | null;
  forecast?: string | number | null;
  previous?: string | number | null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
// The `date` param wants MMDDYYYY.
const mmddyyyy = (d: Date) => `${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}${d.getUTCFullYear()}`;

function toStr(v: string | number | null | undefined): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}

function normalizeCal(raw: ApiCalItem): CalEvent | null {
  if (!raw.event_name || !raw.date) return null;
  const imp = raw.importance;
  return {
    event: raw.event_name,
    country: raw.country ?? "",
    currency: raw.currency ?? "",
    date: raw.date,
    importance: imp === "High" || imp === "Low" ? imp : "Medium",
    actual: toStr(raw.actual),
    forecast: toStr(raw.forecast),
    previous: toStr(raw.previous),
  };
}

// Week navigation bounds. The forexnewsapi economic-calendar only carries a
// rolling window — reliable data runs ~3 months back and only ~1 month ahead
// (scheduled releases thin out fast beyond that). Clamp the navigator to that
// window so users never page into a guaranteed-empty range.
export const WEEK_MIN = -12; // ~3 months back
export const WEEK_MAX = 4; //   ~1 month forward

export function clampWeek(offset: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(WEEK_MIN, Math.min(WEEK_MAX, Math.trunc(offset)));
}

// Monday→Sunday range for a week offset (0 = current week), anchored in UTC so
// the server-rendered label and the API request agree regardless of host TZ.
export function getWeekRange(offset: number): { start: Date; end: Date } {
  const now = new Date();
  const daysSinceMon = (now.getUTCDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0, …
  const monday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMon
  );
  const start = new Date(monday + offset * 7 * 86_400_000);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return { start, end };
}

export async function getEconomicCalendar(offset = 0): Promise<CalEvent[]> {
  const token = process.env.FOREXNEWSAPI_TOKEN;
  if (!token) return process.env.NODE_ENV === "development" ? SAMPLE_CAL : [];

  const { start, end } = getWeekRange(clampWeek(offset));
  const range = `${mmddyyyy(start)}-${mmddyyyy(end)}`;

  try {
    const res = await fetch(
      // items=100 is the API's per-page max; a single week never exceeds it.
      `https://forexnewsapi.com/api/v1/economic-calendar?date=${range}&importance=High,Medium&items=100&token=${token}`,
      { next: { revalidate: REVALIDATE_SECONDS } }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: ApiCalItem[] };
    const data = Array.isArray(json.data) ? json.data : [];
    return data
      .map(normalizeCal)
      .filter((e): e is CalEvent => e !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch {
    return [];
  }
}

const SAMPLE_CAL: CalEvent[] = [
  { event: "CPI y/y", country: "United States", currency: "USD", date: "Wed, 17 Jun 2026 08:30:00 -0400", importance: "High", actual: null, forecast: "3.0%", previous: "2.8%" },
  { event: "Core CPI m/m", country: "United States", currency: "USD", date: "Wed, 17 Jun 2026 08:30:00 -0400", importance: "High", actual: null, forecast: "0.4%", previous: "0.7%" },
  { event: "Official Bank Rate", country: "United Kingdom", currency: "GBP", date: "Thu, 18 Jun 2026 07:00:00 -0400", importance: "High", actual: null, forecast: "4.50%", previous: "4.50%" },
  { event: "Retail Sales m/m", country: "United States", currency: "USD", date: "Thu, 18 Jun 2026 08:30:00 -0400", importance: "Medium", actual: null, forecast: "0.3%", previous: "0.1%" },
  { event: "Overnight Rate", country: "Canada", currency: "CAD", date: "Fri, 19 Jun 2026 09:45:00 -0400", importance: "High", actual: null, forecast: "2.75%", previous: "2.75%" },
];

// Dev-only fallback so the page renders before the token is wired. Trimmed
// from a real forexnewsapi response.
const SAMPLE_NEWS: NewsItem[] = [
  {
    url: "https://www.fxstreet.com/news/18-consecutive-months-and-running-chinas-central-bank-extends-gold-buying-spree-202606091700",
    title: "18 consecutive months and running: China's central bank extends Gold-buying spree",
    text: "China's central bank extended its gold-buying spree for an 18th straight month.",
    source: "FX Street",
    date: "Tue, 09 Jun 2026 13:00:00 -0400",
    topics: ["Gold", "China"],
    sentiment: "Negative",
    type: "Article",
    image: "https://forexnewsapi.snapi.dev/images/v1/placeholders/forex/f5.jpg",
  },
  {
    url: "https://invezz.com/news/2026/05/21/zimbabwe-zig-gold-backed-currency-stays-stable-despite-risks/",
    title: "Zimbabwe ZiG: Gold-backed currency stays stable despite risks",
    text: "Zimbabwe's gold-backed currency has held steady this year as adoption continues.",
    source: "Invezz",
    date: "Thu, 21 May 2026 04:08:59 -0400",
    topics: ["Gold"],
    sentiment: "Positive",
    type: "Article",
    image: "https://forexnewsapi.snapi.dev/images/v1/placeholders/forex/f14.jpg",
  },
  {
    url: "https://www.reuters.com/world/india/gold-linked-dollar-demand-meets-us-visa-fee-jolt-piling-pressure-indian-rupee-2025-09-24/",
    title: "Gold-linked dollar demand meets US visa fee jolt, piling pressure on Indian rupee",
    text: "The Indian rupee is under strain as rising dollar demand linked to gold imports coincides with a US visa fee hike.",
    source: "Reuters",
    date: "Wed, 24 Sep 2025 03:38:37 -0400",
    topics: ["Gold", "India", "USA"],
    sentiment: "Negative",
    type: "Article",
    image: "https://forexnewsapi.snapi.dev/images/v1/placeholders/forex/f13.jpg",
  },
  {
    url: "https://www.forex.com/en-us/news-and-analysis/usd-gold-crude-oil-asian-open-2024-09-26/",
    title: "USD reverses, gold-bulls eye 2700, crude oil falters ahead of US GDP",
    text: "Traders book profits ahead of a key US GDP report and a highly anticipated PCE inflation report.",
    source: "Forex.com",
    date: "Wed, 25 Sep 2024 18:15:00 -0400",
    topics: ["Gold", "Oil", "USA"],
    sentiment: "Neutral",
    type: "Article",
    image: "https://forexnewsapi.snapi.dev/images/v1/placeholders/forex/f34.jpg",
  },
  {
    url: "https://www.dailyfx.com/news/crude-oil-rallies-with-gold-prices-as-markets-entertain-a-less-hawkish-fed-after-boe-qe-20220929.html",
    title: "Crude Oil Rallies with Gold Prices as Markets Entertain a Less Hawkish Fed",
    text: "Crude oil prices rallied with gold after the Bank of England temporarily restarted quantitative easing.",
    source: "DailyFX",
    date: "Wed, 28 Sep 2022 20:00:00 -0400",
    topics: ["Federal Reserve", "Gold", "Oil", "USA", "United Kingdom"],
    sentiment: "Positive",
    type: "Article",
    image: "https://forexnewsapi.snapi.dev/images/v1/placeholders/forex/f7.jpg",
  },
  {
    url: "https://www.dailyfx.com/news/gold-eyes-pce-economic-data-after-yields-surge-on-hawkish-fomc-speak-20220927.html",
    title: "Gold Eyes PCE, Economic Data After Yields Surge on Hawkish FOMC Speak",
    text: "Gold finds relief in Asia-Pacific trading, but surging Treasury yields and the US Dollar weigh on sentiment.",
    source: "DailyFX",
    date: "Mon, 26 Sep 2022 23:00:00 -0400",
    topics: ["Federal Reserve", "Gold", "PCE"],
    sentiment: "Neutral",
    type: "Article",
    image: "https://forexnewsapi.snapi.dev/images/v1/placeholders/forex/f30.jpg",
  },
];
