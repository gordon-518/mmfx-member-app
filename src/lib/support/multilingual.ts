// Compliance checks on an assistant draft, in every language the app speaks.
// guard.ts's checkDraft was written for English Telegram replies; both
// assistants (the Telegram support agent and the in-app chat) answer in five
// languages, so these add the same three rules for Chinese, Malay and
// Indonesian (plus English wordings checkDraft doesn't know), and one more:
// no price levels with a buy/sell instruction. Every draft runs through both.
//
// A claim is judged in its own clause, and only the words just before it can
// hedge it ("once it's approved", "不保证", "tidak dijamin"): a "will" or a
// "不" elsewhere in the sentence used to wave a real claim through
// (security review, 4 Nov). Decimal prices ("1.2650") and thousands ("3,950")
// stay whole when the reply is split.

import { MONEY_CLAIM } from "@/i18n/moneyClaims";

const DOT_KEEP = "․"; // one-dot leader: a decimal point while splitting
const COMMA_KEEP = "‚"; // single low-9 quote: a thousands comma while splitting

/** The reply's clauses: split at sentence ends, newlines, commas and semicolons. */
function clauses(text: string): string[] {
  return text
    .replace(/(\d)\.(?=\d)/g, `$1${DOT_KEEP}`)
    .replace(/(\d),(?=\d{3}\b)/g, `$1${COMMA_KEEP}`)
    .split(/(?<=[.!?。！？])\s*|\n+|[,;，；]\s*/)
    .map((c) => c.replaceAll(DOT_KEEP, ".").replaceAll(COMMA_KEEP, ",").trim())
    .filter(Boolean);
}

// What can hedge a claim, when it comes just before it.
const NEGATION = String.raw`\b(?:not|n't|no|never|tidak|tak|tiada|bukan|belum)\b|不|没|沒|无|無|未|尚未|还没|還沒`;
const CONDITION = String.raw`\b(?:once|when|after|as soon as|if|until|apabila|selepas|sebaik|setelah|jika|kalau|begitu|saat|ketika)\b|一旦|之后|之後|以后|以後|如果|假如|若|待`;
const FUTURE = String.raw`\b(?:will|'ll|yet|akan)\b|会|會|将|將`;
/** A deposit "will be approved once…" is honest; so is anything negated. */
const DEPOSIT_HEDGE = new RegExp(`${NEGATION}|${CONDITION}|${FUTURE}`, "i");
/** "You will earn" is still a promise: only a negation or a condition hedges these. */
const CLAIM_HEDGE = new RegExp(`${NEGATION}|${CONDITION}`, "i");
const HEDGE_WINDOW = 30;

/** Every match of `re` in `clause` that nothing just before it hedges. */
function unhedged(clause: string, re: RegExp, hedge: RegExp): RegExpMatchArray[] {
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  return [...clause.matchAll(global)].filter(
    (m) => !hedge.test(clause.slice(Math.max(0, (m.index ?? 0) - HEDGE_WINDOW), m.index))
  );
}

// 1) A deposit called approved/credited when the member's latest isn't verified.
const DEPOSIT_WORD = /\b(deposit|deposits|funds?|money|top-?up|submission|transfer|setoran|dana|wang|duit|bayaran|uang|pemindahan)\b|入金|存款|充值|资金|資金|款项|款項|转账|轉賬|轉帳|提交/i;
const APPROVED = new RegExp(
  [
    String.raw`\b(has been|have been|was|is|got)\s+(cleared|accepted|credited|processed|approved|verified|confirmed)\b`,
    String.raw`\bwent through\b`,
    String.raw`\b(telah|sudah)\s+(diluluskan|disahkan|diterima|dikreditkan|diproses|berjaya|disetujui|diverifikasi|dikonfirmasi|masuk|berhasil)\b`,
    "(已经?|已經)\\s*(批准|核准|通过|通過|确认|確認|核实|核實|验证|驗證|到账|到賬|入账|入賬|审核通过|審核通過|处理|處理)",
  ].join("|"),
  "i"
);
/** The deposit has to be what was approved: named just before the claim, or right after it. */
function depositApproved(clause: string): boolean {
  return unhedged(clause, APPROVED, DEPOSIT_HEDGE).some((m) => {
    const at = m.index ?? 0;
    const before = clause.slice(Math.max(0, at - 40), at);
    const after = clause.slice(at + m[0].length, at + m[0].length + 12);
    return DEPOSIT_WORD.test(before) || DEPOSIT_WORD.test(after);
  });
}

