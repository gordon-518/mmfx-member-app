import type { EmailMessages } from "./types";

// The member emails in Simplified Chinese: the same shape as en.ts. "MM Desk",
// "Fundamental Desk" and the paid tier names stay in English, and the terms
// match the app's zh-Hans dictionaries (src/i18n/messages/zh-Hans).
export const zhHans: EmailMessages = {
  common: {
    hi: "{name}，你好：",
    hiNoName: "你好：",
    signoff: "— Don，Market Makers FX",
    bias: { bullish: "看涨", bearish: "看跌", neutral: "中性" },
    biasLine: "方向：{bias}",
    deskWritesEnglish: "MM Desk 的分析以英文撰写。",
  },

  shell: {
    footerNote: "你收到这封邮件，是因为你拥有 Market Makers FX 账户。",
    unsubscribe: "退订",
    riskLine: "交易涉及风险，包括可能损失本金。本邮件的任何内容均不构成财务建议。",
    contextDay: "第 {day} 天 / 14",
    contextMember: "会员",
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
      analysis: "阅读今天的每日分析",
      kys: "交易风格测评——3 分钟",
      tv: "连接 TradingView",
      lesson1: "第 1 课——黄金心态",
      desk: "了解每个等级开通的内容",
    },
  },

  ladder: {
    rungs: {
      free: { name: "免费", amount: "无需入金", line: "每日分析、交易风格测评、经济日历、新闻、模块 1" },
      foundation: { name: "Foundation", amount: "$50", line: "完整课程和 MM 资料库" },
      desk: { name: "Desk", amount: "$200", line: "指标、策略、直播课程、Fundamental Desk" },
      team: { name: "Team MM", amount: "$500", line: "Team MM 频道和 AI 交易助手" },
    },
    note: "每个金额都是一笔入金，存入你在合作经纪商处的自有账户，以你的名义持有，也由你提取。",
  },

  lifecycle: {
    welcome: {
      copy: {
        subject: "从今天的黄金解读开始",
        preheader: "一页 XAU/USD 解读，从日线图开始推演。只需要三分钟。",
        paragraphs: [
          "从这里开始：打开今天的每日分析。一页黄金解读，从日线图开始自上而下推演。花三分钟，你就会知道 MM Desk 在这个交易时段如何解读价格。",
          "它每个交易日都会发布。MM Desk 不是课程库，这份解读是给你拿来质疑的，让你形成自己的看法，而不是借用我们的。",
          "你的 14 天试用现已开通，不收你任何费用。我们是介绍经纪商（IB），你交易时，由经纪商向我们支付费用。任何入金都存入你自己的账户，以你的名义持有，始终属于你。第 14 天之后，每日分析、交易风格测评和课程模块 1 仍然开放。",
        ],
        ctaLabel: "打开今天的分析",
      },
      heroEyebrow: "欢迎来到 MM Desk",
      heroHeadline: "先读懂市场。\n再据此行动。",
      todayRead: "今天的解读是 {title}，方向{bias}。",
      todayReadNoBias: "今天的解读是 {title}。",
      noRead: "今天的解读会在亚洲盘期间发布。每天早上，第一件事就是看它。",
    },
    analysis: {
      copy: {
        subject: "今天的黄金解读",
        preheader: "在交易时段开始前写好。一段短视频、一份 PDF，以及正在关注的价位。",
        paragraphs: [
          "每个交易日早上，MM Desk 都会在交易时段开始前写下对黄金的解读。今天的解读就在上方，附有它所依据的方向偏好。",
          "一段短视频和一份 PDF。隔夜价格停在哪里，以及 MM Desk 正在关注的价位。",
          "你不必认同它。把它和你自己的图表对照，看看两者哪里不同。",
        ],
        ctaLabel: "打开今天的分析",
      },
      todayUp: "今天的解读已经发布：{title}，方向{bias}。",
      noRead: "下一篇会在交易时段开始前发布。",
    },
    kys: {
      copy: {
        subject: "八种交易者类型，其中一种属于你",
        preheader: "三分钟的问题，然后是你最难在自己身上察觉的那个习惯。",
        paragraphs: [
          "交易风格测评会问你几个简短的问题，然后指出你的交易者类型。一共有八种，大约需要三分钟。",
          "你会得到这种类型通常伴随的一组习惯，包括大多数交易者在自己身上看不到的那一个。",
          "结果会一直为你保留。之后，你的主页和等级页面都会参考它，为你指出适合你实际交易方式的功课。",
        ],
        ctaLabel: "开始交易风格测评",
      },
    },
    tv: {
      copy: {
        subject: "你的 TradingView 用户名",
        preheader: "TradingView 按用户名开通权限，而你的用户名是我们唯一还缺的一项。",
        paragraphs: [
          "十个 Market Makers 指标在我们这边已经准备好了。TradingView 按用户名开通权限，所以只差你的用户名。",
          "在指标页面添加你的用户名。权限会自动开通，这十个指标会在一到三小时内出现在你的图表上。",
          "只需填写一项，大约十秒钟。在填好之前，指标的其他事情都无法推进。",
        ],
        ctaLabel: "添加你的用户名",
      },
    },
    lesson1: {
      copy: {
        subject: "从“黄金心态”开始",
        preheader: "模块 1 的第一课。其余十八节课，可以留给那个永远不会到来的周末。",
        paragraphs: [
          "十九节课，这种数字很容易让人一拖再拖。所以别管这个数字。今天只有一节课。",
          "“黄金心态”是模块 1 的第一课。它是整个体系所依托的纪律，之后的所有内容都假定你已经具备。一段视频，旁边配有幻灯片。",
          "无论是否入金，这里的每个账户都开放模块 1。打开这一课。看完就可以停下。",
        ],
        ctaLabel: "观看“黄金心态”",
      },
    },
    ladder: {
      copy: {
        subject: "等级阶梯，以及每一级开通的内容",
        preheader: "免费方案会一直保留每日分析。这些金额都是存入你自己账户的入金。",
        paragraphs: [
          "已经第九天了。下面是这里的权限如何运作的全貌。不附带任何推销：看完就好，什么都不用做。",
          "这些金额不是价格，也不是支付给 Market Makers 的费用。每一笔都是存入合作经纪商处交易账户的入金，账户以你的名义开设。资金由你持有、由你交易，也可以由你提取。",
          "你的累计入金决定你所在的等级，并按历史最高值计算，所以回撤永远不会让你失去权限。免费方案完全无需入金，也保留每日分析、交易风格测评、经济日历和模块 1。",
        ],
        ctaLabel: "查看每一级开通的内容",
      },
    },
    day12: {
      copy: {
        subject: "第 14 天会关闭哪些内容",
        preheader: "每日分析、交易风格测评和模块 1 都会保留。不删除任何内容，也不收取任何费用。",
        paragraphs: [
          "第 14 天，试用期结束。会关闭的有：十个 TradingView 指标、策略脚本、直播课程、Fundamental Desk，以及模块 1 之后的课程。",
          "完全无需入金也会保留的有：每个交易日的每日分析、交易风格测评、模块 1、经济日历、新闻资讯和公开信号频道。你仍然可以照常登录。",
          "免费方案以上的每一级，都是存入你在经纪商处自有交易账户的入金，账户以你的名义开设，由你交易、由你提取。等级页面会列出每一级开通的内容。",
        ],
        ctaLabel: "查看每一级开通的内容",
      },
    },
    digest: {
      copy: {
        subject: "今日黄金：{bias}",
        preheader: "隔夜区间、MM Desk 正在关注的价位，以及它目前的判断。",
        paragraphs: [],
        ctaLabel: "阅读今天的分析",
      },
      keeps:
        "你的免费账户会一直开放每日分析，以及交易风格测评、经济日历、实时新闻和 MM 体系课程的模块 1。不需要做任何事，也不需要支付任何费用——每个交易日都在。",
      fallbackTitle: "今日 XAU/USD 解读",
      fallbackHeadline: "MM Desk 今日的黄金解读",
    },
    spotlight: {
      copy: {
        subject: "MM Desk 本周指南",
        preheader: "一篇完整的黄金解读，从头读到尾。免费方案即可阅读，无需入金。",
        paragraphs: [
          "本周的指南还没有发布，所以先给你一直都在的那份：MM Desk 对黄金的解读，每个交易日早上发布。",
          "隔夜价格停在哪里、MM Desk 正在关注的价位，以及它所依据的方向偏好。无论你是否入金，它都在你的账户里。",
        ],
        ctaLabel: "阅读本周指南",
      },
      ladder:
        "本期指南的所有内容，都在你账户的免费部分里。更高的等级从向你自己的交易账户入金 $50 起，等级页面会说明每一级开通什么。",
      fallbackCta: "打开今天的分析",
      guideInEnglish: "本周指南以英文撰写。",
    },
    upgradeSeen: {
      copy: {
        subject: "入金始终在你的名下",
        preheader: "这不是付给我们的钱，而是你在经纪商处的交易资金，由你持有，也由你提取。",
        paragraphs: [
          "你两天前打开了等级页面，之后就停在了那里。让人犹豫的通常都是同一个问题，所以这里直接说清楚。",
          "入金不是付给 Market Makers 的。它存入一个以你的名义开设、用你的账号登录的交易账户。资金由你持有、由你交易，也可以由你提取。",
          "在我们这边，它只用来决定你的等级。总额累计计算，并保持在历史最高值，所以回撤永远不会收回你已经拥有的权限。带着这一点再看那个页面，感觉会不一样。",
        ],
        ctaLabel: "再看一次等级说明",
      },
    },
    brokerClicked: {
      copy: {
        subject: "经纪商表格填到一半",
        preheader: "Amelia 每天都在处理这类事情。告诉她你停在哪一步，接下来交给她。",
        paragraphs: [
          "你昨天打开了经纪商开户页面，在中途停了下来。这种情况很常见，所以我们专门安排了一个人来帮忙。",
          "表格会要求提供身份证件和地址证明。上传的文件常常因为一些小问题被退回。表格也会问到你手边没有的东西。",
          "在 Telegram 上给 Admin Amelia 发消息，告诉她你停在了哪里。她无法主动联系你，所以第一句话得由你来发。如果你改变了主意，这样回答也完全没问题。你账户的免费部分会保持原样。",
        ],
        ctaLabel: "联系 Admin Amelia",
      },
    },
    memberD3: {
      copy: {
        subject: "连接 AI 交易助手",
        preheader: "只读访问你已平仓的交易。只需连接一次，大约三分钟。",
        paragraphs: [
          "你的等级已经包含 AI 交易助手。但在连接账户之前，它没有任何数据可读，所以它往往是那个一直没被用过的功能。",
          "连接你的交易账户后，它会读取你已平仓的交易，再把你自己的交易记录摆在你面前：你通常持仓多久，亏损一笔后的一小时里你会做什么，你反复在做哪些交易设置。",
          "这个连接是只读的。它能看到账户的历史记录，但不能下单、调整仓位或平仓。它读到的交易越多就越有用，所以今天连接，比下个月再连接更有价值。",
        ],
        ctaLabel: "连接 AI 交易助手",
      },
      cardName: "AI 交易助手",
      cardLine: "只读。把你自己的交易记录摆在你面前。",
    },
    memberD7: {
      copy: {
        subject: "今天打开 Fundamental Desk 看看",
        preheader: "本周真正在推动黄金的因素：美元、实际利率，以及日历上的一项数据",
        paragraphs: [
          "一周下来，你已经找到了指标。Fundamental Desk 是较少被打开的另一半，所以在这里介绍给你。",
          "它用平实的方式解读当前推动黄金的因素：美元、实际利率、各国央行释放的信号，以及本周日历上真正重要的那一项。",
          "在下一个交易时段开始前打开它。应用里它的旁边就是与 MM Desk 一起的直播课程，你的等级已经包含。",
        ],
        ctaLabel: "打开 Fundamental Desk",
      },
      cardName: "Fundamental Desk",
      cardLine: "行情背后的宏观格局，用平实的英文写成。",
    },
    memberDormant: {
      copy: {
        subject: "今天的黄金解读",
        preheader: "安静一个月也没关系。一篇解读，三分钟，不需要补看。",
        paragraphs: [
          "你的账户已经安静了大约一个月。这封邮件不推销任何东西。离开市场容易，回来却难。",
          "MM Desk 每个交易日早上都照常在写：黄金隔夜停在哪里、它正在关注的价位、它所依据的方向偏好。一段短视频加一份 PDF，在交易时段开始前发布。",
          "从今天这一篇开始，不必补看整个月的。它已经在你的账户里了。如果 Market Makers 已经不适合你，在下方退订即可，我们不会再打扰你。",
        ],
        ctaLabel: "打开今天的分析",
      },
      cardName: "每日分析",
      cardLine: "MM Desk 对黄金的解读，每个交易日早上发布。",
    },
  },

  deposit: {
    riskLine: "交易涉及风险，包括可能损失本金。不保证任何回报。",
    deposit: "入金",
    topUp: "追加入金",
    verified: {
      subject: "验证通过：你的等级是 {tier}",
      body: "你的 {amount} {what}已通过验证。你现在的等级是 {tier}，目前累计入金 {cumulative}，你的 MM Desk 现已开放。",
      unlocked: "你的等级包含的全部内容都已解锁。打开你的 MM Desk：{url}",
      cta: "打开你的 MM Desk",
    },
    reminder: {
      subject: "你的 {amount} 入金只差最后一步",
      body: "你的 {amount} 入金正在审核中。还剩一步：在 Telegram 上给 {admin} 发一条消息。",
      why: "我们的管理员无法主动给你发消息，所以如果你的入金有任何需要核对的地方，我们就靠这条消息联系你。",
      textLink: "给 {admin} 发消息：{url}",
      cta: "在 Telegram 上给 {admin} 发消息",
      ref: "你的参考编号是 {ref}，已经写在消息里了。",
    },
    rejected: {
      subject: "关于你提交的入金",
      body: "我们暂时还无法验证你的 {amount} 入金：{reason}",
      text: "你可以在 {url} 重新提交，或者通过 WhatsApp 或 Telegram 联系我们，我们会和你一起把问题解决。",
      cta: "重新提交",
      other: "或者通过 WhatsApp 或 Telegram 联系我们，我们会和你一起把问题解决。",
    },
  },

  fundamental: {
    subject: "你的 {instrument} 基本面观点",
    title: "MMFX Fundamental Dispatch",
    kicker: "Terminal Dispatch · Fundamental Desk",
    attached: "随信附上你的 {instrument} 基本面观点。",
    inside: "内容包括：眼下是哪些宏观因素在推动这个品种——市场持仓、正在起作用的催化因素，以及它们指向的方向偏好。打开附件中的 PDF，查看完整简报。",
    compliance: "仅为基本面分析——不是交易信号、目标价，也不是买入或卖出的指示。",
    footer: "你收到这封邮件，是因为你在 Market Makers FX 账户中向 Fundamental Desk 申请了一份副本。",
  },

  journal: {
    doThis: "接下来这样做：",
    cta: "打开你的 AI 交易助手",
    footerNote: "你收到这封邮件，是因为你在使用 Market Makers FX 记录你的交易。",
  },
};
