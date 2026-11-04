import type { Messages } from "../types";

// The eight Know Your Style archetypes, keyed by the ID profiles.kys_archetype
// stores. The English matches src/lib/kys/archetypes.json, which still feeds the
// report prompt (a test keeps the two in step). keystone* is the archetype's
// first "next move" button.
export const archetypes: Messages["archetypes"] = {
  reckless_gambler: {
    name: "Si Penjudi Nekat",
    keystoneLabel: "Modul Manajemen & Rutinitas",
    keystoneWhy: "Bangun aturan risiko lebih dulu — ukuran posisi tetap dan stop yang tegas sebelum hal lain.",
  },
  analysis_paralyser: {
    name: "Si Lumpuh Analisis",
    keystoneLabel: "Backtest sebuah strategi",
    keystoneWhy: "Buktikan aturan Anda berfungsi, agar berhenti menuntut kepastian yang tak pernah datang.",
  },
  signal_dependent: {
    name: "Si Pengikut Sinyal",
    keystoneLabel: "Mulai Kursus MM System",
    keystoneWhy: "Ubah kebiasaan mengikuti sinyal menjadi keterampilan yang benar-benar milik Anda.",
  },
  indicator_stacker: {
    name: "Si Penumpuk Indikator",
    keystoneLabel: "Modul Membaca Harga",
    keystoneWhy: "Trading dengan struktur yang bersih, bukan tumpukan indikator yang saling bertentangan.",
  },
  emotional_revenge_trader: {
    name: "Si Trader Balas Dendam",
    keystoneLabel: "Baca eBook If-Then",
    keystoneWhy: "Tetapkan reaksi Anda sejak awal agar kerugian tidak mengendalikan Anda.",
  },
  news_trader: {
    name: "Si Trader Berita",
    keystoneLabel: "Kalender Ekonomi",
    keystoneWhy: "Susun rencana berdasarkan katalis, bukan mengejar setiap headline.",
  },
  system_hopper: {
    name: "Si Gonta-ganti Sistem",
    keystoneLabel: "Berkomitmen pada satu sistem",
    keystoneWhy: "Satu kerangka, dijalankan cukup lama sampai pengalaman benar-benar menumpuk.",
  },
  brand_new_beginner: {
    name: "Si Pemula",
    keystoneLabel: "Mulai dari Dasar",
    keystoneWhy: "Bangun fondasi sebelum mempertaruhkan uang sungguhan.",
  },
};
