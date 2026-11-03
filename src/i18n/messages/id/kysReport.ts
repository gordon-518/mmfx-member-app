import type { Messages } from "../types";

// The written Know Your Style report's six headings and its compliance footer,
// in the language the report is written in. The model is told to use these
// exact strings and the report is validated against them
// (src/lib/kys/prompt.ts, src/lib/kys/validation.ts). The English footer is
// the reviewed wording: a report in another language carries it as well.
export const kysReport: Messages["kysReport"] = {
  read: "Pembacaan",
  wellDone: "Yang sudah Anda lakukan dengan baik",
  leak: "Titik lemah yang merugikan Anda",
  onGold: "Bagaimana itu terlihat di XAU/USD",
  fix: "Perbaikan Anda minggu ini",
  finalNote: "Catatan akhir",
  footer: "Trading forex dan CFD melibatkan risiko kerugian yang besar dan tidak cocok untuk semua investor. Penilaian ini untuk tujuan edukasi dan bukan nasihat keuangan.",
};
