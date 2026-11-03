import type { Messages } from "../types";

// The Daily Analysis archive. The analyses themselves (titles, descriptions,
// video, PDF) are written in English by the desk and are not translated.
export const dailyAnalysis: Messages["dailyAnalysis"] = {
  eyebrow: "交易台 · XAU/USD",
  subtitle: "逐个交易时段解读黄金——方向偏好、关键价位，以及背后的逻辑。",
  empty: "还没有发布分析。请稍后再来看看。",
  downloadReport: "下载报告（PDF）↓",
  downloadReportTitle: "下载报告（PDF）",
  downloadAria: "下载报告",
  all: "全部",
  groupBy: "分组方式",
  month: "按月",
  session: "按时段",
  readsOne: "{n} 篇分析",
  readsOther: "{n} 篇分析",
  noMatch: "没有符合该筛选条件的分析。",
  otherSessions: "其他时段",
  undated: "无日期",
  watch: "观看 {title}",
  contentNote: "分析内容本身以英文撰写和录制。",
  sessions: {
    asian: "亚洲盘",
    london: "伦敦盘",
    preNewYork: "纽约盘前",
    newYork: "纽约盘",
  },
};
