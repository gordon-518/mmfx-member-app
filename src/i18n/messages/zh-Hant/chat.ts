import type { Messages } from "../types";

// The in-app help chat. The assistant's own replies are written by the model
// in the member's language; these are the panel's words.
export const chat: Messages["chat"] = {
  open: "問 MMFX",
  openAria: "開啟幫助聊天",
  close: "關閉聊天",
  title: "問 MMFX",
  subtitle: "關於應用程式和會員資格的問題，幾秒內解答。需要時由真人接手。",
  greeting: "你好！我可以幫你解答關於應用程式、你的方案、入金和各種工具的問題。你想了解什麼？",
  suggestions: {
    tiers: "等級是怎麼運作的？",
    indicators: "怎樣取得指標？",
    start: "我應該從哪裡開始？",
    deposit: "怎樣提交入金？",
  },
  placeholder: "輸入你的問題…",
  send: "傳送",
  sending: "傳送中…",
  you: "你",
  assistant: "MMFX 助手",
  team: "MMFX 團隊",
  handoff: "我已將這個問題轉交給團隊。會有真人在這裡回覆你，通常在新加坡辦公時間內。",
  resolved: "團隊已處理完畢。如果你還有其他問題，助手已經回來了。",
  waiting: "團隊已收到你的訊息，會在這裡回覆你。",
  thinking: "思考中…",
  noAdvice: "助手負責解答關於應用程式和會員資格的問題，不提供交易建議。",
  errors: {
    rate_limited: "你傳送訊息太快了。請稍等一分鐘再試。",
    invalid: "每則訊息最多 1,000 個字元。",
    server: "出了點問題。請稍後重試。",
    busy: "還在回覆你的上一則訊息，請稍等。",
    unauthorized: "你的登入已過期。請重新登入後繼續聊天。",
  },
  privacy: "請勿在這裡分享密碼或驗證碼。團隊絕不會向你索取。",
  unread: "團隊有新回覆",
};
