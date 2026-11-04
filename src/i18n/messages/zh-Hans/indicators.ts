import type { Messages } from "../types";

// The indicators page. Indicator names (MM Squeeze Pulse...) are product names
// and stay as they are; types and signal lines are by type key / slug.
export const indicators: Messages["indicators"] = {
  eyebrow: "工具 · XAU/USD",
  title: "指标",
  subtitle: "{n} 个 TradingView 指标，授权到你的账户。在下方提交你的 TradingView 用户名，我们会为你开通全部 {n} 个。",
  grantedWhat: "全部 {n} 个指标",
  requestBody: "输入你的 TradingView 用户名，即可使用全部 {n} 个指标。权限自动开通——几小时内就会把你加进去。",
  suite: "指标套件 · {n}",
  view: "在 TradingView 上查看",
  soon: "即将发布",
  imageAlt: "{name} 图表预览",
  types: {
    Momentum: "动量",
    Oscillator: "振荡指标",
    Structure: "结构",
    MLClassifier: "机器学习分类",
    Trend: "趋势",
    MultiTimeframe: "多周期",
    Statistical: "统计",
    Entry: "入场",
  },
  signals: {
    "squeeze-pulse": "挤压释放 + 方向",
    "wave-pressure": "超买/超卖区域穿越",
    "structure-map": "BOS/CHoCH + OB/FVG 区域",
    "echo-predictor": "K 线颜色显示方向偏好",
    "trend-rail": "跟踪方向 + 翻转",
    "pivot-trend": "早期反转识别",
    "mtf-minicharts": "实时价格旁的六个周期",
    "auto-trendlines": "突破回踩形态",
    "adaptive-ma": "斜率方向 + 效率比",
    "reversion-bands": "外轨延伸信号",
  },
};
