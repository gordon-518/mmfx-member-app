import type { Messages } from "../types";

// The strategies page. Script names are product names and stay as they are.
export const strategies: Messages["strategies"] = {
  eyebrow: "Alat · XAU/USD",
  title: "Strategi",
  subtitle: "Skrip strategi TradingView yang boleh diuji semula — kemasukan, keluar dan risiko dikodkan supaya anda boleh mengujinya pada carta anda sendiri. Dua sudah dilancarkan; lebih banyak akan datang.",
  grantedWhat: "kedua-dua skrip strategi",
  requestBody: "Masukkan nama pengguna TradingView anda untuk mendapat akses kepada kedua-dua skrip strategi. Akses diberikan secara automatik — anda akan melihatnya dalam akaun anda tidak lama lagi.",
  view: "Lihat di TradingView",
  imageAlt: "Ujian semula {name} di TradingView",
  comingSoon: "Akan datang",
  inBuild: "Sedang dibina",
  inBuildBody: "Satu lagi persediaan yang boleh diuji semula — akan ditambah ke ruang ahli anda tidak lama lagi.",
  types: {
    Trend: "Arah aliran",
    Entry: "Kemasukan",
  },
  signals: {
    "mm-ama-supertrend": "SuperTrend MA adaptif — arah aliran, paras pembalikan dan pencetus beli/jual, diuji semula pada emas.",
    "mm-system-5m-entry": "Model kemasukan 5 minit dalam kod — kecenderungan HTF, zon jual/beli dan pengesahan, aliran kerja MM secara automatik.",
  },
};
