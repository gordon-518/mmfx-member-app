import type { Messages } from "../types";

// The library page. Book titles are the PDFs' own (English) titles and stay
// as they are; categories and blurbs are by key / slug.
export const library: Messages["library"] = {
  eyebrow: "资料库 · {n} 本电子书",
  title: "MM 资料库",
  subtitle: "这套体系的文字版和参考资料——可在浏览器中阅读或下载。与课程配套使用；交易时把速查表放在手边。",
  contentNote: "电子书以英文撰写。",
  flagship: "核心之作 · {category}",
  rest: "书架上的其他书",
  read: "阅读",
  download: "下载",
  readInBrowser: "在浏览器中阅读",
  downloadPdf: "下载 PDF",
  categories: {
    complete: "完整体系",
    core: "核心",
    quickStart: "快速上手",
  },
  books: {
    "mm-system-ebook": {
      blurb: "完整的文字版体系，从头到尾——工作流程的每个阶段都汇集在一本可以反复查阅的参考书里。",
      inside: {
        a: "方向 → 区域 → 触发 → 风险 → 管理",
        b: "黄金（XAU/USD）实例讲解",
        c: "完整的决策框架，从头到尾",
      },
    },
    "five-stage-workflow": {
      blurb: "MM 体系从头到尾——方向、区域、触发、风险、管理。",
    },
    "decision-trees-invalidation": {
      blurb: "当交易逻辑失效时——止损放在哪里，以及为什么。",
    },
    "cheat-sheets-quick-reference": {
      blurb: "MM Desk 的速查资料：交易时段、关键价位和检查清单。",
    },
  },
};
