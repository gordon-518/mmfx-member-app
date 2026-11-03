import type { Messages } from "../types";

// The TradingView access block on /indicators and /strategies, and the
// username errors (by code: the actions redirect with ?tv_error=<code>).
export const tv: Messages["tv"] = {
  grantedBadge: "Akses diberikan · otomatis",
  grantedBody: "Akses telah diberikan otomatis ke {username} di TradingView. Anda seharusnya melihat {what} di akun Anda dalam 1–3 jam.",
  updatePlaceholder: "perbarui username",
  update: "Perbarui",
  request: "Minta akses",
  usernamePlaceholder: "username TradingView Anda",
  hint: "Gunakan username TradingView Anda (@handle), bukan nama tampilan atau email — keduanya sering berbeda. Temukan di tradingview.com → avatar Anda → @nama.",
  errors: {
    empty: "Masukkan username TradingView Anda.",
    email: "Itu terlihat seperti email — masukkan username TradingView Anda (@handle), bukan email.",
    spaces: "Username TradingView tidak memakai spasi — masukkan @username Anda, bukan nama tampilan.",
    chars: "Gunakan huruf, angka, dan garis bawah saja — ini username TradingView Anda, bukan nama tampilan.",
    generic: "Username itu tidak bisa disimpan. Periksa lalu coba lagi.",
  },
};
