import type { Messages } from "../types";

// The guided tour's words, by step key (components/tour/steps.ts holds the
// structure: which element each stop points at).
export const tour: Messages["tour"] = {
  dialogLabel: "如何使用這個應用程式",
  close: "關閉導覽",
  stepOf: "第 {n} 步，共 {total} 步",
  steps: {
    intro: {
      title: "我帶你四處看看",
      body: "九個簡短的站點，大約兩分鐘。看完後你會知道每樣東西在哪裡、每個部分是做什麼的。你可以隨時離開。",
    },
    nav: {
      title: "所有內容都在這個選單裡",
      body: "整個交易台都在左側，按照你實際使用的方式分組：解讀市場、執行交易、管理倉位，以及支撐這三者的基礎。",
    },
    home: {
      title: "從這裡開始和主頁",
      body: "「從這裡開始」就是你現在所在的頁面：你的六個步驟和你的進度。主頁是你每天的起點——有什麼新內容，接下來該做什麼。",
    },
    read: {
      title: "解讀市場",
      body: "用這些開始一個交易時段。每日分析是交易台對黃金的解讀和關鍵價位；基本面分析台解讀十一個商品的總經面；新聞和經濟日曆告訴你接下來會發生什麼。",
    },
    execute: {
      title: "執行交易",
      body: "計畫變成交易的地方。訊號是交易台的交易訊號，指標把我們的工具放到你自己的 TradingView 圖表上，策略則是寫成腳本的交易體系。",
    },
    manage: {
      title: "管理倉位",
      body: "最難的部分，也是大多數帳戶虧損的地方。直播課程陪你一起交易，交易風格測評找出讓你付出代價的習慣，AI 交易助手複盤你的真實交易。",
    },
    foundations: {
      title: "基礎",
      body: "MM 體系課程——十九堂課，從交易心態到倉位管理——以及背後的文字資料庫。每當上面的內容看不懂時，就回到這裡。",
    },
    account: {
      title: "你的方案在這裡",
      body: "你的等級顯示在你的電子郵件下方。選單項目旁邊的鎖表示它在更高等級開放——點擊它，你可以在做任何決定之前看清裡面有什麼。",
    },
    steps: {
      title: "然後按清單逐一完成",
      body: "你的六個步驟，按順序排列，每一步都寫明它能帶給你什麼，以及完成後要達到的目標。一天一個就足夠了。",
    },
    done: {
      title: "這就是交易台",
      body: "你可以隨時透過「從這裡開始」頁面頂部的按鈕再次執行這個導覽。第一步是加入公開頻道——大約只需十秒鐘。",
    },
  },
};
