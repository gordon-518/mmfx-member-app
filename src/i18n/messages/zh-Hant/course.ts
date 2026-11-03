import type { Messages } from "../types";

// The course page's own words. The syllabus (module and lesson titles) is in
// courseContent; the lessons themselves are videos in English.
export const course: Messages["course"] = {
  eyebrow: "教育 · {n} 堂課",
  title: "MM 導師課程",
  subtitle: "完整課程，從基礎到進階。觀看每一堂課並下載它的投影片。隨時從上次停下的地方繼續。",
  contentNote: "課程以英文講授。",
  module1Open: "你的方案已開放模組 1。",
  otherMentorship: "其餘 {n} 堂課包含在 Team MM + Mentorship 方案中。",
  otherFund: "為你的帳戶入金後，其餘 {n} 堂課即可解鎖。",
  seeHow: "了解方法 →",
  progress: "{modules} 個模組 · {lessons} 堂課",
  watched: "已觀看 {done} / {total}",
  start: "開始學習",
  rewatch: "重新觀看",
  resume: "繼續學習",
  lessonsOne: "{n} 堂課",
  lessonsOther: "{n} 堂課",
  lockedSr: "（未解鎖）",
  unlock: "解鎖",
  watch: "觀看 {title}",
  slidesTitle: "下載投影片（PPT）",
  slides: "投影片",
};
