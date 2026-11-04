import type { Messages } from "../types";

// The eight Know Your Style archetypes, keyed by the ID profiles.kys_archetype
// stores. The English matches src/lib/kys/archetypes.json, which still feeds the
// report prompt (a test keeps the two in step). keystone* is the archetype's
// first "next move" button.
export const archetypes: Messages["archetypes"] = {
  reckless_gambler: {
    name: "鲁莽赌徒",
    keystoneLabel: "管理与日常流程模块",
    keystoneWhy: "先建立风险规则——在做任何事之前，先固定仓位、设好硬止损。",
  },
  analysis_paralyser: {
    name: "分析瘫痪者",
    keystoneLabel: "回测一个策略",
    keystoneWhy: "证明你的规则行得通，别再苛求永远不会出现的确定性。",
  },
  signal_dependent: {
    name: "信号依赖者",
    keystoneLabel: "开始学习 MM 体系课程",
    keystoneWhy: "把跟单变成一项真正属于你的技能。",
  },
  indicator_stacker: {
    name: "指标堆叠者",
    keystoneLabel: "解读价格模块",
    keystoneWhy: "依据清晰的结构交易，而不是一堆互相矛盾的指标。",
  },
  emotional_revenge_trader: {
    name: "情绪化报复交易者",
    keystoneLabel: "阅读 If-Then 电子书",
    keystoneWhy: "提前定好你的反应，让一次亏损无法左右你。",
  },
  news_trader: {
    name: "新闻交易者",
    keystoneLabel: "经济日历",
    keystoneWhy: "围绕关键催化事件做计划，而不是追逐每一条头条。",
  },
  system_hopper: {
    name: "频繁换系统者",
    keystoneLabel: "专注一套体系",
    keystoneWhy: "一套框架，坚持交易足够久，经验才会真正积累起来。",
  },
  brand_new_beginner: {
    name: "纯新手",
    keystoneLabel: "从「基础」模块开始",
    keystoneWhy: "在投入任何真金白银之前，先打好基础。",
  },
};
