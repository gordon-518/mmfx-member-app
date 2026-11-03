import type { Messages } from "../types";

// The syllabus in every language. The lessons themselves are videos in English,
// so the technical terms the videos use (BOS, CHoCH, OB, FVG, OTE...) stay
// recognisable in every translation.
export const courseContent: Messages["courseContent"] = {
  levels: {
    Basic: "Dasar",
    Intermediate: "Menengah",
    Advanced: "Lanjutan",
  },
  modules: {
    m1: {
      title: "Dasar",
      summary: "Mindset & dasar emas",
    },
    m2: {
      title: "Membaca Harga",
      summary: "Struktur & konsep inti",
    },
    m3: {
      title: "Keunggulan Institusi",
      summary: "Liquidity & displacement",
    },
    m4: {
      title: "Membangun Bias Anda",
      summary: "Analisis top-down",
    },
    m5: {
      title: "Model Entry",
      summary: "Kerangka intraday hingga pemicu",
    },
    m6: {
      title: "Manajemen & Rutinitas",
      summary: "Risiko, berita & SOP harian Anda",
    },
  },
  lessons: {
    "00-golden-mindset": {
      title: "Golden Mindset",
      description: "Mindset trader sebelum teknik — disiplin, kesabaran, dan psikologi di balik eksekusi yang konsisten.",
    },
    "01-xauusd-explained": {
      title: "Mengenal XAUUSD",
      description: "Emas sebagai instrumen trading — mengapa XAUUSD bergerak berbeda dari pair forex.",
    },
    "02-what-moves-gold": {
      title: "Apa yang Menggerakkan Emas?",
      description: "Pendorong makro harga emas — Dolar AS, real yield, sentimen risiko, dan ketegangan geopolitik.",
    },
    "03-market-structure-pt1": {
      title: "Struktur Pasar Bagian 1",
      description: "Membaca higher-high dan higher-low — cara mengenali arah tren hanya dari price action.",
    },
    "04-market-structure-pt2": {
      title: "Struktur Pasar Bagian 2",
      description: "Struktur internal vs eksternal, dan perbedaan penting antara Break of Structure (BOS) dan Change of Character (CHoCH).",
    },
    "05-core-concepts": {
      title: "Konsep Inti MM",
      description: "Pilar-pilar Sistem MM secara ringkas — liquidity, order block, fair value gap, dan displacement.",
    },
    "06-liquidity-deep-dive": {
      title: "Mendalami Liquidity",
      description: "Di mana order institusi bersembunyi — liquidity buyside/sellside, equal high/low, dan cara mengenali sweep secara real time.",
    },
    "07-displacement-mastery": {
      title: "Menguasai Displacement",
      description: "Apa yang membedakan niat institusi yang nyata dari noise — ukuran body candle, candle beruntun, FVG, dan patahan struktur.",
    },
    "08-daily-bias-pt1": {
      title: "Bias Harian Bagian 1",
      description: "Menentukan arah hari ini — memetakan liquidity eksternal di Daily dan 4H, dan menetapkan target Anda.",
    },
    "09-daily-bias-pt2": {
      title: "Bias Harian Bagian 2",
      description: "Keselarasan timeframe, level invalidasi, dan apa yang dilakukan saat timeframe lebih tinggi tidak sejalan.",
    },
    "10-15m-decision": {
      title: "Kerangka Keputusan 15m",
      description: "Panduan 15 menit — hari tren vs hari reversal, dan cara menandai zona entry Anda (OB/FVG).",
    },
    "11-5m-confirmation": {
      title: "Kerangka Konfirmasi 5m",
      description: "Menunggu CHoCH 5m dengan displacement di dalam zona 15m Anda — 'izin' untuk turun ke 1m.",
    },
    "12-sessions": {
      title: "Sesi dan Waktu",
      description: "Akumulasi Asia, manipulasi London, distribusi New York — dan kill zone.",
    },
    "13-1m-execution": {
      title: "Kerangka Eksekusi 1m",
      description: "Pemicu entry terakhir — CHoCH 1m atau konfirmasi di dalam zona Optimal Trade Entry (OTE).",
    },
    "14-breaker-blocks": {
      title: "Menguasai Breaker Block",
      description: "Order block yang gagal lalu berganti peran — salah satu zona dengan probabilitas tertinggi di seluruh Sistem MM.",
    },
    "15-news-macro": {
      title: "Berita, Makro & Pendorong Geopolitik",
      description: "Menghadapi CPI, FOMC, NFP, dan guncangan geopolitik — persiapan sebelum event, aturan berhenti, dan kapan sebaiknya menunggu.",
    },
    "16-trade-management": {
      title: "Manajemen Trade",
      description: "Pemicu break-even, ambil profit sebagian, trailing, dan scaling — cara membiarkan posisi yang menang terus berjalan tanpa mengembalikannya.",
    },
    "17-complete-workflow": {
      title: "Alur Kerja Lengkap",
      description: "Setiap langkah dari chart kosong hingga trade ditutup — seluruh Sistem MM dalam satu sesi penuh.",
    },
    "18-daily-sop": {
      title: "SOP Harian Anda",
      description: "Ritual 8 langkah untuk setiap hari trading — tandai, bias, klasifikasi, tunggu, konfirmasi, eksekusi, kelola, catat.",
    },
  },
};
