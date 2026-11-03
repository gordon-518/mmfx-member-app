import type { Messages } from "../types";

// The Daily Analysis archive. The analyses themselves (titles, descriptions,
// video, PDF) are written in English by the desk and are not translated.
export const dailyAnalysis: Messages["dailyAnalysis"] = {
  eyebrow: "Meja · XAU/USD",
  subtitle: "Analisis Emas, sesi demi sesi — bias, level, dan tesis di baliknya.",
  empty: "Belum ada analisis yang diterbitkan. Cek lagi nanti.",
  downloadReport: "Unduh laporan (PDF) ↓",
  downloadReportTitle: "Unduh laporan (PDF)",
  downloadAria: "Unduh laporan",
  all: "Semua",
  groupBy: "Kelompokkan",
  month: "Bulan",
  session: "Sesi",
  readsOne: "{n} analisis",
  readsOther: "{n} analisis",
  noMatch: "Tidak ada analisis yang cocok dengan filter itu.",
  otherSessions: "Sesi lainnya",
  undated: "Tanpa tanggal",
  watch: "Tonton {title}",
  contentNote: "Analisisnya sendiri ditulis dan direkam dalam bahasa Inggris.",
  sessions: {
    asian: "Sesi Asia",
    london: "Sesi London",
    preNewYork: "Jelang sesi New York",
    newYork: "Sesi New York",
  },
};
