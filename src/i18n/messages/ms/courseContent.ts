import type { Messages } from "../types";

// The syllabus in every language. The lessons themselves are videos in English,
// so the technical terms the videos use (BOS, CHoCH, OB, FVG, OTE...) stay
// recognisable in every translation.
export const courseContent: Messages["courseContent"] = {
  levels: {
    Basic: "Asas",
    Intermediate: "Pertengahan",
    Advanced: "Lanjutan",
  },
  modules: {
    m1: {
      title: "Asas",
      summary: "Minda & asas emas",
    },
    m2: {
      title: "Membaca Harga",
      summary: "Struktur & konsep teras",
    },
    m3: {
      title: "Kelebihan Institusi",
      summary: "Liquidity & displacement",
    },
    m4: {
      title: "Membina Arah Anda",
      summary: "Analisis atas ke bawah",
    },
    m5: {
      title: "Model Entry",
      summary: "Rangka kerja intrahari hingga pencetus",
    },
    m6: {
      title: "Pengurusan & Rutin",
      summary: "Risiko, berita & SOP harian anda",
    },
  },
  lessons: {
    "00-golden-mindset": {
      title: "Minda Emas",
      description: "Minda pedagang sebelum teknik — disiplin, kesabaran, dan psikologi di sebalik pelaksanaan yang konsisten.",
    },
    "01-xauusd-explained": {
      title: "Mengenali XAUUSD",
      description: "Emas sebagai instrumen dagangan — mengapa XAUUSD bergerak berbeza daripada pasangan forex.",
    },
    "02-what-moves-gold": {
      title: "Apa yang Menggerakkan Emas?",
      description: "Pemacu makro harga emas — Dolar AS, hasil sebenar (real yields), sentimen risiko dan ketegangan geopolitik.",
    },
    "03-market-structure-pt1": {
      title: "Struktur Pasaran Bahagian 1",
      description: "Membaca higher-high dan higher-low — cara mengenal pasti arah trend daripada price action semata-mata.",
    },
    "04-market-structure-pt2": {
      title: "Struktur Pasaran Bahagian 2",
      description: "Struktur dalaman lawan luaran, dan perbezaan penting antara Break of Structure (BOS) dan Change of Character (CHoCH).",
    },
    "05-core-concepts": {
      title: "Konsep Teras MM",
      description: "Tonggak Sistem MM secara ringkas — liquidity, order block, fair value gap dan displacement.",
    },
    "06-liquidity-deep-dive": {
      title: "Mendalami Liquidity",
      description: "Di mana pesanan institusi bersembunyi — liquidity buyside/sellside, equal high/low, dan cara mengesan sweep secara langsung.",
    },
    "07-displacement-mastery": {
      title: "Menguasai Displacement",
      description: "Apa yang membezakan niat institusi sebenar daripada bunyi bising — saiz badan lilin, lilin berturut-turut, FVG dan pecahan struktur.",
    },
    "08-daily-bias-pt1": {
      title: "Arah Harian Bahagian 1",
      description: "Menentukan arah untuk hari itu — memetakan liquidity luaran pada carta Daily dan 4H, dan menetapkan sasaran anda.",
    },
    "09-daily-bias-pt2": {
      title: "Arah Harian Bahagian 2",
      description: "Penjajaran timeframe, paras pembatalan, dan apa yang perlu dilakukan apabila timeframe lebih tinggi tidak sependapat.",
    },
    "10-15m-decision": {
      title: "Rangka Keputusan 15m",
      description: "Panduan 15 minit — hari trend lawan hari pembalikan, dan cara menandakan zon entry anda (OB/FVG).",
    },
    "11-5m-confirmation": {
      title: "Rangka Pengesahan 5m",
      description: "Menunggu CHoCH 5m dengan displacement di dalam zon 15m anda — 'kebenaran' untuk turun ke 1m.",
    },
    "12-sessions": {
      title: "Sesi dan Waktu",
      description: "Pengumpulan Asia, manipulasi London, pengagihan New York — dan kill zone.",
    },
    "13-1m-execution": {
      title: "Rangka Pelaksanaan 1m",
      description: "Pencetus entry terakhir — CHoCH 1m atau pengesahan di dalam zon Optimal Trade Entry (OTE).",
    },
    "14-breaker-blocks": {
      title: "Menguasai Breaker Block",
      description: "Order block yang gagal lalu bertukar peranan — antara zon berkebarangkalian tertinggi dalam seluruh Sistem MM.",
    },
    "15-news-macro": {
      title: "Berita, Makro & Pemacu Geopolitik",
      description: "Mengendalikan CPI, FOMC, NFP dan kejutan geopolitik — persediaan sebelum peristiwa, peraturan berhenti, dan bila perlu berdiam diri.",
    },
    "16-trade-management": {
      title: "Pengurusan Dagangan",
      description: "Pencetus break-even, ambil untung separa, trailing dan scaling — cara membiarkan dagangan menang terus berjalan tanpa memulangkannya semula.",
    },
    "17-complete-workflow": {
      title: "Aliran Kerja Lengkap",
      description: "Setiap langkah dari carta kosong hingga dagangan ditutup — seluruh Sistem MM dalam satu sesi penuh.",
    },
    "18-daily-sop": {
      title: "SOP Harian Anda",
      description: "Ritual 8 langkah untuk setiap hari dagangan — tanda, arah, klasifikasi, tunggu, sahkan, laksana, urus, catat.",
    },
  },
};
