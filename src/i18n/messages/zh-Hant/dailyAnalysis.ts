import type { Messages } from "../types";

// The Daily Analysis archive. The analyses themselves (titles, descriptions,
// video, PDF) are written in English by the desk and are not translated.
export const dailyAnalysis: Messages["dailyAnalysis"] = {
  eyebrow: "交易台 · XAU/USD",
  subtitle: "逐個交易時段解讀黃金——方向偏好、關鍵價位，以及背後的邏輯。",
  empty: "還沒有發布分析。請稍後再來看看。",
  downloadReport: "下載報告（PDF）↓",
  downloadReportTitle: "下載報告（PDF）",
  downloadAria: "下載報告",
  all: "全部",
  groupBy: "分組方式",
  month: "按月",
  session: "按時段",
  readsOne: "{n} 篇分析",
  readsOther: "{n} 篇分析",
  noMatch: "沒有符合該篩選條件的分析。",
  otherSessions: "其他時段",
  undated: "無日期",
  watch: "觀看 {title}",
  contentNote: "分析內容本身以英文撰寫和錄製。",
  sessions: {
    asian: "亞洲盤",
    london: "倫敦盤",
    preNewYork: "紐約盤前",
    newYork: "紐約盤",
  },
};
