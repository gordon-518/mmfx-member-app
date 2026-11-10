import type { Messages } from "../types";

// Locked feature pages, the lock veil and the members-only panel. Compliance:
// say what each tool is, never what it earns.
export const locked: Messages["locked"] = {
  features: {
    indicators: {
      eyebrow: "Alat · TradingView",
      title: "Indikator",
      pitch: "Indikator TradingView MM System yang hanya melalui jemputan, diberikan terus kepada nama pengguna TradingView anda.",
      points: {
        p1: "Garis arah automatik, pivot dan paparan pelbagai rangka masa",
        p2: "Pada carta anda sendiri, dalam TradingView",
        p3: "Akses diberikan secara automatik",
      },
    },
    strategies: {
      eyebrow: "Alat · TradingView",
      title: "Strategi",
      pitch: "Skrip strategi TradingView yang boleh diuji semula, mengekod peraturan MM System.",
      points: {
        p1: "Uji peraturan pada data sejarah sendiri",
        p2: "Model kemasukan daripada kursus, dalam bentuk kod",
        p3: "Pada carta anda sendiri, dalam TradingView",
      },
    },
    library: {
      eyebrow: "Pendidikan · Perpustakaan",
      title: "Perpustakaan MM",
      pitch: "Empat eBuku MM: sistemnya, buku panduannya dan pemikiran di sebaliknya.",
      points: {
        p1: "MM System, dalam bentuk tulisan",
        p2: "Buku panduan untuk disimpan di sebelah carta",
        p3: "Muat turun dan baca di luar talian",
      },
    },
    "live-classes": {
      eyebrow: "Pendidikan · Langsung",
      title: "Kelas Langsung",
      pitch: "Sesi pada carta bersama MM Desk, membaca pasaran semasa ia bergerak.",
      points: {
        p1: "Secara langsung pada carta bersama MM Desk",
        p2: "Tanya soalan ketika ia berlaku",
        p3: "Rakaman sesi lalu",
      },
    },
    "fundamental-desk": {
      eyebrow: "Bot · Makro",
      title: "Fundamental Desk",
      pitch: "Analisis makro langsung tentang emas: gambaran fundamental yang menggerakkan XAU/USD, dengan bahasa yang mudah.",
      points: {
        p1: "Apa yang menggerakkan emas hari ini, dan mengapa",
        p2: "Kadar faedah, dolar dan risiko dalam satu analisis",
        p3: "Dikemas kini sepanjang sesi",
      },
    },
    "ai-trading-assistant": {
      eyebrow: "Team MM · AI",
      title: "Pembantu Dagangan AI",
      pitch: "Sambungkan akaun dagangan anda dan dapatkan jurulatih yang menyemak setiap dagangan anda berdasarkan MM System.",
      points: {
        p1: "Setiap dagangan disemak secara automatik",
        p2: "Corak dalam dagangan anda sendiri, dikesan untuk anda",
        p3: "Dibina berdasarkan MM System",
      },
    },
    "team-mm": {
      eyebrow: "Team MM · Komuniti",
      title: "Team MM",
      pitch: "Saluran peribadi Team MM, bersama MM Desk.",
      points: {
        p1: "Terus daripada MM Desk",
        p2: "Ahli Team MM sahaja",
        p3: "Di Telegram",
      },
    },
  },
  fallbackTitle: "Bahagian MM Desk ini dikunci",
  fallbackPitch: "Ia dibuka apabila anda deposit ke akaun anda.",
  openOnEvery: "Dibuka pada setiap pelan",
  openNow: "Dibuka pada pelan anda sekarang",
  freeSignals: "Saluran isyarat",
  freeNews: "Berita",
  freeCourse: "Kursus · Modul 1",
  membersOnly: "Ahli sahaja",
  membersTitle: "{feature} untuk ahli MM System",
  perkTeam: "Team MM — saluran isyarat VIP peribadi",
  perkJournal: "Jurnal dagangan AI",
  perkEas: "EA automatik — akan datang",
  become: "Jadi ahli",
  trialNote: "Anda dalam percubaan percuma — deposit ke akaun broker anda sendiri untuk membuka semuanya.",
  freeNote: "Anda pada pelan Percuma — deposit ke akaun broker anda sendiri untuk membuka semuanya.",
  paidNote: "Anda pada {tier} — deposit anda setakat ini dikira untuk {feature}, jadi anda hanya perlu tambah bezanya.",
};
