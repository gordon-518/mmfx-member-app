import type { Messages } from "../types";

// The written Know Your Style report's six headings and its compliance footer,
// in the language the report is written in. The model is told to use these
// exact strings and the report is validated against them
// (src/lib/kys/prompt.ts, src/lib/kys/validation.ts). The English footer is
// the reviewed wording: a report in another language carries it as well.
export const kysReport: Messages["kysReport"] = {
  read: "Bacaan",
  wellDone: "Apa yang anda lakukan dengan baik",
  leak: "Kelemahan yang merugikan anda",
  onGold: "Bagaimana ia berlaku pada XAU/USD",
  fix: "Pembaikan anda minggu ini",
  finalNote: "Nota akhir",
  footer: "Dagangan forex dan CFD melibatkan risiko kerugian yang besar dan tidak sesuai untuk semua pelabur. Penilaian ini adalah untuk tujuan pendidikan dan bukan nasihat kewangan.",
};
