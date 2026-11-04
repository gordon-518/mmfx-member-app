import type { Messages } from "../types";

// Know Your Style: the assessment, the report screen and the emailed copy.
// moves.* are the "next move" buttons chosen from the two weakest dimensions
// (src/lib/kys/routing.ts holds where each one goes).
export const kys: Messages["kys"] = {
  eyebrow: "AI 工具 · 个人画像",
  subtitle: "十四个问题，然后是一份关于你交易方式的书面分析：你的交易者类型、六个维度，以及让你亏钱的短板。",
  headline: "每个交易者都有自己的{tell}{find}",
  headlineTell: "破绽。",
  headlineFind: "来找出你的。",
  intro: "十四个问题，大约六分钟。请如实作答——报告的质量取决于你给出的答案。",
  getArchetype: "你的交易者类型——",
  getArchetypeDetail: "你实际上属于 {n} 种交易者类型中的哪一种。",
  getDimensions: "你的六个维度——",
  getDimensionsDetail: "根据你的答案评分，看你在每条光谱上的位置。",
  getLeak: "你的短板——",
  getLeakDetail: "最弱的那一项，以及它让你付出的代价。",
  start: "开始测评 →",
  savedNote: "结果会保存到你的个人资料——随时可以回来查看。",
  measured: "测评内容",
  question: "问题",
  analysing: {
    s1: "正在读取你的答案…",
    s2: "正在分析你的风险行为…",
    s3: "正在对照 {n} 种交易者类型…",
    s4: "正在找出你的短板…",
    s5: "正在撰写你的测评报告…",
  },
  errorTitle: "没有完成。",
  errorSession: "你的登录已过期。请重新登录，然后再试一次。",
  errorService: "暂时无法生成报告（错误 {status}）。请稍后再试。",
  errorNetwork: "无法连接报告服务。请检查网络后重试。",
  errorKept: "你的答案都还在——再试一次。",
  yourStyle: "你的交易风格",
  taken: "测评于 {date} · 你保存的个人画像",
  sendCopy: "发一份给我",
  sending: "正在发送…",
  sent: "已发送——请查看你的收件箱。",
  sendFailed: "发送失败。你的个人画像已保存——随时可以在这里重试。",
  profileTitle: "你的个人画像",
  profileBody: "你交易方式的六个维度。你不只是一个标签——这是完整的轮廓，而最弱的几项正是你流失资金的地方。",
  nextMoves: "你的下一步",
  movesNote: "根据你的交易者类型和最弱的两个维度挑选",
  retake: "重新测评",
  fallbackName: "你的交易者画像",
  leak: "你的短板",
  strength: "优势",
  score: "{score} / 100",
  reportLanguageNote: "你保存的报告使用的是你当时测评所用的语言。重新测评即可获得这个语言的版本。",
  emailEyebrow: "交易风格测评 · 你的交易风格",
  emailProfileBody: "你交易方式的六个维度。最弱的几项正是你流失资金的地方。",
  emailSubject: "你的交易风格测评结果——{archetype}",
  moves: {
    riskCourse: {
      label: "管理与日常流程模块",
      why: "每日亏损上限和固定仓位——把风险规则写进流程。",
    },
    decisionTreesRisk: {
      label: "Decision Trees & Invalidation",
      why: "在入场之前，就清楚知道自己在什么情况下是错的。",
    },
    ifThen: {
      label: "阅读 If-Then 电子书",
      why: "提前定好你的反应，让一次亏损无法左右你。",
    },
    liveClass: {
      label: "参加直播课",
      why: "实时观看 MM Desk 如何冷静地管理仓位。",
    },
    startCourse: {
      label: "开始学习 MM 体系课程",
      why: "学会自己看结构，而不是依赖信号。",
    },
    todaysRead: {
      label: "今日黄金解读",
      why: "看一份完整的解读如何逐个时段搭建、推理。",
    },
    backtest: {
      label: "回测一个策略",
      why: "建立对规则的信任，让你敢于果断执行。",
    },
    decisionTreesDecide: {
      label: "Decision Trees & Invalidation",
      why: "一份明确的检查清单，能消除你在图表前的犹豫。",
    },
    oneSystem: {
      label: "专注一套体系",
      why: "一套框架，从头学到尾，坚持交易足够久来验证它。",
    },
    oneEdge: {
      label: "一个经过回测的优势",
      why: "选定一个策略，给它足够的样本量。",
    },
    dailySop: {
      label: "每日 SOP",
      why: "一套可重复的流程：标记、定方向、等待、确认、管理、记录。",
    },
    dailyPlan: {
      label: "从每日计划开始",
      why: "每个交易时段开始前，就清楚 MM Desk 的预期及原因。",
    },
  },
};
