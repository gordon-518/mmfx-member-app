import type { Messages } from "../types";

// The strategies page. Script names are product names and stay as they are.
export const strategies: Messages["strategies"] = {
  eyebrow: "Alat · XAU/USD",
  title: "Strategi",
  subtitle: "Skrip strategi TradingView yang bisa di-backtest — entry, exit, dan risiko ditulis dalam kode agar bisa Anda uji di chart sendiri. Dua sudah live; lainnya menyusul.",
  grantedWhat: "kedua skrip strategi",
  requestBody: "Masukkan username TradingView Anda untuk mendapat akses ke kedua skrip strategi. Akses diberikan otomatis — keduanya akan segera muncul di akun Anda.",
  view: "Lihat di TradingView",
  imageAlt: "Backtest {name} di TradingView",
  comingSoon: "Segera hadir",
  inBuild: "Sedang dibuat",
  inBuildBody: "Satu setup lagi yang bisa di-backtest — segera ditambahkan ke area member Anda.",
  types: {
    Trend: "Tren",
    Entry: "Entry",
  },
  signals: {
    "mm-ama-supertrend": "SuperTrend MA adaptif — arah tren, level flip, dan pemicu long/short, sudah di-backtest pada emas.",
    "mm-system-5m-entry": "Model entry 5 menit dalam kode — bias HTF, zona sell/buy, dan konfirmasi, alur kerja MM yang diotomatisasi.",
  },
};
