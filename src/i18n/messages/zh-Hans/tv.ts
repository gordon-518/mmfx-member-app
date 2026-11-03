import type { Messages } from "../types";

// The TradingView access block on /indicators and /strategies, and the
// username errors (by code: the actions redirect with ?tv_error=<code>).
export const tv: Messages["tv"] = {
  grantedBadge: "已开通 · 自动",
  grantedBody: "已自动为 TradingView 上的 {username} 开通权限。你应该会在 1–3 小时内在账户中看到{what}。",
  updatePlaceholder: "更新用户名",
  update: "更新",
  request: "申请开通",
  usernamePlaceholder: "你的 TradingView 用户名",
  hint: "请使用你的 TradingView 用户名（@用户名），而不是显示名称或邮箱——它们通常不一样。可在 tradingview.com → 你的头像 → @名称 中找到。",
  errors: {
    empty: "请输入你的 TradingView 用户名。",
    email: "这看起来像是邮箱——请输入你的 TradingView 用户名（@用户名），而不是邮箱。",
    spaces: "TradingView 用户名不含空格——请输入你的 @用户名，而不是显示名称。",
    chars: "只能使用字母、数字和下划线——这里要填的是 TradingView 用户名，不是显示名称。",
    generic: "无法保存这个用户名。请检查后重试。",
  },
};
