import type { Messages } from "../types";

// The strategies page. Script names are product names and stay as they are.
export const strategies: Messages["strategies"] = {
  eyebrow: "工具 · XAU/USD",
  title: "策略",
  subtitle: "可回测的 TradingView 策略脚本——把入场、出场和风险写成代码，让你在自己的图表上检验。目前已上线两个，更多即将推出。",
  grantedWhat: "两个策略脚本",
  requestBody: "输入你的 TradingView 用户名，即可使用两个策略脚本。权限自动开通——很快就会出现在你的账户中。",
  view: "在 TradingView 上查看",
  imageAlt: "{name} 在 TradingView 上的回测",
  comingSoon: "即将推出",
  inBuild: "开发中",
  inBuildBody: "另一个可回测的交易设置——很快会加入你的会员专区。",
  types: {
    Trend: "趋势",
    Entry: "入场",
  },
  signals: {
    "mm-ama-supertrend": "自适应均线 SuperTrend——趋势方向、翻转价位和多空触发，已在黄金上回测。",
    "mm-system-5m-entry": "写成代码的 5 分钟入场模型——高周期方向、卖出/买入区域和确认，把 MM 工作流程自动化。",
  },
};
