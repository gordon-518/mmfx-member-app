import type { Messages } from "../types";

export const dimensions: Messages["dimensions"] = {
  risk_discipline: {
    name: "風險紀律",
    lowPole: "魯莽",
    highPole: "自律",
    short: "風險",
  },
  emotional_control: {
    name: "情緒控制",
    lowPole: "容易上頭",
    highPole: "沉著冷靜",
    short: "情緒",
  },
  independent_conviction: {
    name: "獨立判斷",
    lowPole: "依賴他人",
    highPole: "獨立自主",
    short: "判斷",
  },
  decisiveness: {
    name: "果斷性",
    lowPole: "猶豫不決",
    highPole: "果斷",
    short: "果斷",
  },
  consistency: {
    name: "一致性",
    lowPole: "頻繁換系統",
    highPole: "堅持到底",
    short: "一致",
  },
  process_routine: {
    name: "流程與習慣",
    lowPole: "隨性而為",
    highPole: "按流程執行",
    short: "流程",
  },
};
