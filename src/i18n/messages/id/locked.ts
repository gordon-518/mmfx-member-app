import type { Messages } from "../types";

// Locked feature pages, the lock veil and the members-only panel. Compliance:
// say what each tool is, never what it earns.
export const locked: Messages["locked"] = {
  features: {
    indicators: {
      eyebrow: "Alat · TradingView",
      title: "Indikator",
      pitch: "Indikator TradingView MM System yang khusus undangan, diberikan langsung ke username TradingView Anda.",
      points: {
        p1: "Trendline otomatis, pivot, dan tampilan multi-timeframe",
        p2: "Di chart Anda sendiri, di TradingView",
        p3: "Akses diberikan otomatis",
      },
    },
    strategies: {
      eyebrow: "Alat · TradingView",
      title: "Strategi",
      pitch: "Skrip strategi TradingView yang bisa di-backtest, berisi aturan MM System.",
      points: {
        p1: "Uji aturannya di data historis sendiri",
        p2: "Model entry dari kursus, dalam bentuk kode",
        p3: "Di chart Anda sendiri, di TradingView",
      },
    },
    library: {
      eyebrow: "Edukasi · Perpustakaan",
      title: "Perpustakaan MM",
      pitch: "Empat eBook MM: sistemnya, panduan praktisnya, dan pemikiran di baliknya.",
      points: {
        p1: "MM System, dalam bentuk tulisan",
        p2: "Panduan yang bisa disimpan di samping chart",
        p3: "Unduh dan baca offline",
      },
    },
    "live-classes": {
      eyebrow: "Edukasi · Live",
      title: "Kelas Live",
      pitch: "Sesi di chart bersama meja, membaca pasar saat bergerak.",
      points: {
        p1: "Live di chart bersama meja",
        p2: "Bertanya langsung saat itu juga",
        p3: "Rekaman sesi sebelumnya",
      },
    },
    "fundamental-desk": {
      eyebrow: "Bot · Makro",
      title: "Meja Fundamental",
      pitch: "Analisis makro emas secara live: gambaran fundamental yang menggerakkan XAU/USD, dengan bahasa sederhana.",
      points: {
        p1: "Apa yang menggerakkan emas hari ini, dan mengapa",
        p2: "Suku bunga, dolar, dan risiko dalam satu analisis",
        p3: "Diperbarui sepanjang sesi",
      },
    },
    "ai-trading-assistant": {
      eyebrow: "Team MM · AI",
      title: "Asisten Trading AI",
      pitch: "Hubungkan akun trading Anda dan dapatkan coach yang meninjau setiap trade Anda berdasarkan MM System.",
      points: {
        p1: "Setiap trade ditinjau otomatis",
        p2: "Pola dalam trading Anda sendiri, ditemukan untuk Anda",
        p3: "Dibangun di atas MM System",
      },
    },
    "team-mm": {
      eyebrow: "Team MM · Komunitas",
      title: "Team MM",
      pitch: "Channel privat Team MM, bersama meja.",
      points: {
        p1: "Langsung dari meja",
        p2: "Khusus member Team MM",
        p3: "Di Telegram",
      },
    },
  },
  fallbackTitle: "Bagian meja ini terkunci",
  fallbackPitch: "Terbuka setelah Anda mendanai akun Anda.",
  openOnEvery: "Terbuka di semua paket",
  openNow: "Terbuka di paket Anda sekarang",
  freeSignals: "Channel sinyal",
  freeNews: "Berita",
  freeCourse: "Kursus · Modul 1",
  membersOnly: "Khusus member",
  membersTitle: "{feature} khusus member MM System",
  perkTeam: "Team MM — channel sinyal VIP privat",
  perkJournal: "Jurnal trading AI",
  perkEas: "EA otomatis — segera hadir",
  become: "Jadi member",
  trialNote: "Anda sedang uji coba gratis — danai akun broker Anda sendiri untuk membuka semuanya.",
};
