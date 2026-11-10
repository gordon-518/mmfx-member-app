import type { Messages } from "../types";

// Locked feature pages, the lock veil and the members-only panel. Compliance:
// say what each tool is, never what it earns.
export const locked: Messages["locked"] = {
  features: {
    indicators: {
      eyebrow: "工具 · TradingView",
      title: "指标",
      pitch: "MM 体系的邀请制 TradingView 指标，直接授权到你的 TradingView 用户名。",
      points: {
        p1: "自动趋势线、枢轴点和多周期视图",
        p2: "在你自己的 TradingView 图表上使用",
        p3: "自动开通权限",
      },
    },
    strategies: {
      eyebrow: "工具 · TradingView",
      title: "策略",
      pitch: "可回测的 TradingView 策略脚本，把 MM 体系的规则写成代码。",
      points: {
        p1: "自己用历史数据检验这些规则",
        p2: "课程中的入场模型，写成代码",
        p3: "在你自己的 TradingView 图表上使用",
      },
    },
    library: {
      eyebrow: "教育 · 资料库",
      title: "MM 资料库",
      pitch: "四本 MM 电子书：这套体系、它的实战手册以及背后的思路。",
      points: {
        p1: "MM 体系的完整文字版",
        p2: "可以放在图表旁边随时翻阅的手册",
        p3: "下载后可离线阅读",
      },
    },
    "live-classes": {
      eyebrow: "教育 · 直播",
      title: "直播课程",
      pitch: "与 MM Desk 一起看图，随着行情变化实时解读市场。",
      points: {
        p1: "与 MM Desk 一起实时看图",
        p2: "边看边提问",
        p3: "往期课程回放",
      },
    },
    "fundamental-desk": {
      eyebrow: "机器人 · 宏观",
      title: "Fundamental Desk",
      pitch: "黄金的实时宏观解读：用通俗易懂的方式讲清推动 XAU/USD 的基本面。",
      points: {
        p1: "今天是什么在推动黄金，原因是什么",
        p2: "利率、美元和风险情绪，一次看懂",
        p3: "在交易时段内持续更新",
      },
    },
    "ai-trading-assistant": {
      eyebrow: "Team MM · AI",
      title: "AI 交易助手",
      pitch: "连接你的交易账户，获得一位按照 MM 体系复盘你每一笔交易的教练。",
      points: {
        p1: "每一笔交易都自动复盘",
        p2: "自动找出你交易中的规律",
        p3: "围绕 MM 体系打造",
      },
    },
    "team-mm": {
      eyebrow: "Team MM · 社群",
      title: "Team MM",
      pitch: "与 MM Desk 一起的私密 Team MM 频道。",
      points: {
        p1: "直接来自 MM Desk",
        p2: "仅限 Team MM 会员",
        p3: "在 Telegram 上",
      },
    },
  },
  fallbackTitle: "MM Desk 的这一部分尚未解锁",
  fallbackPitch: "为你的账户入金后即可开通。",
  openOnEvery: "所有方案均已开放",
  openNow: "你的方案现在可以使用",
  freeSignals: "信号频道",
  freeNews: "新闻",
  freeCourse: "课程 · 模块 1",
  membersOnly: "会员专享",
  membersTitle: "{feature} 仅限 MM 体系会员",
  perkTeam: "Team MM——私密 VIP 信号频道",
  perkJournal: "AI 交易日志",
  perkEas: "自动化 EA——即将推出",
  become: "成为会员",
  trialNote: "你正在免费试用——为你自己的经纪商账户入金即可解锁全部内容。",
  freeNote: "你目前使用免费方案——为你自己的经纪商账户入金即可解锁全部内容。",
  paidNote: "你目前是 {tier}——之前的入金都会累计计算，只需追加入金补足差额即可达到 {feature}。",
  paidTitle: "{feature} 是最高等级",
  paidCta: "追加入金，升级到 {feature}",
};
