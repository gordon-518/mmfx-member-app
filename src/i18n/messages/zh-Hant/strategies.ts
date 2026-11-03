import type { Messages } from "../types";

// The strategies page. Script names are product names and stay as they are.
export const strategies: Messages["strategies"] = {
  eyebrow: "工具 · XAU/USD",
  title: "策略",
  subtitle: "可回測的 TradingView 策略腳本——把進場、出場和風險寫成程式碼，讓你在自己的圖表上檢驗。目前已上線兩個，更多即將推出。",
  grantedWhat: "兩個策略腳本",
  requestBody: "輸入你的 TradingView 使用者名稱，即可使用兩個策略腳本。權限自動開通——很快就會出現在你的帳戶中。",
  view: "在 TradingView 上查看",
  imageAlt: "{name} 在 TradingView 上的回測",
  comingSoon: "即將推出",
  inBuild: "開發中",
  inBuildBody: "另一個可回測的交易設定——很快會加入你的會員專區。",
  types: {
    Trend: "趨勢",
    Entry: "進場",
  },
  signals: {
    "mm-ama-supertrend": "自適應均線 SuperTrend——趨勢方向、翻轉價位和多空觸發，已在黃金上回測。",
    "mm-system-5m-entry": "寫成程式碼的 5 分鐘進場模型——高週期方向、賣出/買入區域和確認，把 MM 工作流程自動化。",
  },
};
