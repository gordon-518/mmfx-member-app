import type { Messages } from "../types";

// Locked feature pages, the lock veil and the members-only panel. Compliance:
// say what each tool is, never what it earns.
export const locked: Messages["locked"] = {
  features: {
    indicators: {
      eyebrow: "工具 · TradingView",
      title: "指標",
      pitch: "MM 體系的邀請制 TradingView 指標，直接授權到你的 TradingView 使用者名稱。",
      points: {
        p1: "自動趨勢線、樞軸點和多週期視圖",
        p2: "在你自己的 TradingView 圖表上使用",
        p3: "自動開通權限",
      },
    },
    strategies: {
      eyebrow: "工具 · TradingView",
      title: "策略",
      pitch: "可回測的 TradingView 策略腳本，把 MM 體系的規則寫成程式碼。",
      points: {
        p1: "自己用歷史數據檢驗這些規則",
        p2: "課程中的進場模型，寫成程式碼",
        p3: "在你自己的 TradingView 圖表上使用",
      },
    },
    library: {
      eyebrow: "教育 · 資料庫",
      title: "MM 資料庫",
      pitch: "四本 MM 電子書：這套體系、它的實戰手冊以及背後的思路。",
      points: {
        p1: "MM 體系的完整文字版",
        p2: "可以放在圖表旁邊隨時翻閱的手冊",
        p3: "下載後可離線閱讀",
      },
    },
    "live-classes": {
      eyebrow: "教育 · 直播",
      title: "直播課程",
      pitch: "與 MM Desk 一起看圖，隨著行情變化即時解讀市場。",
      points: {
        p1: "與 MM Desk 一起即時看圖",
        p2: "邊看邊提問",
        p3: "往期課程回放",
      },
    },
    "fundamental-desk": {
      eyebrow: "機器人 · 總經",
      title: "Fundamental Desk",
      pitch: "黃金的即時總經解讀：用淺顯易懂的方式講清推動 XAU/USD 的基本面。",
      points: {
        p1: "今天是什麼在推動黃金，原因是什麼",
        p2: "利率、美元和風險情緒，一次看懂",
        p3: "在交易時段內持續更新",
      },
    },
    "ai-trading-assistant": {
      eyebrow: "Team MM · AI",
      title: "AI 交易助手",
      pitch: "連接你的交易帳戶，獲得一位按照 MM 體系複盤你每一筆交易的教練。",
      points: {
        p1: "每一筆交易都自動複盤",
        p2: "自動找出你交易中的規律",
        p3: "圍繞 MM 體系打造",
      },
    },
    "team-mm": {
      eyebrow: "Team MM · 社群",
      title: "Team MM",
      pitch: "與 MM Desk 一起的私密 Team MM 頻道。",
      points: {
        p1: "直接來自 MM Desk",
        p2: "僅限 Team MM 會員",
        p3: "在 Telegram 上",
      },
    },
  },
  fallbackTitle: "MM Desk 的這一部分尚未解鎖",
  fallbackPitch: "為你的帳戶入金後即可開通。",
  openOnEvery: "所有方案均已開放",
  openNow: "你的方案現在可以使用",
  freeSignals: "訊號頻道",
  freeNews: "新聞",
  freeCourse: "課程 · 模組 1",
  membersOnly: "會員專享",
  membersTitle: "{feature} 僅限 MM 體系會員",
  perkTeam: "Team MM——私密 VIP 訊號頻道",
  perkJournal: "AI 交易日誌",
  perkEas: "自動化 EA——即將推出",
  become: "成為會員",
  trialNote: "你正在免費試用——為你自己的經紀商帳戶入金即可解鎖全部內容。",
  freeNote: "你目前使用免費方案——為你自己的經紀商帳戶入金即可解鎖全部內容。",
  paidNote: "你目前是 {tier}——之前的入金都會累計計算，只需追加入金補足差額即可達到 {feature}。",
};
