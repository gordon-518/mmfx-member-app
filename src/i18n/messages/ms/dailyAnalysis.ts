import type { Messages } from "../types";

// The Daily Analysis archive. The analyses themselves (titles, descriptions,
// video, PDF) are written in English by the desk and are not translated.
export const dailyAnalysis: Messages["dailyAnalysis"] = {
  eyebrow: "Meja · XAU/USD",
  subtitle: "Analisis Emas, sesi demi sesi — kecenderungan, paras, dan tesis di sebaliknya.",
  empty: "Belum ada analisis diterbitkan. Sila semak semula nanti.",
  downloadReport: "Muat turun laporan (PDF) ↓",
  downloadReportTitle: "Muat turun laporan (PDF)",
  downloadAria: "Muat turun laporan",
  all: "Semua",
  groupBy: "Kumpul ikut",
  month: "Bulan",
  session: "Sesi",
  readsOne: "{n} analisis",
  readsOther: "{n} analisis",
  noMatch: "Tiada analisis yang sepadan dengan penapis itu.",
  otherSessions: "Sesi lain",
  undated: "Tiada tarikh",
  watch: "Tonton {title}",
  contentNote: "Analisis itu sendiri ditulis dan dirakam dalam bahasa Inggeris.",
  sessions: {
    asian: "Sesi Asia",
    london: "Sesi London",
    preNewYork: "Sebelum sesi New York",
    newYork: "Sesi New York",
  },
};
