import type { Messages } from "../types";

// The syllabus in every language. The lessons themselves are videos in English,
// so the technical terms the videos use (BOS, CHoCH, OB, FVG, OTE...) stay
// recognisable in every translation.
export const courseContent: Messages["courseContent"] = {
  levels: {
    Basic: "入門",
    Intermediate: "中級",
    Advanced: "進階",
  },
  modules: {
    m1: {
      title: "基礎",
      summary: "交易心態與黃金基礎",
    },
    m2: {
      title: "解讀價格",
      summary: "市場結構與核心概念",
    },
    m3: {
      title: "機構優勢",
      summary: "流動性與位移",
    },
    m4: {
      title: "建立方向判斷",
      summary: "由上而下的分析",
    },
    m5: {
      title: "進場模型",
      summary: "從日內框架到進場觸發",
    },
    m6: {
      title: "管理與日常流程",
      summary: "風險、新聞與你的每日 SOP",
    },
  },
  lessons: {
    "00-golden-mindset": {
      title: "黃金心態",
      description: "先有交易心態，再談交易技巧——紀律、耐心，以及穩定執行背後的心理。",
    },
    "01-xauusd-explained": {
      title: "認識 XAUUSD",
      description: "把黃金當作交易商品來認識——為什麼 XAUUSD 的走勢與外匯貨幣對不同。",
    },
    "02-what-moves-gold": {
      title: "什麼在推動黃金？",
      description: "黃金價格的總經驅動因素——美元、實質利率、風險情緒和地緣政治緊張局勢。",
    },
    "03-market-structure-pt1": {
      title: "市場結構（上）",
      description: "辨識更高的高點和更高的低點——如何僅憑價格行為判斷趨勢方向。",
    },
    "04-market-structure-pt2": {
      title: "市場結構（下）",
      description: "內部結構與外部結構，以及結構突破（BOS）與性質轉變（CHoCH）之間的關鍵區別。",
    },
    "05-core-concepts": {
      title: "MM 核心概念",
      description: "一覽 MM 體系的支柱——流動性、訂單塊（Order Block）、公允價值缺口（FVG）和位移（Displacement）。",
    },
    "06-liquidity-deep-dive": {
      title: "深入流動性",
      description: "機構訂單藏在哪裡——買方/賣方流動性、等高/等低點，以及如何即時發現流動性掃蕩（Sweep）。",
    },
    "07-displacement-mastery": {
      title: "精通位移",
      description: "如何區分真正的機構意圖與市場雜訊——K 線實體大小、連續 K 線、FVG 和結構突破。",
    },
    "08-daily-bias-pt1": {
      title: "每日方向判斷（上）",
      description: "判斷當日方向——在日線和 4 小時圖上標出外部流動性，並確定你的目標。",
    },
    "09-daily-bias-pt2": {
      title: "每日方向判斷（下）",
      description: "時間週期的一致性、失效價位，以及高級別週期出現分歧時該怎麼做。",
    },
    "10-15m-decision": {
      title: "15 分鐘決策框架",
      description: "15 分鐘圖的操作手冊——趨勢日與反轉日的區分，以及如何標出你的進場區域（OB/FVG）。",
    },
    "11-5m-confirmation": {
      title: "5 分鐘確認框架",
      description: "等待 15 分鐘區域內出現帶位移的 5 分鐘 CHoCH——這是你切換到 1 分鐘圖的「許可證」。",
    },
    "12-sessions": {
      title: "交易時段與時間",
      description: "亞洲盤吸籌、倫敦盤操縱、紐約盤派發——以及擊殺區（Kill Zones）。",
    },
    "13-1m-execution": {
      title: "1 分鐘執行框架",
      description: "最終進場觸發——在最佳進場區（OTE）內出現 1 分鐘 CHoCH 或確認訊號。",
    },
    "14-breaker-blocks": {
      title: "精通突破塊（Breaker Block）",
      description: "失效後角色反轉的訂單塊——整個 MM 體系中勝率最高的區域之一。",
    },
    "15-news-macro": {
      title: "新聞、總經與地緣政治因素",
      description: "如何應對 CPI、FOMC、NFP 和地緣政治衝擊——事件前準備、停止交易的規則，以及何時選擇觀望。",
    },
    "16-trade-management": {
      title: "交易管理",
      description: "保本觸發、部分停利、移動停損和加碼——如何讓獲利單繼續奔跑而不把利潤吐回去。",
    },
    "17-complete-workflow": {
      title: "完整工作流程",
      description: "從空白圖表到平倉的每一步——在一堂課中完整示範 MM 體系。",
    },
    "18-daily-sop": {
      title: "你的每日 SOP",
      description: "每個交易日的 8 步固定流程——標記、定方向、分類、等待、確認、執行、管理、記錄。",
    },
  },
};
