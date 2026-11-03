import type { Messages } from "../types";

// The in-app help chat. The assistant's own replies are written by the model
// in the member's language; these are the panel's words.
export const chat: Messages["chat"] = {
  open: "Tanya MMFX",
  openAria: "Buka chat bantuan",
  close: "Tutup chat",
  title: "Tanya MMFX",
  subtitle: "Jawaban seputar aplikasi dan keanggotaan Anda, dalam hitungan detik. Petugas kami mengambil alih bila perlu.",
  greeting: "Hai! Saya bisa bantu soal aplikasi, paket Anda, deposit, dan alat-alatnya. Apa yang ingin Anda ketahui?",
  suggestions: {
    tiers: "Bagaimana cara kerja tingkatnya?",
    indicators: "Bagaimana mendapatkan indikatornya?",
    start: "Saya harus mulai dari mana?",
    deposit: "Bagaimana cara mengirim deposit?",
  },
  placeholder: "Ketik pertanyaan Anda…",
  send: "Kirim",
  sending: "Mengirim…",
  you: "Anda",
  assistant: "Asisten MMFX",
  team: "Tim MMFX",
  handoff: "Pertanyaan ini sudah saya teruskan ke tim. Petugas akan membalas di sini, biasanya pada jam kantor Singapura.",
  resolved: "Tim sudah menyelesaikannya. Asisten kembali jika Anda punya pertanyaan lain.",
  waiting: "Tim sudah menerima pesan Anda dan akan membalas di sini.",
  thinking: "Sedang berpikir…",
  noAdvice: "Asisten menjelaskan aplikasi dan keanggotaan Anda. Asisten tidak memberikan saran trading.",
  errors: {
    rate_limited: "Anda mengirim pesan terlalu cepat. Tunggu satu menit lalu coba lagi.",
    invalid: "Pesan bisa berisi hingga 1.000 karakter.",
    server: "Terjadi kesalahan. Coba lagi sebentar lagi.",
    busy: "Masih membalas pesan terakhir Anda. Mohon tunggu sebentar.",
    unauthorized: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan chat.",
  },
  privacy: "Jangan bagikan kata sandi atau kode di sini. Tim tidak akan pernah memintanya.",
  unread: "Balasan baru dari tim",
};
