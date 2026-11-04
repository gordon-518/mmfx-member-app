import type { EmailMessages } from "./types";

// The member emails in Traditional Chinese: the same shape as en.ts. "MM Desk",
// "Fundamental Desk" and the paid tier names stay in English, and the terms
// match the app's zh-Hant dictionaries (src/i18n/messages/zh-Hant).
export const zhHant: EmailMessages = {
  common: {
    hi: "{name}，你好：",
    hiNoName: "你好：",
    signoff: "— Don，Market Makers FX",
    bias: { bullish: "看漲", bearish: "看跌", neutral: "中性" },
    biasLine: "方向：{bias}",
    deskWritesEnglish: "MM Desk 的分析以英文撰寫。",
  },

  shell: {
    footerNote: "你收到這封郵件，是因為你擁有 Market Makers FX 帳戶。",
    unsubscribe: "取消訂閱",
    riskLine: "交易涉及風險，包括可能損失本金。本郵件的任何內容均不構成財務建議。",
    contextDay: "第 {day} 天 / 14",
    contextMember: "會員",
    contextDesk: "MM DESK · XAU/USD",
  },

  tracker: {
    title: "你的前 14 天",
    textTitle: "你的前 14 天：",
    today: "今天",
    day: "第 {day} 天",
    textDay: "（第 {day} 天）",
    done: "已完成",
    notDone: "尚未完成",
    steps: {
      analysis: "閱讀今天的每日分析",
      kys: "交易風格測評——3 分鐘",
      tv: "連接 TradingView",
      lesson1: "第 1 課——黃金心態",
      desk: "了解每個等級開通的內容",
    },
  },

  ladder: {
    rungs: {
      free: { name: "免費", amount: "無需入金", line: "每日分析、交易風格測評、經濟日曆、新聞、模組 1" },
      foundation: { name: "Foundation", amount: "$50", line: "完整課程和 MM 資料庫" },
      desk: { name: "Desk", amount: "$200", line: "指標、策略、直播課程、Fundamental Desk" },
      team: { name: "Team MM", amount: "$500", line: "Team MM 頻道和 AI 交易助手" },
    },
    note: "每個金額都是一筆入金，存入你在合作經紀商處的自有帳戶，以你的名義持有，也由你提取。",
  },

  lifecycle: {
    welcome: {
      copy: {
        subject: "從今天的黃金解讀開始",
        preheader: "一頁 XAU/USD 解讀，從日線圖開始推演。只需要三分鐘。",
        paragraphs: [
          "從這裡開始：開啟今天的每日分析。一頁黃金解讀，從日線圖開始由上而下推演。花三分鐘，你就會知道 MM Desk 在這個交易時段如何解讀價格。",
          "它每個交易日都會發布。MM Desk 不是課程庫，這份解讀是給你拿來質疑的，讓你形成自己的看法，而不是借用我們的。",
          "你的 14 天試用現已開通，不收你任何費用。我們是介紹經紀商（IB），你交易時，由經紀商向我們支付費用。任何入金都存入你自己的帳戶，以你的名義持有，始終屬於你。第 14 天之後，每日分析、交易風格測評和課程模組 1 仍然開放。",
        ],
        ctaLabel: "開啟今天的分析",
      },
      heroEyebrow: "歡迎來到 MM Desk",
      heroHeadline: "先讀懂市場。\n再據此行動。",
      todayRead: "今天的解讀是 {title}，方向{bias}。",
      todayReadNoBias: "今天的解讀是 {title}。",
      noRead: "今天的解讀會在亞洲盤期間發布。每天早上，第一件事就是看它。",
    },
    analysis: {
      copy: {
        subject: "今天的黃金解讀",
        preheader: "在交易時段開始前寫好。一段短影片、一份 PDF，以及正在關注的價位。",
        paragraphs: [
          "每個交易日早上，MM Desk 都會在交易時段開始前寫下對黃金的解讀。今天的解讀就在上方，附有它所依據的方向偏好。",
          "一段短影片和一份 PDF。隔夜價格停在哪裡，以及 MM Desk 正在關注的價位。",
          "你不必認同它。把它和你自己的圖表對照，看看兩者哪裡不同。",
        ],
        ctaLabel: "開啟今天的分析",
      },
      todayUp: "今天的解讀已經發布：{title}，方向{bias}。",
      noRead: "下一篇會在交易時段開始前發布。",
    },
    kys: {
      copy: {
        subject: "八種交易者類型，其中一種屬於你",
        preheader: "三分鐘的問題，然後是你最難在自己身上察覺的那個習慣。",
        paragraphs: [
          "交易風格測評會問你幾個簡短的問題，然後指出你的交易者類型。一共有八種，大約需要三分鐘。",
          "你會得到這種類型通常伴隨的一組習慣，包括大多數交易者在自己身上看不到的那一個。",
          "結果會一直為你保留。之後，你的主頁和等級頁面都會參考它，為你指出適合你實際交易方式的功課。",
        ],
        ctaLabel: "開始交易風格測評",
      },
    },
    tv: {
      copy: {
        subject: "你的 TradingView 使用者名稱",
        preheader: "TradingView 按使用者名稱開通權限，而你的使用者名稱是我們唯一還缺的一項。",
        paragraphs: [
          "十個 Market Makers 指標在我們這邊已經準備好了。TradingView 按使用者名稱開通權限，所以只差你的使用者名稱。",
          "在指標頁面新增你的使用者名稱。權限會自動開通，這十個指標會在一到三小時內出現在你的圖表上。",
          "只需填寫一個欄位，大約十秒鐘。在填好之前，指標的其他事情都無法推進。",
        ],
        ctaLabel: "新增你的使用者名稱",
      },
    },
    lesson1: {
      copy: {
        subject: "從「黃金心態」開始",
        preheader: "模組 1 的第一課。其餘十八堂課，可以留給那個永遠不會到來的週末。",
        paragraphs: [
          "十九堂課，這種數字很容易讓人一拖再拖。所以別管這個數字。今天只有一堂課。",
          "「黃金心態」是模組 1 的第一課。它是整個體系所依託的紀律，之後的所有內容都假定你已經具備。一段影片，旁邊附有投影片。",
          "無論是否入金，這裡的每個帳戶都開放模組 1。開啟這一課。看完就可以停下。",
        ],
        ctaLabel: "觀看「黃金心態」",
      },
    },
    ladder: {
      copy: {
        subject: "等級階梯，以及每一級開通的內容",
        preheader: "免費方案會一直保留每日分析。這些金額都是存入你自己帳戶的入金。",
        paragraphs: [
          "已經第九天了。下面是這裡的權限如何運作的全貌。不附帶任何推銷：看完就好，什麼都不用做。",
          "這些金額不是價格，也不是支付給 Market Makers 的費用。每一筆都是存入合作經紀商處交易帳戶的入金，帳戶以你的名義開設。資金由你持有、由你交易，也可以由你提取。",
          "你的累計入金決定你所在的等級，並按歷史最高值計算，所以回撤永遠不會讓你失去權限。免費方案完全無需入金，也保留每日分析、交易風格測評、經濟日曆和模組 1。",
        ],
        ctaLabel: "查看每一級開通的內容",
      },
    },
    day12: {
      copy: {
        subject: "第 14 天會關閉哪些內容",
        preheader: "每日分析、交易風格測評和模組 1 都會保留。不刪除任何內容，也不收取任何費用。",
        paragraphs: [
          "第 14 天，試用期結束。會關閉的有：十個 TradingView 指標、策略腳本、直播課程、Fundamental Desk，以及模組 1 之後的課程。",
          "完全無需入金也會保留的有：每個交易日的每日分析、交易風格測評、模組 1、經濟日曆、新聞資訊和公開訊號頻道。你仍然可以照常登入。",
          "免費方案以上的每一級，都是存入你在經紀商處自有交易帳戶的入金，帳戶以你的名義開設，由你交易、由你提取。等級頁面會列出每一級開通的內容。",
        ],
        ctaLabel: "查看每一級開通的內容",
      },
    },
    digest: {
      copy: {
        subject: "今日黃金：{bias}",
        preheader: "隔夜區間、MM Desk 正在關注的價位，以及它目前的判斷。",
        paragraphs: [],
        ctaLabel: "閱讀今天的分析",
      },
      keeps:
        "你的免費帳戶會一直開放每日分析，以及交易風格測評、經濟日曆、即時新聞和 MM 體系課程的模組 1。不需要做任何事，也不需要支付任何費用——每個交易日都在。",
      fallbackTitle: "今日 XAU/USD 解讀",
      fallbackHeadline: "MM Desk 今日的黃金解讀",
    },
    spotlight: {
      copy: {
        subject: "MM Desk 本週指南",
        preheader: "一篇完整的黃金解讀，從頭讀到尾。免費方案即可閱讀，無需入金。",
        paragraphs: [
          "本週的指南還沒有發布，所以先給你一直都在的那份：MM Desk 對黃金的解讀，每個交易日早上發布。",
          "隔夜價格停在哪裡、MM Desk 正在關注的價位，以及它所依據的方向偏好。無論你是否入金，它都在你的帳戶裡。",
        ],
        ctaLabel: "閱讀本週指南",
      },
      ladder:
        "本期指南的所有內容，都在你帳戶的免費部分裡。更高的等級從向你自己的交易帳戶入金 $50 起，等級頁面會說明每一級開通什麼。",
      fallbackCta: "開啟今天的分析",
      guideInEnglish: "本週指南以英文撰寫。",
    },
    upgradeSeen: {
      copy: {
        subject: "入金始終在你的名下",
        preheader: "這不是付給我們的錢，而是你在經紀商處的交易資金，由你持有，也由你提取。",
        paragraphs: [
          "你兩天前開啟了等級頁面，之後就停在了那裡。讓人猶豫的通常都是同一個問題，所以這裡直接說清楚。",
          "入金不是付給 Market Makers 的。它存入一個以你的名義開設、用你的帳號登入的交易帳戶。資金由你持有、由你交易，也可以由你提取。",
          "在我們這邊，它只用來決定你的等級。總額累計計算，並保持在歷史最高值，所以回撤永遠不會收回你已經擁有的權限。帶著這一點再看那個頁面，感覺會不一樣。",
        ],
        ctaLabel: "再看一次等級說明",
      },
    },
    brokerClicked: {
      copy: {
        subject: "經紀商表格填到一半",
        preheader: "Amelia 每天都在處理這類事情。告訴她你停在哪一步，接下來交給她。",
        paragraphs: [
          "你昨天開啟了經紀商開戶頁面，在中途停了下來。這種情況很常見，所以我們專門安排了一個人來幫忙。",
          "表格會要求提供身分證件和地址證明。上傳的檔案常常因為一些小問題被退回。表格也會問到你手邊沒有的東西。",
          "在 Telegram 上給 Admin Amelia 傳訊息，告訴她你停在了哪裡。她無法主動聯絡你，所以第一句話得由你來傳。如果你改變了主意，這樣回答也完全沒問題。你帳戶的免費部分會保持原樣。",
        ],
        ctaLabel: "聯絡 Admin Amelia",
      },
    },
    memberD3: {
      copy: {
        subject: "連接 AI 交易助手",
        preheader: "唯讀存取你已平倉的交易。只需連接一次，大約三分鐘。",
        paragraphs: [
          "你的等級已經包含 AI 交易助手。但在連接帳戶之前，它沒有任何資料可讀，所以它往往是那個一直沒被用過的功能。",
          "連接你的交易帳戶後，它會讀取你已平倉的交易，再把你自己的交易紀錄擺在你面前：你通常持倉多久，虧損一筆後的一小時裡你會做什麼，你反覆在做哪些交易設定。",
          "這個連接是唯讀的。它能看到帳戶的歷史紀錄，但不能下單、調整倉位或平倉。它讀到的交易越多就越有用，所以今天連接，比下個月再連接更有價值。",
        ],
        ctaLabel: "連接 AI 交易助手",
      },
      cardName: "AI 交易助手",
      cardLine: "唯讀。把你自己的交易紀錄擺在你面前。",
    },
    memberD7: {
      copy: {
        subject: "今天開啟 Fundamental Desk 看看",
        preheader: "本週真正在推動黃金的因素：美元、實質利率，以及日曆上的一項數據",
        paragraphs: [
          "一週下來，你已經找到了指標。Fundamental Desk 是較少被開啟的另一半，所以在這裡介紹給你。",
          "它用平實的方式解讀當前推動黃金的因素：美元、實質利率、各國央行釋放的訊號，以及本週日曆上真正重要的那一項。",
          "在下一個交易時段開始前開啟它。應用程式裡它的旁邊就是與 MM Desk 一起的直播課程，你的等級已經包含。",
        ],
        ctaLabel: "開啟 Fundamental Desk",
      },
      cardName: "Fundamental Desk",
      cardLine: "行情背後的宏觀格局，用平實的英文寫成。",
    },
    memberDormant: {
      copy: {
        subject: "今天的黃金解讀",
        preheader: "安靜一個月也沒關係。一篇解讀，三分鐘，不需要補看。",
        paragraphs: [
          "你的帳戶已經安靜了大約一個月。這封郵件不推銷任何東西。離開市場容易，回來卻難。",
          "MM Desk 每個交易日早上都照常在寫：黃金隔夜停在哪裡、它正在關注的價位、它所依據的方向偏好。一段短影片加一份 PDF，在交易時段開始前發布。",
          "從今天這一篇開始，不必補看整個月的。它已經在你的帳戶裡了。如果 Market Makers 已經不適合你，在下方取消訂閱即可，我們不會再打擾你。",
        ],
        ctaLabel: "開啟今天的分析",
      },
      cardName: "每日分析",
      cardLine: "MM Desk 對黃金的解讀，每個交易日早上發布。",
    },
  },

  deposit: {
    riskLine: "交易涉及風險，包括可能損失本金。不保證任何回報。",
    deposit: "入金",
    topUp: "追加入金",
    verified: {
      subject: "驗證通過：你的等級是 {tier}",
      body: "你的 {amount} {what}已通過驗證。你現在的等級是 {tier}，目前累計入金 {cumulative}，你的 MM Desk 現已開放。",
      unlocked: "你的等級包含的全部內容都已解鎖。開啟你的 MM Desk：{url}",
      cta: "開啟你的 MM Desk",
    },
    reminder: {
      subject: "你的 {amount} 入金只差最後一步",
      body: "你的 {amount} 入金正在審核中。還剩一步：在 Telegram 上給 {admin} 傳一則訊息。",
      why: "我們的管理員無法主動傳訊息給你，所以如果你的入金有任何需要核對的地方，我們就靠這則訊息聯絡你。",
      textLink: "傳訊息給 {admin}：{url}",
      cta: "在 Telegram 上給 {admin} 傳訊息",
      ref: "你的參考編號是 {ref}，已經寫在訊息裡了。",
    },
    rejected: {
      subject: "關於你提交的入金",
      body: "我們暫時還無法驗證你的 {amount} 入金：{reason}",
      text: "你可以在 {url} 重新提交，或者透過 WhatsApp 或 Telegram 聯絡我們，我們會和你一起把問題解決。",
      cta: "重新提交",
      other: "或者透過 WhatsApp 或 Telegram 聯絡我們，我們會和你一起把問題解決。",
    },
  },

  fundamental: {
    subject: "你的 {instrument} 基本面觀點",
    title: "MMFX Fundamental Dispatch",
    kicker: "Terminal Dispatch · Fundamental Desk",
    attached: "隨信附上你的 {instrument} 基本面觀點。",
    inside: "內容包括：眼下是哪些宏觀因素在推動這個品種——市場持倉、正在發揮作用的催化因素，以及它們指向的方向偏好。開啟附件中的 PDF，查看完整簡報。",
    compliance: "僅為基本面分析——不是交易訊號、目標價，也不是買入或賣出的指示。",
    footer: "你收到這封郵件，是因為你在 Market Makers FX 帳戶中向 Fundamental Desk 申請了一份副本。",
  },

  journal: {
    doThis: "接下來這樣做：",
    cta: "開啟你的 AI 交易助手",
    footerNote: "你收到這封郵件，是因為你在使用 Market Makers FX 記錄你的交易。",
  },
};
