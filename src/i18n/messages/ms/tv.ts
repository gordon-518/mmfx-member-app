import type { Messages } from "../types";

// The TradingView access block on /indicators and /strategies, and the
// username errors (by code: the actions redirect with ?tv_error=<code>).
export const tv: Messages["tv"] = {
  grantedBadge: "Akses diberikan · automatik",
  grantedBody: "Akses telah diberikan secara automatik kepada {username} di TradingView. Anda sepatutnya melihat {what} dalam akaun anda dalam masa 1–3 jam.",
  updatePlaceholder: "kemas kini nama pengguna",
  update: "Kemas kini",
  request: "Minta akses",
  usernamePlaceholder: "nama pengguna TradingView anda",
  hint: "Gunakan nama pengguna TradingView anda (@handle), bukan nama paparan atau e-mel — selalunya ia berbeza. Cari di tradingview.com → avatar anda → @nama.",
  errors: {
    empty: "Masukkan nama pengguna TradingView anda.",
    email: "Itu kelihatan seperti e-mel — masukkan nama pengguna TradingView anda (@handle), bukan e-mel anda.",
    spaces: "Nama pengguna TradingView tidak mempunyai ruang — masukkan @username anda, bukan nama paparan.",
    chars: "Gunakan huruf, nombor dan garis bawah sahaja — ini nama pengguna TradingView anda, bukan nama paparan.",
    generic: "Nama pengguna itu tidak dapat disimpan. Semak dan cuba lagi.",
  },
};
