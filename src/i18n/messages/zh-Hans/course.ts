import type { Messages } from "../types";

// The course page's own words. The syllabus (module and lesson titles) is in
// courseContent; the lessons themselves are videos in English.
export const course: Messages["course"] = {
  eyebrow: "教育 · {n} 节课",
  title: "MM 导师课程",
  subtitle: "完整课程，从基础到进阶。观看每一节课并下载它的幻灯片。随时从上次停下的地方继续。",
  contentNote: "课程以英文讲授。",
  module1Open: "你的方案已开放模块 1。",
  otherMentorship: "其余 {n} 节课包含在 Team MM + Mentorship 方案中。",
  otherFund: "为你的账户入金后，其余 {n} 节课即可解锁。",
  seeHow: "了解方法 →",
  progress: "{modules} 个模块 · {lessons} 节课",
  watched: "已观看 {done} / {total}",
  start: "开始学习",
  rewatch: "重新观看",
  resume: "继续学习",
  lessonsOne: "{n} 节课",
  lessonsOther: "{n} 节课",
  lockedSr: "（未解锁）",
  unlock: "解锁",
  watch: "观看 {title}",
  slidesTitle: "下载幻灯片（PPT）",
  slides: "幻灯片",
};
