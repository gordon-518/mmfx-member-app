import type { Messages } from "../types";

// The in-app help chat. The assistant's own replies are written by the model
// in the member's language; these are the panel's words.
export const chat: Messages["chat"] = {
  open: "Tanya MMFX",
  openAria: "Buka sembang bantuan",
  close: "Tutup sembang",
  title: "Tanya MMFX",
  subtitle: "Jawapan tentang aplikasi dan keahlian anda, dalam beberapa saat. Seorang pegawai mengambil alih apabila perlu.",
  greeting: "Hai! Saya boleh bantu tentang aplikasi, pelan anda, deposit dan alat-alat. Apa yang anda ingin tahu?",
  suggestions: {
    tiers: "Bagaimana tahap berfungsi?",
    indicators: "Bagaimana mendapatkan indikator?",
    start: "Dari mana saya patut mula?",
    deposit: "Bagaimana menghantar deposit?",
  },
  placeholder: "Taip soalan anda…",
  send: "Hantar",
  sending: "Menghantar…",
  you: "Anda",
  assistant: "Pembantu MMFX",
  team: "Pasukan MMFX",
  handoff: "Saya telah serahkan perkara ini kepada pasukan. Seorang pegawai akan membalas di sini, biasanya dalam waktu pejabat Singapura.",
  resolved: "Pasukan telah menyelesaikannya. Pembantu kembali jika anda ada soalan lain.",
  waiting: "Pasukan telah menerima mesej anda dan akan membalas di sini.",
  thinking: "Sedang berfikir…",
  noAdvice: "Pembantu menerangkan aplikasi dan keahlian anda. Ia tidak memberi nasihat dagangan.",
  errors: {
    rate_limited: "Anda menghantar mesej terlalu cepat. Tunggu seminit dan cuba lagi.",
    invalid: "Mesej boleh mengandungi sehingga 1,000 aksara.",
    server: "Ada sesuatu yang tidak kena. Cuba lagi sebentar lagi.",
    busy: "Masih menjawab mesej anda yang terakhir. Sebentar.",
    unauthorized: "Sesi anda telah tamat. Log masuk semula untuk terus bersembang.",
  },
  privacy: "Jangan kongsi kata laluan atau kod di sini. Pasukan tidak akan memintanya.",
  unread: "Balasan baharu daripada pasukan",
};
