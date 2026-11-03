import type { Messages } from "../types";

// The library page. Book titles are the PDFs' own (English) titles and stay
// as they are; categories and blurbs are by key / slug.
export const library: Messages["library"] = {
  eyebrow: "Perpustakaan · {n} eBuku",
  title: "Perpustakaan MM",
  subtitle: "Sistem bertulis dan set rujukan — baca dalam pelayar atau muat turun. Sesuai dengan kursus; biarkan helaian rujukan terbuka semasa anda berdagang.",
  contentNote: "eBuku ditulis dalam bahasa Inggeris.",
  flagship: "Utama · {category}",
  rest: "Selebihnya di rak",
  read: "Baca",
  download: "Muat turun",
  readInBrowser: "Baca dalam pelayar",
  downloadPdf: "Muat turun PDF",
  categories: {
    complete: "Sistem lengkap",
    core: "Teras",
    quickStart: "Permulaan pantas",
  },
  books: {
    "mm-system-ebook": {
      blurb: "Sistem bertulis yang lengkap, dari mula hingga akhir — setiap peringkat aliran kerja dalam satu rujukan yang boleh anda rujuk berulang kali.",
      inside: {
        a: "Kecenderungan → zon → pencetus → risiko → urus",
        b: "Contoh emas (XAU/USD) yang dihuraikan",
        c: "Rangka keputusan penuh, dari mula hingga akhir",
      },
    },
    "five-stage-workflow": {
      blurb: "MM System dari mula hingga akhir — kecenderungan, zon, pencetus, risiko, urus.",
    },
    "decision-trees-invalidation": {
      blurb: "Apabila tesis gagal — di mana henti rugi diletakkan dan mengapa.",
    },
    "cheat-sheets-quick-reference": {
      blurb: "Rujukan meja untuk sesi, paras dan senarai semak.",
    },
  },
};
