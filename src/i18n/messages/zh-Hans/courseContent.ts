import type { Messages } from "../types";

// The syllabus in every language. The lessons themselves are videos in English,
// so the technical terms the videos use (BOS, CHoCH, OB, FVG, OTE...) stay
// recognisable in every translation.
export const courseContent: Messages["courseContent"] = {
  levels: {
    Basic: "入门",
    Intermediate: "中级",
    Advanced: "进阶",
  },
  modules: {
    m1: {
      title: "基础",
      summary: "交易心态与黄金基础",
    },
    m2: {
      title: "解读价格",
      summary: "市场结构与核心概念",
    },
    m3: {
      title: "机构优势",
      summary: "流动性与位移",
    },
    m4: {
      title: "建立方向判断",
      summary: "自上而下的分析",
    },
    m5: {
      title: "入场模型",
      summary: "从日内框架到入场触发",
    },
    m6: {
      title: "管理与日常流程",
      summary: "风险、新闻与你的每日 SOP",
    },
  },
  lessons: {
    "00-golden-mindset": {
      title: "黄金心态",
      description: "先有交易心态，再谈交易技巧——纪律、耐心，以及稳定执行背后的心理。",
    },
    "01-xauusd-explained": {
      title: "认识 XAUUSD",
      description: "把黄金当作交易品种来认识——为什么 XAUUSD 的走势与外汇货币对不同。",
    },
    "02-what-moves-gold": {
      title: "什么在推动黄金？",
      description: "黄金价格的宏观驱动因素——美元、实际利率、风险情绪和地缘政治紧张局势。",
    },
    "03-market-structure-pt1": {
      title: "市场结构（上）",
      description: "识别更高的高点和更高的低点——如何仅凭价格行为判断趋势方向。",
    },
    "04-market-structure-pt2": {
      title: "市场结构（下）",
      description: "内部结构与外部结构，以及结构突破（BOS）与性质转变（CHoCH）之间的关键区别。",
    },
    "05-core-concepts": {
      title: "MM 核心概念",
      description: "一览 MM 体系的支柱——流动性、订单块（Order Block）、公允价值缺口（FVG）和位移（Displacement）。",
    },
    "06-liquidity-deep-dive": {
      title: "深入流动性",
      description: "机构订单藏在哪里——买方/卖方流动性、等高/等低点，以及如何实时发现流动性扫荡（Sweep）。",
    },
    "07-displacement-mastery": {
      title: "精通位移",
      description: "如何区分真正的机构意图与市场噪音——K 线实体大小、连续 K 线、FVG 和结构突破。",
    },
    "08-daily-bias-pt1": {
      title: "每日方向判断（上）",
      description: "判断当日方向——在日线和 4 小时图上标出外部流动性，并确定你的目标。",
    },
    "09-daily-bias-pt2": {
      title: "每日方向判断（下）",
      description: "时间周期的一致性、失效价位，以及高级别周期出现分歧时该怎么做。",
    },
    "10-15m-decision": {
      title: "15 分钟决策框架",
      description: "15 分钟图的操作手册——趋势日与反转日的区分，以及如何标出你的入场区域（OB/FVG）。",
    },
    "11-5m-confirmation": {
      title: "5 分钟确认框架",
      description: "等待 15 分钟区域内出现带位移的 5 分钟 CHoCH——这是你切换到 1 分钟图的“许可证”。",
    },
    "12-sessions": {
      title: "交易时段与时间",
      description: "亚洲盘吸筹、伦敦盘操纵、纽约盘派发——以及击杀区（Kill Zones）。",
    },
    "13-1m-execution": {
      title: "1 分钟执行框架",
      description: "最终入场触发——在最佳入场区（OTE）内出现 1 分钟 CHoCH 或确认信号。",
    },
    "14-breaker-blocks": {
      title: "精通突破块（Breaker Block）",
      description: "失效后角色反转的订单块——整个 MM 体系中概率最高的区域之一。",
    },
    "15-news-macro": {
      title: "新闻、宏观与地缘政治因素",
      description: "如何应对 CPI、FOMC、NFP 和地缘政治冲击——事件前准备、停止交易的规则，以及何时选择观望。",
    },
    "16-trade-management": {
      title: "交易管理",
      description: "保本触发、部分止盈、移动止损和加仓——如何让盈利单继续奔跑而不把利润吐回去。",
    },
    "17-complete-workflow": {
      title: "完整工作流程",
      description: "从空白图表到平仓的每一步——在一节课中完整演示 MM 体系。",
    },
    "18-daily-sop": {
      title: "你的每日 SOP",
      description: "每个交易日的 8 步固定流程——标记、定方向、分类、等待、确认、执行、管理、记录。",
    },
  },
};
