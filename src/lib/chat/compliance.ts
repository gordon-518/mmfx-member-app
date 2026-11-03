// Compliance checks on an assistant draft, in every language the app speaks.
// The support guard (src/lib/support/guard.ts) was written for English
// Telegram replies; the in-app assistant answers in five languages, so these
// add the same three rules for Chinese, Malay and Indonesian (plus English
// wordings the support guard doesn't know), and one the support agent never
// needed: no prices with a buy/sell instruction.
//
// Each rule reads one sentence at a time and lets a sentence through when it
// is negated or conditional ("once it's approved", "不保证", "tidak dijamin"),
// which is how the risk notice and the honest "it's in review" answer read.

import { MONEY_CLAIM } from "@/i18n/moneyClaims";

const SENTENCE = /[^.!?。！？\n]+[.!?。！？]?/g;
const sentences = (text: string) => text.match(SENTENCE)?.map((s) => s.trim()).filter(Boolean) ?? [];

/** A sentence that's negated, conditional or about the future isn't a claim. */
const HEDGE =
  /\b(not|n't|no|never|once|when|after|as soon as|if|until|will|'ll|yet|tidak|tak|tiada|bukan|belum|akan|apabila|selepas|sebaik|setelah|jika|kalau|begitu|saat|ketika)\b|不|没|沒|无|無|未|尚未|一旦|之后|之後|以后|以後|会|會|将|將|待|还没|還沒/i;

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

// 2) Money called safe or protected.
const MONEY_SAFE = [
  /(资金|資金|资产|資產|本金|钱|錢|入金|存款)[^。！？\n]{0,12}(安全|有保障|受保护|受保護|零风险|零風險)/,
  /\b(wang|dana|duit|modal|deposit)\b[^.!?\n]{0,30}\b(selamat|terjamin|dilindungi|tanpa risiko|tiada risiko)\b/i,
  /\b(dana|uang|modal|deposit)\b[^.!?\n]{0,30}\b(aman|terjamin|dilindungi|tanpa risiko|bebas risiko)\b/i,
];

// 3) Profit or return promises (the per-language list the app's copy is held to).
const PROFIT = [MONEY_CLAIM["zh-Hans"], MONEY_CLAIM["zh-Hant"], MONEY_CLAIM.ms, MONEY_CLAIM.id];
// Phrases that are a promise whatever surrounds them — the negation in
// "稳赚不赔" ("sure profit, no loss") is part of the claim, not a hedge.
const PROFIT_ALWAYS =
  /稳赚|穩賺|包赚|包賺|稳赢|穩贏|不赔|不賠|不会亏|不會虧|零风险|零風險|保证(赚|盈利|收益|回报)|保證(賺|盈利|收益|回報)|(pasti (untung|untung besar)|untung pasti|dijamin untung|tanpa rugi|guaranteed (profit|returns?|income)|risk-free (profit|returns?))/i;

// 4) Trading advice: a buy/sell instruction next to a price.
const DIRECTION =
  /\b(buy|sell|long|short|entry|enter|target|stop[- ]?loss|take[- ]?profit|beli|jual|sasaran|henti rugi|ambil untung)\b|买入|卖出|買入|賣出|做多|做空|入场|入場|止损|止損|止盈|目标价|目標價/i;
const PRICE = /\b\d{1,2},?\d{3}(?:\.\d+)?\b|\b\d\.\d{3,5}\b/;

// 5) App links with a query or fragment (an open redirect waiting to happen).
const APP_LINK_WITH_QUERY = /https:\/\/app\.marketmakersfx\.net\/[^\s]*[?#]/i;

export function checkChatReply(reply: string, ctx: { depositVerified: boolean }): string[] {
  const reasons = new Set<string>();
  for (const s of sentences(reply)) {
    const hedged = HEDGE.test(s);
    if (!ctx.depositVerified && !hedged && DEPOSIT_WORD.test(s) && APPROVED.test(s)) {
      reasons.add("says a deposit is approved or credited, but the latest submission isn't verified");
    }
    if (!hedged && MONEY_SAFE.some((re) => re.test(s))) reasons.add("says money is safe or protected");
    if (PROFIT_ALWAYS.test(s) || (!hedged && PROFIT.some((re) => re.test(s)))) reasons.add("reads as a profit or return promise");
    if (DIRECTION.test(s) && PRICE.test(s)) reasons.add("gives a price with a buy/sell instruction (trading advice)");
  }
  if (APP_LINK_WITH_QUERY.test(reply)) reasons.add("links to an app page with a query or fragment; link the page itself");
  return [...reasons];
}
