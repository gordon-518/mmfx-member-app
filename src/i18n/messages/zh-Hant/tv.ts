import type { Messages } from "../types";

// The TradingView access block on /indicators and /strategies, and the
// username errors (by code: the actions redirect with ?tv_error=<code>).
export const tv: Messages["tv"] = {
  grantedBadge: "已開通 · 自動",
  grantedBody: "已自動為 TradingView 上的 {username} 開通權限。你應該會在 1–3 小時內在帳戶中看到{what}。",
  updatePlaceholder: "更新使用者名稱",
  update: "更新",
  request: "申請開通",
  usernamePlaceholder: "你的 TradingView 使用者名稱",
  hint: "請使用你的 TradingView 使用者名稱（@使用者名稱），而不是顯示名稱或電子郵件——它們通常不一樣。可在 tradingview.com → 你的頭像 → @名稱 中找到。",
  errors: {
    empty: "請輸入你的 TradingView 使用者名稱。",
    email: "這看起來像是電子郵件——請輸入你的 TradingView 使用者名稱（@使用者名稱），而不是電子郵件。",
    spaces: "TradingView 使用者名稱不含空格——請輸入你的 @使用者名稱，而不是顯示名稱。",
    chars: "只能使用字母、數字和底線——這裡要填的是 TradingView 使用者名稱，不是顯示名稱。",
    generic: "無法儲存這個使用者名稱。請檢查後重試。",
  },
};
