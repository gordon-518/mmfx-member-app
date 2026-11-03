import type { Messages } from "../types";

export const account: Messages["account"] = {
  label: "Akun trading",
  addTitle: "Tambahkan nomor akun trading Anda",
  savedHint: "Ganti akun trading? Perbarui ke akun yang paling aktif Anda pakai.",
  emptyHint: "Masukkan login MT4/MT5 live Anda. Pastikan berisi akun yang paling sering Anda tradingkan — jika akun yang tercatat menjadi tidak aktif, Anda bisa terhapus secara keliru.",
  placeholder: "mis. 51234567",
  update: "Perbarui",
  errEmpty: "Masukkan nomor akun trading Anda.",
  errFormat: "Gunakan nomor MT4/MT5 Anda — 4 hingga 15 digit, hanya angka.",
  errSignIn: "Silakan masuk kembali.",
  errSave: "Kami tidak bisa menyimpannya. Silakan coba lagi.",
  gateEyebrow: "Satu langkah lagi",
  gateBody: "Sekarang Anda member terdeposit, hubungkan nomor akun MT4/MT5 live Anda. Ini memastikan akses Anda terikat pada akun yang benar-benar Anda tradingkan — jadi akun lama atau tidak aktif tidak akan membuat Anda terhapus secara keliru.",
  gateHint: "Nanti ganti akun trading? Kembali dan perbarui ke akun yang paling aktif Anda pakai.",
  gateField: "Nomor akun trading",
  gateSubmit: "Simpan & buka meja saya",
};
