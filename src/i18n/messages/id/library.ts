import type { Messages } from "../types";

// The library page. Book titles are the PDFs' own (English) titles and stay
// as they are; categories and blurbs are by key / slug.
export const library: Messages["library"] = {
  eyebrow: "Perpustakaan · {n} eBook",
  title: "Perpustakaan MM",
  subtitle: "Sistem tertulis dan bahan referensinya — baca di browser atau unduh. Melengkapi kursus; biarkan cheat sheet terbuka saat Anda trading.",
  contentNote: "eBook ditulis dalam bahasa Inggris.",
  flagship: "Andalan · {category}",
  rest: "Rak lainnya",
  read: "Baca",
  download: "Unduh",
  readInBrowser: "Baca di browser",
  downloadPdf: "Unduh PDF",
  categories: {
    complete: "Sistem lengkap",
    core: "Inti",
    quickStart: "Mulai cepat",
  },
  books: {
    "mm-system-ebook": {
      blurb: "Sistem tertulis lengkap, dari awal sampai akhir — setiap tahap alur kerja dalam satu referensi yang bisa terus Anda buka lagi.",
      inside: {
        a: "Bias → zona → pemicu → risiko → kelola",
        b: "Contoh emas (XAU/USD) yang dibahas",
        c: "Kerangka keputusan lengkap, dari awal sampai akhir",
      },
    },
    "five-stage-workflow": {
      blurb: "MM System dari awal sampai akhir — bias, zona, pemicu, risiko, kelola.",
    },
    "decision-trees-invalidation": {
      blurb: "Saat tesis gagal — di mana stop ditempatkan dan mengapa.",
    },
    "cheat-sheets-quick-reference": {
      blurb: "Referensi meja untuk sesi, level, dan checklist.",
    },
  },
};
