import type { Messages } from "../types";

// The eight Know Your Style archetypes, keyed by the ID profiles.kys_archetype
// stores. The English matches src/lib/kys/archetypes.json, which still feeds the
// report prompt (a test keeps the two in step). keystone* is the archetype's
// first "next move" button.
export const archetypes: Messages["archetypes"] = {
  reckless_gambler: {
    name: "魯莽賭徒",
    keystoneLabel: "管理與日常流程模組",
    keystoneWhy: "先建立風險規則——在做任何事之前，先固定倉位、設好硬停損。",
  },
  analysis_paralyser: {
    name: "分析癱瘓者",
    keystoneLabel: "回測一個策略",
    keystoneWhy: "證明你的規則行得通，別再苛求永遠不會出現的確定性。",
  },
  signal_dependent: {
    name: "訊號依賴者",
    keystoneLabel: "開始學習 MM 體系課程",
    keystoneWhy: "把跟單變成一項真正屬於你的技能。",
  },
  indicator_stacker: {
    name: "指標堆疊者",
    keystoneLabel: "解讀價格模組",
    keystoneWhy: "依據清晰的結構交易，而不是一堆互相矛盾的指標。",
  },
  emotional_revenge_trader: {
    name: "情緒化報復交易者",
    keystoneLabel: "閱讀 If-Then 電子書",
    keystoneWhy: "提前定好你的反應，讓一次虧損無法左右你。",
  },
  news_trader: {
    name: "新聞交易者",
    keystoneLabel: "經濟日曆",
    keystoneWhy: "圍繞關鍵催化事件做計畫，而不是追逐每一則頭條。",
  },
  system_hopper: {
    name: "頻繁換系統者",
    keystoneLabel: "專注一套體系",
    keystoneWhy: "一套框架，堅持交易足夠久，經驗才會真正累積起來。",
  },
  brand_new_beginner: {
    name: "純新手",
    keystoneLabel: "從「基礎」模組開始",
    keystoneWhy: "在投入任何真金白銀之前，先打好基礎。",
  },
};
