import type { Messages } from "../types";

// The indicators page. Indicator names (MM Squeeze Pulse...) are product names
// and stay as they are; types and signal lines are by type key / slug.
export const indicators: Messages["indicators"] = {
  eyebrow: "工具 · XAU/USD",
  title: "指標",
  subtitle: "{n} 個 TradingView 指標，授權到你的帳戶。在下方提交你的 TradingView 使用者名稱，我們會為你開通全部 {n} 個。",
  grantedWhat: "全部 {n} 個指標",
  requestBody: "輸入你的 TradingView 使用者名稱，即可使用全部 {n} 個指標。權限自動開通——幾小時內就會把你加進去。",
  suite: "指標套件 · {n}",
  view: "在 TradingView 上查看",
  soon: "即將發布",
  imageAlt: "{name} 圖表預覽",
  types: {
    Momentum: "動量",
    Oscillator: "震盪指標",
    Structure: "結構",
    MLClassifier: "機器學習分類",
    Trend: "趨勢",
    MultiTimeframe: "多週期",
    Statistical: "統計",
    Entry: "進場",
  },
  signals: {
    "squeeze-pulse": "擠壓釋放 + 方向",
    "wave-pressure": "超買/超賣區域穿越",
    "structure-map": "BOS/CHoCH + OB/FVG 區域",
    "echo-predictor": "K 線顏色顯示方向偏好",
    "trend-rail": "追蹤方向 + 翻轉",
    "pivot-trend": "早期反轉辨識",
    "mtf-minicharts": "即時價格旁的六個週期",
    "auto-trendlines": "突破回測型態",
    "adaptive-ma": "斜率方向 + 效率比",
    "reversion-bands": "外軌延伸訊號",
  },
};
