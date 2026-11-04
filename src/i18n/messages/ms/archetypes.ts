import type { Messages } from "../types";

// The eight Know Your Style archetypes, keyed by the ID profiles.kys_archetype
// stores. The English matches src/lib/kys/archetypes.json, which still feeds the
// report prompt (a test keeps the two in step). keystone* is the archetype's
// first "next move" button.
export const archetypes: Messages["archetypes"] = {
  reckless_gambler: {
    name: "Si Penjudi Melulu",
    keystoneLabel: "Modul Pengurusan & Rutin",
    keystoneWhy: "Bina peraturan risiko dahulu — saiz tetap dan stop yang tegas sebelum perkara lain.",
  },
  analysis_paralyser: {
    name: "Si Terlebih Analisis",
    keystoneLabel: "Uji balik strategi",
    keystoneWhy: "Buktikan peraturan anda berfungsi, supaya anda berhenti menuntut kepastian yang tidak akan datang.",
  },
  signal_dependent: {
    name: "Si Pengikut Isyarat",
    keystoneLabel: "Mulakan Kursus MM System",
    keystoneWhy: "Jadikan kebiasaan mengikut isyarat satu kemahiran yang benar-benar milik anda.",
  },
  indicator_stacker: {
    name: "Si Penimbun Indikator",
    keystoneLabel: "Modul Membaca Harga",
    keystoneWhy: "Berdagang dengan struktur yang bersih, bukan dinding indikator yang bercanggah.",
  },
  emotional_revenge_trader: {
    name: "Si Pedagang Balas Dendam",
    keystoneLabel: "Baca eBuku If-Then",
    keystoneWhy: "Tetapkan reaksi anda lebih awal supaya kerugian tidak mengawal anda.",
  },
  news_trader: {
    name: "Si Pedagang Berita",
    keystoneLabel: "Kalendar Ekonomi",
    keystoneWhy: "Rancang berdasarkan pemangkin, bukan mengejar setiap tajuk berita.",
  },
  system_hopper: {
    name: "Si Pelompat Sistem",
    keystoneLabel: "Komited pada satu sistem",
    keystoneWhy: "Satu rangka kerja, didagangkan cukup lama sehingga pengalaman benar-benar bertambah.",
  },
  brand_new_beginner: {
    name: "Si Pemula",
    keystoneLabel: "Mulakan di Asas",
    keystoneWhy: "Bina asas sebelum anda mempertaruhkan wang sebenar.",
  },
};