// 2) Money called safe or protected. "Selamat datang" is a welcome, not a promise.
const SELAMAT = String.raw`selamat(?!\s+(?:datang|pagi|petang|malam|siang|sore|tengah|jalan|tinggal|berdagang|bergabung|belajar|menikmati|mencuba|mencoba|hari))`;
const MONEY_SAFE = [
  /(资金|資金|资产|資產|本金|钱|錢|入金|存款)[^。！？\n]{0,12}(安全|有保障|受保护|受保護|零风险|零風險)/,
  new RegExp(String.raw`\b(wang|dana|duit|modal|deposit)\b[^.!?\n]{0,30}\b(${SELAMAT}|terjamin|dilindungi|tanpa risiko|tiada risiko)\b`, "i"),
  /\b(dana|uang|modal|deposit)\b[^.!?\n]{0,30}\b(aman|terjamin|dilindungi|tanpa risiko|bebas risiko)\b/i,
];

// 3) Profit or return promises (the per-language list the app's copy is held to).
const PROFIT = [MONEY_CLAIM["zh-Hans"], MONEY_CLAIM["zh-Hant"], MONEY_CLAIM.ms, MONEY_CLAIM.id];
/** Promises whatever surrounds them ("稳赚不赔" negates nothing), unless they are themselves negated. */
const PROFIT_ALWAYS = new RegExp(
  [
    "稳赚|穩賺|包赚|包賺|稳赢|穩贏|不会亏|不會虧",
    "(?<![不没沒无無未])(?:保证|保證)(?:赚|賺|盈利|收益|回报|回報)",
    "(?<!没有|沒有|并非|並非|不是|不存在)(?:零风险|零風險)",
    "(?<!tidak |tak |bukan |tiada )(?:pasti untung|untung pasti|dijamin untung)",
    "(?<!tidak ada |tiada |bukan )tanpa rugi",
    "(?<!no |not |never |n't |without )(?:guaranteed (?:profits?|returns?|income)|risk-free (?:profits?|returns?))",
  ].join("|"),
  "i"
);

// 4) Trading advice: a buy/sell instruction next to a price level.
const DIRECTION =
  /\b(buy|sell|long|short|entry|target|stop[- ]?loss|take[- ]?profit|beli|jual|sasaran|henti rugi|ambil untung)\b|买入|卖出|買入|賣出|做多|做空|入场|入場|止损|止損|止盈|目标价|目標價/i;
/** A level, not a plan price or a date: no currency in front ($ amounts are
 *  checkDraft's: any not on the fact sheet already fails), and not a year. */
const LEVEL =
  /(?<![$\d,.]|USD\s?|US\$\s?|RM\s?|Rp\.?\s?|SGD\s?)(?:\b\d{1,2},\d{3}(?:\.\d+)?\b|\b(?!(?:19|20)\d{2}\b)\d{4,5}(?:\.\d+)?\b|\b\d\.\d{3,5}\b)/i;

// 5) App links with a query or fragment (an open redirect waiting to happen).
const APP_LINK_WITH_QUERY = /https:\/\/app\.marketmakersfx\.net\/[^\s]*[?#]/i;

export function checkMultilingual(reply: string, ctx: { depositVerified: boolean }): string[] {
  const reasons = new Set<string>();
  for (const c of clauses(reply)) {
    if (!ctx.depositVerified && depositApproved(c)) {
      reasons.add("says a deposit is approved or credited, but the latest submission isn't verified");
    }
    if (MONEY_SAFE.some((re) => unhedged(c, re, CLAIM_HEDGE).length)) reasons.add("says money is safe or protected");
    if (PROFIT_ALWAYS.test(c) || PROFIT.some((re) => unhedged(c, re, CLAIM_HEDGE).length)) {
      reasons.add("reads as a profit or return promise");
    }
    if (DIRECTION.test(c) && LEVEL.test(c)) reasons.add("gives a price with a buy/sell instruction (trading advice)");
  }
  if (APP_LINK_WITH_QUERY.test(reply)) reasons.add("links to an app page with a query or fragment; link the page itself");
  return [...reasons];
}
