import type { Messages } from "../types";

// The library page. Book titles are the PDFs' own (English) titles and stay
// as they are; categories and blurbs are by key / slug.
export const library: Messages["library"] = {
  eyebrow: "資料庫 · {n} 本電子書",
  title: "MM 資料庫",
  subtitle: "這套體系的文字版和參考資料——可在瀏覽器中閱讀或下載。與課程搭配使用；交易時把速查表放在手邊。",
  contentNote: "電子書以英文撰寫。",
  flagship: "核心之作 · {category}",
  rest: "書架上的其他書",
  read: "閱讀",
  download: "下載",
  readInBrowser: "在瀏覽器中閱讀",
  downloadPdf: "下載 PDF",
  categories: {
    complete: "完整體系",
    core: "核心",
    quickStart: "快速上手",
  },
  books: {
    "mm-system-ebook": {
      blurb: "完整的文字版體系，從頭到尾——工作流程的每個階段都匯集在一本可以反覆查閱的參考書裡。",
      inside: {
        a: "方向 → 區域 → 觸發 → 風險 → 管理",
        b: "黃金（XAU/USD）實例講解",
        c: "完整的決策框架，從頭到尾",
      },
    },
    "five-stage-workflow": {
      blurb: "MM 體系從頭到尾——方向、區域、觸發、風險、管理。",
    },
    "decision-trees-invalidation": {
      blurb: "當交易邏輯失效時——停損放在哪裡，以及為什麼。",
    },
    "cheat-sheets-quick-reference": {
      blurb: "MM Desk 的速查資料：交易時段、關鍵價位和檢查清單。",
    },
  },
};
