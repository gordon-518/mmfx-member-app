import type { Messages } from "../types";

// The indicators page. Indicator names (MM Squeeze Pulse...) are product names
// and stay as they are; types and signal lines are by type key / slug.
export const indicators: Messages["indicators"] = {
  eyebrow: "Alat · XAU/USD",
  title: "Indikator",
  subtitle: "{n} indikator TradingView, diberikan kepada akaun anda. Hantar nama pengguna TradingView anda di bawah dan kami tambah anda kepada kesemua {n}.",
  grantedWhat: "kesemua {n} indikator",
  requestBody: "Masukkan nama pengguna TradingView anda untuk mendapat akses kepada kesemua {n} indikator. Akses diberikan secara automatik — anda akan ditambah dalam beberapa jam.",
  suite: "Suite · {n}",
  view: "Lihat di TradingView",
  soon: "Akan diterbitkan",
  imageAlt: "Pratonton carta {name}",
  types: {
    Momentum: "Momentum",
    Oscillator: "Pengayun",
    Structure: "Struktur",
    MLClassifier: "Pengelas ML",
    Trend: "Arah aliran",
    MultiTimeframe: "Pelbagai rangka masa",
    Statistical: "Statistik",
    Entry: "Kemasukan",
  },
  signals: {
    "squeeze-pulse": "Pelepasan himpitan + arah",
    "wave-pressure": "Lintasan zon terlebih beli/terlebih jual",
    "structure-map": "Zon BOS/CHoCH + OB/FVG",
    "echo-predictor": "Kecenderungan arah melalui warna bar",
    "trend-rail": "Arah jejak + pembalikan",
    "pivot-trend": "Pengesanan pembalikan awal",
    "mtf-minicharts": "Enam rangka masa di sebelah harga langsung",
    "auto-trendlines": "Corak tembus-dan-uji semula",
    "adaptive-ma": "Arah cerun + nisbah kecekapan",
    "reversion-bands": "Isyarat regangan jalur luar",
  },
};
