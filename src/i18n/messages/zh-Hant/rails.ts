import type { Messages } from "../types";

export const rails: Messages["rails"] = {
  stages: {
    s1: {
      label: "分析",
      tagline: "解讀市場",
    },
    s2: {
      label: "執行",
      tagline: "尋找並執行交易",
    },
    s3: {
      label: "交易管理",
      tagline: "管理倉位",
    },
  },
  cards: {
    "daily-analysis": {
      title: "每日分析",
      blurb: "按交易時段解讀黃金",
    },
    "fundamental-desk": {
      title: "基本面分析台",
      blurb: "XAU/USD 即時總經解讀",
    },
    signals: {
      title: "交易訊號",
      blurb: "高確信度的交易訊號",
    },
    indicators: {
      title: "指標",
      blurb: "{n} 個 TradingView 工具",
    },
    strategies: {
      title: "策略",
      blurb: "可回測的交易設定",
    },
    "live-classes": {
      title: "直播課程",
      blurb: "與交易台一起即時看圖",
    },
    "know-your-style": {
      title: "交易風格測評",
      blurb: "找出你的交易者類型",
    },
    "ai-trading-assistant": {
      title: "AI 交易助手",
      blurb: "檢視你的真實交易，找出漏洞",
    },
    course: {
      title: "MM 體系課程",
      blurb: "從入門到進階 · {n} 堂課",
    },
    library: {
      title: "電子書資料庫",
      blurb: "成文的體系與參考資料",
    },
  },
};
