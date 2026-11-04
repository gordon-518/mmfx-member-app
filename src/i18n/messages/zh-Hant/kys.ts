import type { Messages } from "../types";

// Know Your Style: the assessment, the report screen and the emailed copy.
// moves.* are the "next move" buttons chosen from the two weakest dimensions
// (src/lib/kys/routing.ts holds where each one goes).
export const kys: Messages["kys"] = {
  eyebrow: "AI 工具 · 個人畫像",
  subtitle: "十四個問題，然後是一份關於你交易方式的書面分析：你的交易者類型、六個維度，以及讓你虧錢的短板。",
  headline: "每個交易者都有自己的{tell}{find}",
  headlineTell: "破綻。",
  headlineFind: "來找出你的。",
  intro: "十四個問題，大約六分鐘。請如實作答——報告的品質取決於你給出的答案。",
  getArchetype: "你的交易者類型——",
  getArchetypeDetail: "你實際上屬於 {n} 種交易者類型中的哪一種。",
  getDimensions: "你的六個維度——",
  getDimensionsDetail: "根據你的答案評分，看你在每條光譜上的位置。",
  getLeak: "你的短板——",
  getLeakDetail: "最弱的那一項，以及它讓你付出的代價。",
  start: "開始測評 →",
  savedNote: "結果會儲存到你的個人資料——隨時可以回來查看。",
  measured: "測評內容",
  question: "問題",
  analysing: {
    s1: "正在讀取你的答案…",
    s2: "正在分析你的風險行為…",
    s3: "正在對照 {n} 種交易者類型…",
    s4: "正在找出你的短板…",
    s5: "正在撰寫你的測評報告…",
  },
  errorTitle: "沒有完成。",
  errorSession: "你的登入已過期。請重新登入，然後再試一次。",
  errorService: "暫時無法產生報告（錯誤 {status}）。請稍後再試。",
  errorNetwork: "無法連線報告服務。請檢查網路後重試。",
  errorKept: "你的答案都還在——再試一次。",
  yourStyle: "你的交易風格",
  taken: "測評於 {date} · 你儲存的個人畫像",
  sendCopy: "寄一份給我",
  sending: "正在寄送…",
  sent: "已寄出——請查看你的收件匣。",
  sendFailed: "寄送失敗。你的個人畫像已儲存——隨時可以在這裡重試。",
  profileTitle: "你的個人畫像",
  profileBody: "你交易方式的六個維度。你不只是一個標籤——這是完整的輪廓，而最弱的幾項正是你流失資金的地方。",
  nextMoves: "你的下一步",
  movesNote: "根據你的交易者類型和最弱的兩個維度挑選",
  retake: "重新測評",
  fallbackName: "你的交易者畫像",
  leak: "你的短板",
  strength: "優勢",
  score: "{score} / 100",
  reportLanguageNote: "你儲存的報告使用的是你當時測評所用的語言。重新測評即可取得這個語言的版本。",
  emailEyebrow: "交易風格測評 · 你的交易風格",
  emailProfileBody: "你交易方式的六個維度。最弱的幾項正是你流失資金的地方。",
  emailSubject: "你的交易風格測評結果——{archetype}",
  moves: {
    riskCourse: {
      label: "管理與日常流程模組",
      why: "每日虧損上限和固定倉位——把風險規則寫進流程。",
    },
    decisionTreesRisk: {
      label: "Decision Trees & Invalidation",
      why: "在進場之前，就清楚知道自己在什麼情況下是錯的。",
    },
    ifThen: {
      label: "閱讀 If-Then 電子書",
      why: "提前定好你的反應，讓一次虧損無法左右你。",
    },
    liveClass: {
      label: "參加直播課",
      why: "即時觀看 MM Desk 如何冷靜地管理倉位。",
    },
    startCourse: {
      label: "開始學習 MM 體系課程",
      why: "學會自己看結構，而不是依賴訊號。",
    },
    todaysRead: {
      label: "今日黃金解讀",
      why: "看一份完整的解讀如何逐個時段搭建、推理。",
    },
    backtest: {
      label: "回測一個策略",
      why: "建立對規則的信任，讓你敢於果斷執行。",
    },
    decisionTreesDecide: {
      label: "Decision Trees & Invalidation",
      why: "一份明確的檢查清單，能消除你在圖表前的猶豫。",
    },
    oneSystem: {
      label: "專注一套體系",
      why: "一套框架，從頭學到尾，堅持交易足夠久來驗證它。",
    },
    oneEdge: {
      label: "一個經過回測的優勢",
      why: "選定一個策略，給它足夠的樣本量。",
    },
    dailySop: {
      label: "每日 SOP",
      why: "一套可重複的流程：標記、定方向、等待、確認、管理、記錄。",
    },
    dailyPlan: {
      label: "從每日計畫開始",
      why: "每個交易時段開始前，就清楚 MM Desk 的預期及原因。",
    },
  },
};
