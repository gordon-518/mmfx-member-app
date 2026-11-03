import type { Messages } from "../types";

export const rails: Messages["rails"] = {
  stages: {
    s1: {
      label: "分析",
      tagline: "解读市场",
    },
    s2: {
      label: "执行",
      tagline: "寻找并执行交易",
    },
    s3: {
      label: "交易管理",
      tagline: "管理仓位",
    },
  },
  cards: {
    "daily-analysis": {
      title: "每日分析",
      blurb: "按交易时段解读黄金",
    },
    "fundamental-desk": {
      title: "基本面分析台",
      blurb: "XAU/USD 实时宏观解读",
    },
    signals: {
      title: "交易信号",
      blurb: "高确信度的交易信号",
    },
    indicators: {
      title: "指标",
      blurb: "{n} 个 TradingView 工具",
    },
    strategies: {
      title: "策略",
      blurb: "可回测的交易设置",
    },
    "live-classes": {
      title: "直播课程",
      blurb: "与交易台一起实时看图",
    },
    "know-your-style": {
      title: "交易风格测评",
      blurb: "找出你的交易者类型",
    },
    "ai-trading-assistant": {
      title: "AI 交易助手",
      blurb: "检视你的真实交易，找出漏洞",
    },
    course: {
      title: "MM 体系课程",
      blurb: "从入门到进阶 · {n} 节课",
    },
    library: {
      title: "电子书资料库",
      blurb: "成文的体系与参考资料",
    },
  },
};
