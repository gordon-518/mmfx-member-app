import type { Messages } from "../types";

// The indicators page. Indicator names (MM Squeeze Pulse...) are product names
// and stay as they are; types and signal lines are by type key / slug.
export const indicators: Messages["indicators"] = {
  eyebrow: "Alat · XAU/USD",
  title: "Indikator",
  subtitle: "{n} indikator TradingView, diberikan ke akun Anda. Kirim username TradingView Anda di bawah dan kami tambahkan Anda ke seluruh {n} indikator.",
  grantedWhat: "seluruh {n} indikator",
  requestBody: "Masukkan username TradingView Anda untuk mendapat akses ke seluruh {n} indikator. Akses diberikan otomatis — Anda akan ditambahkan dalam beberapa jam.",
  suite: "Suite · {n}",
  view: "Lihat di TradingView",
  soon: "Segera terbit",
  imageAlt: "Pratinjau chart {name}",
  types: {
    Momentum: "Momentum",
    Oscillator: "Osilator",
    Structure: "Struktur",
    MLClassifier: "Klasifikasi ML",
    Trend: "Tren",
    MultiTimeframe: "Multi-timeframe",
    Statistical: "Statistik",
    Entry: "Entry",
  },
  signals: {
    "squeeze-pulse": "Pelepasan squeeze + arah",
    "wave-pressure": "Persilangan zona overbought/oversold",
    "structure-map": "Zona BOS/CHoCH + OB/FVG",
    "echo-predictor": "Bias arah lewat warna bar",
    "trend-rail": "Arah trailing + flip",
    "pivot-trend": "Deteksi pembalikan dini",
    "mtf-minicharts": "Enam timeframe di samping harga live",
    "auto-trendlines": "Pola break-and-retest",
    "adaptive-ma": "Arah kemiringan + rasio efisiensi",
    "reversion-bands": "Sinyal regangan band luar",
  },
};
