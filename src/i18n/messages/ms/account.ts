import type { Messages } from "../types";

export const account: Messages["account"] = {
  label: "Akaun dagangan",
  addTitle: "Tambah nombor akaun dagangan anda",
  savedHint: "Tukar akaun dagangan? Kemas kini kepada akaun yang paling aktif anda gunakan.",
  emptyHint: "Masukkan log masuk MT4/MT5 sebenar anda. Kekalkan pada akaun yang paling kerap anda dagangkan — jika akaun dalam rekod menjadi tidak aktif, anda mungkin dikeluarkan secara tersilap.",
  placeholder: "cth. 51234567",
  update: "Kemas kini",
  errEmpty: "Masukkan nombor akaun dagangan anda.",
  errFormat: "Gunakan nombor MT4/MT5 anda — 4 hingga 15 digit, nombor sahaja.",
  errSignIn: "Sila log masuk semula.",
  errSave: "Kami tidak dapat menyimpannya. Sila cuba lagi.",
  gateEyebrow: "Satu langkah lagi",
  gateBody: "Kini anda ahli berdeposit, pautkan nombor akaun MT4/MT5 sebenar anda. Ini memastikan akses anda terikat pada akaun yang anda benar-benar dagangkan — jadi akaun lama atau tidak aktif tidak akan mengeluarkan anda secara tersilap.",
  gateHint: "Tukar akaun dagangan kemudian? Kembali dan kemas kini kepada akaun yang paling aktif anda gunakan.",
  gateField: "Nombor akaun dagangan",
  gateSubmit: "Simpan & buka meja saya",
};
