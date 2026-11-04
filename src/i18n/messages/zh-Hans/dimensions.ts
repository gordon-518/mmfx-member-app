import type { Messages } from "../types";

export const dimensions: Messages["dimensions"] = {
  risk_discipline: {
    name: "风险纪律",
    lowPole: "鲁莽",
    highPole: "自律",
    short: "风险",
  },
  emotional_control: {
    name: "情绪控制",
    lowPole: "容易上头",
    highPole: "沉着冷静",
    short: "情绪",
  },
  independent_conviction: {
    name: "独立判断",
    lowPole: "依赖他人",
    highPole: "独立自主",
    short: "判断",
  },
  decisiveness: {
    name: "果断性",
    lowPole: "犹豫不决",
    highPole: "果断",
    short: "果断",
  },
  consistency: {
    name: "一致性",
    lowPole: "频繁换系统",
    highPole: "坚持到底",
    short: "一致",
  },
  process_routine: {
    name: "流程与习惯",
    lowPole: "随性而为",
    highPole: "按流程执行",
    short: "流程",
  },
};
