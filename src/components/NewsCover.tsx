// Covers for the news cards, drawn by us.
//
// The feed's image_url is a generic stock placeholder — the API literally
// serves ".../placeholders/forex/f5.jpg" — so six cards meant six different
// blue trading screens that said nothing about the story (Gordon, 22 Oct).
// These are drawn instead: the instrument the story is about, in the house
// palette, with the sentiment colour the card's own pill already uses.
//
// Nothing here is a chart. A sketched price line would imply data we don't
// have for the article, so the motif is deliberately abstract.

import type { NewsItem, Sentiment } from "@/lib/forexNews";

/** Spoken names → the code a trader reads. Longest match wins. */
const INSTRUMENTS: readonly (readonly [RegExp, string])[] = [
  [/\bgold\b|\bxau/i, "XAU"],
  [/\bsilver\b|\bxag/i, "XAG"],
  [/\b(wti|brent|crude|oil)\b/i, "OIL"],
  [/\bbitcoin\b|\bbtc\b/i, "BTC"],
  [/\bethereum\b|\beth\b/i, "ETH"],
  [/australian dollar|\baussie\b|\baud\b/i, "AUD"],
  [/canadian dollar|\bloonie\b|\bcad\b/i, "CAD"],
  [/new zealand dollar|\bkiwi\b|\bnzd\b/i, "NZD"],
  [/\b(pound|sterling|gbp)\b/i, "GBP"],
  [/\beuro\b|\beur\b/i, "EUR"],
  [/\byen\b|\bjpy\b/i, "JPY"],
  [/swiss franc|\bfranc\b|\bchf\b/i, "CHF"],
  [/hong kong/i, "HKD"],
  [/south african rand|\brand\b|\bzar\b/i, "ZAR"],
  [/\brupee\b|\binr\b/i, "INR"],
  [/\b(yuan|renminbi|cny)\b/i, "CNY"],
  [/\bpeso\b|\bmxn\b/i, "MXN"],
  [/\blira\b|\btry\b/i, "TRY"],
  [/\bwon\b|\bkrw\b/i, "KRW"],
  [/\breal\b|\bbrl\b/i, "BRL"],
  [/\brouble\b|\bruble\b|\brub\b/i, "RUB"],
  [/us dollar|\bgreenback\b|\busd\b|\bdollar\b/i, "USD"],
  // Countries resolve to the currency a trader would watch, so a story
  // tagged only "China" doesn't become a nonsense ticker.
  [/\bchina\b|\bchinese\b/i, "CNY"],
  [/\b(usa|united states|u\.s\.|america|fed|fomc)\b/i, "USD"],
  [/\baustralia\b|\brba\b/i, "AUD"],
  [/\bcanada\b|\bboc\b/i, "CAD"],
  [/\bjapan\b|\bboj\b/i, "JPY"],
  [/\b(uk|britain|british|boe)\b/i, "GBP"],
  [/\b(eurozone|europe|ecb|germany|france|italy|spain)\b/i, "EUR"],
  [/\bswitzerland\b|\bsnb\b/i, "CHF"],
  [/\bnew zealand\b|\brbnz\b/i, "NZD"],
  [/south africa/i, "ZAR"],
  [/\bindia\b/i, "INR"],
  [/\bmexico\b/i, "MXN"],
  [/\bturkey\b|\bturkish\b/i, "TRY"],
  [/south korea|\bkorean\b/i, "KRW"],
  [/\bbrazil\b/i, "BRL"],
  [/\brussia\b/i, "RUB"],
];

export interface CoverLabel {
  text: string;
  /** A real code gets the big display treatment; a theme word doesn't. */
  big: boolean;
}

/**
 * What the story is about: a currency/commodity code when one can be read
 * from the headline or topics, otherwise the topic itself, spelled out. A
 * truncated topic ("China" -> "CHI") reads as a ticker that doesn't exist,
 * so we never invent one.
 */
export function coverLabel(item: Pick<NewsItem, "title" | "topics">): CoverLabel {
  const hay = `${item.title} ${item.topics.join(" ")}`;
  for (const [re, code] of INSTRUMENTS) if (re.test(hay)) return { text: code, big: true };
  const topic = item.topics[0]?.trim();
  if (topic) {
    return topic.length <= 4
      ? { text: topic.toUpperCase(), big: true }
      : { text: topic.toUpperCase(), big: false };
  }
  return { text: "MACRO", big: false };
}

const PALETTE: Record<Sentiment, { ground: string; ink: string; motif: string }> = {
  // The same three colours the sentiment pill uses, so cover and pill agree.
  Positive: { ground: "#EAF7F2", ink: "#0F6E56", motif: "#0F6E56" },
  Negative: { ground: "#FDEFEF", ink: "#A32D2D", motif: "#A32D2D" },
  Neutral: { ground: "#FFF1E8", ink: "#C2410C", motif: "#C2410C" },
};

/** Stable per article, so a card's motif never changes between renders. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function Motif({ kind, color }: { kind: number; color: string }) {
  if (kind === 0) {
    // Dot matrix.
    const dots = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 11; x++) {
        dots.push(<circle key={`${x}-${y}`} cx={210 + x * 14} cy={22 + y * 14} r="1.6" fill={color} />);
      }
    }
    return <g opacity="0.22">{dots}</g>;
  }
  if (kind === 1) {
    // Concentric arcs, anchored off the right edge.
    return (
      <g opacity="0.18" fill="none" stroke={color} strokeWidth="2">
        {[40, 62, 84, 106, 128].map((r) => (
          <circle key={r} cx="340" cy="100" r={r} />
        ))}
      </g>
    );
  }
  // Diagonal hairlines.
  return (
    <g opacity="0.16" stroke={color} strokeWidth="2">
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={190 + i * 18} y1="0" x2={150 + i * 18} y2="180" />
      ))}
    </g>
  );
}

export function NewsCover({ item }: { item: NewsItem }) {
  const label = coverLabel(item);
  const p = PALETTE[item.sentiment] ?? PALETTE.Neutral;
  const kind = hash(item.url) % 3;
  // The strap repeats the label when there's only one topic, so drop it then.
  const rest = item.topics.filter((t) => t.toUpperCase() !== label.text).slice(0, 2);
  const tag = rest.join(" · ").toUpperCase();

  return (
    <svg
      viewBox="0 0 360 180"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label={`${label.text}, ${item.sentiment.toLowerCase()} story`}
    >
      <rect width="360" height="180" fill={p.ground} />
      <Motif kind={kind} color={p.motif} />
      <text
        x="20"
        y={label.big ? 96 : 92}
        fill={p.ink}
        className="font-display"
        fontSize={label.big ? 44 : 23}
        fontWeight="700"
        letterSpacing={label.big ? -1 : 0}
      >
        {label.text.length > 18 ? `${label.text.slice(0, 17)}…` : label.text}
      </text>
      <rect x="21" y="112" width="30" height="3" rx="1.5" fill={p.ink} opacity="0.75" />
      {tag && (
        <text x="20" y="138" fill={p.ink} opacity="0.65" fontSize="11" fontWeight="600" letterSpacing="1.2">
          {tag.length > 26 ? `${tag.slice(0, 25)}…` : tag}
        </text>
      )}
    </svg>
  );
}
