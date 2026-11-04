import type { Messages } from "../types";

// The guided tour's words, by step key (components/tour/steps.ts holds the
// structure: which element each stop points at).
export const tour: Messages["tour"] = {
  dialogLabel: "如何使用这个应用",
  close: "关闭导览",
  stepOf: "第 {n} 步，共 {total} 步",
  steps: {
    intro: {
      title: "我带你四处看看",
      body: "九个简短的站点，大约两分钟。看完后你会知道每样东西在哪里、每个部分是做什么的。你可以随时离开。",
    },
    nav: {
      title: "所有内容都在这个菜单里",
      body: "整个 MM Desk 都在左侧，按照你实际使用的方式分组：解读市场、执行交易、管理仓位，以及支撑这三者的基础。",
    },
    home: {
      title: "从这里开始和主页",
      body: "「从这里开始」就是你现在所在的页面：你的六个步骤和你的进度。主页是你每天的起点——有什么新内容，接下来该做什么。",
    },
    read: {
      title: "解读市场",
      body: "用这些开始一个交易时段。每日分析是 MM Desk 对黄金的解读和关键价位；Fundamental Desk 解读十一个品种的宏观面；新闻和经济日历告诉你接下来会发生什么。",
    },
    execute: {
      title: "执行交易",
      body: "计划变成交易的地方。信号是 MM Desk 的交易信号，指标把我们的工具放到你自己的 TradingView 图表上，策略则是写成脚本的交易体系。",
    },
    manage: {
      title: "管理仓位",
      body: "最难的部分，也是大多数账户亏损的地方。直播课程陪你一起交易，交易风格测评找出让你付出代价的习惯，AI 交易助手复盘你的真实交易。",
    },
    foundations: {
      title: "基础",
      body: "MM 体系课程——十九节课，从交易心态到仓位管理——以及背后的文字资料库。每当上面的内容看不懂时，就回到这里。",
    },
    account: {
      title: "你的方案在这里",
      body: "你的等级显示在你的邮箱下方。菜单项旁边的锁表示它在更高等级开放——点击它，你可以在做任何决定之前看清里面有什么。",
    },
    steps: {
      title: "然后按清单逐一完成",
      body: "你的六个步骤，按顺序排列，每一步都写明它能带给你什么，以及完成后要达到的目标。一天一个就足够了。",
    },
    done: {
      title: "这就是 MM Desk",
      body: "你可以随时通过「从这里开始」页面顶部的按钮再次运行这个导览。第一步是加入公开频道——大约只需十秒钟。",
    },
  },
};
