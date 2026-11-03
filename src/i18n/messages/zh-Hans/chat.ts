import type { Messages } from "../types";

// The in-app help chat. The assistant's own replies are written by the model
// in the member's language; these are the panel's words.
export const chat: Messages["chat"] = {
  open: "问 MMFX",
  openAria: "打开帮助聊天",
  close: "关闭聊天",
  title: "问 MMFX",
  subtitle: "关于应用和会员资格的问题，几秒内解答。需要时由真人接手。",
  greeting: "你好！我可以帮你解答关于应用、你的方案、入金和各种工具的问题。你想了解什么？",
  suggestions: {
    tiers: "等级是怎么运作的？",
    indicators: "怎样获得指标？",
    start: "我应该从哪里开始？",
    deposit: "怎样提交入金？",
  },
  placeholder: "输入你的问题…",
  send: "发送",
  sending: "发送中…",
  you: "你",
  assistant: "MMFX 助手",
  team: "MMFX 团队",
  handoff: "我已将这个问题转交给团队。会有真人在这里回复你，通常在新加坡办公时间内。",
  resolved: "团队已处理完毕。如果你还有其他问题，助手已经回来了。",
  waiting: "团队已收到你的消息，会在这里回复你。",
  thinking: "思考中…",
  noAdvice: "助手负责解答关于应用和会员资格的问题，不提供交易建议。",
  errors: {
    rate_limited: "你发送消息太快了。请稍等一分钟再试。",
    invalid: "每条消息最多 1,000 个字符。",
    server: "出了点问题。请稍后重试。",
    unauthorized: "你的登录已过期。请重新登录后继续聊天。",
  },
  unread: "团队有新回复",
};
