import type { Messages } from "../types";

// Know Your Style: the assessment, the report screen and the emailed copy.
// moves.* are the "next move" buttons chosen from the two weakest dimensions
// (src/lib/kys/routing.ts holds where each one goes).
export const kys: Messages["kys"] = {
  eyebrow: "Bot · Profil",
  subtitle: "Empat belas pertanyaan, lalu uraian tertulis tentang cara Anda trading: tipe trader Anda, enam dimensi Anda, dan titik lemah yang merugikan Anda.",
  headline: "Setiap trader punya {tell} {find}",
  headlineTell: "ciri khas.",
  headlineFind: "Ayo temukan milik Anda.",
  intro: "Empat belas pertanyaan, sekitar enam menit. Jawab dengan jujur — laporannya hanya sebaik jawaban Anda.",
  getArchetype: "Tipe trader Anda —",
  getArchetypeDetail: "Anda sebenarnya termasuk yang mana dari {n} tipe trader.",
  getDimensions: "Enam dimensi Anda —",
  getDimensionsDetail: "posisi Anda di setiap spektrum, dinilai dari jawaban Anda.",
  getLeak: "Titik lemah Anda —",
  getLeakDetail: "yang paling lemah, dan apa kerugiannya bagi Anda.",
  start: "Mulai penilaian →",
  savedNote: "Tersimpan di profil Anda — Anda bisa kembali kapan saja.",
  measured: "Yang diukur",
  question: "Pertanyaan",
  analysing: {
    s1: "Membaca jawaban Anda…",
    s2: "Memetakan perilaku risiko Anda…",
    s3: "Mencocokkan dengan {n} tipe trader…",
    s4: "Mencari titik lemah Anda…",
    s5: "Menulis penilaian Anda…",
  },
  errorTitle: "Prosesnya tidak selesai.",
  errorSession: "Sesi Anda sudah berakhir. Masuk lagi, lalu coba sekali lagi.",
  errorService: "Laporan belum bisa ditulis saat ini (error {status}). Coba lagi sebentar lagi.",
  errorNetwork: "Kami tidak bisa menghubungi layanan laporan. Cek koneksi Anda dan coba lagi.",
  errorKept: "Jawaban Anda masih tersimpan — coba lagi.",
  yourStyle: "Gaya trading Anda",
  taken: "Diambil {date} · profil tersimpan Anda",
  sendCopy: "Kirimkan salinan ke saya",
  sending: "Mengirim salinan Anda…",
  sent: "Terkirim — cek kotak masuk Anda.",
  sendFailed: "Gagal terkirim. Profil Anda sudah tersimpan — coba lagi dari sini kapan saja.",
  profileTitle: "Profil Anda",
  profileBody: "Enam dimensi cara Anda trading. Anda bukan satu hal saja — inilah gambaran utuhnya, dan yang paling lemah adalah tempat uang Anda bocor.",
  nextMoves: "Langkah berikutnya",
  movesNote: "Dipilih dari tipe trader dan dua dimensi terlemah Anda",
  retake: "Ulangi penilaian",
  fallbackName: "Profil trader Anda",
  leak: "Titik lemah Anda",
  strength: "Kekuatan",
  score: "{score} / 100",
  reportLanguageNote: "Laporan tersimpan Anda ditulis dalam bahasa yang Anda pakai saat penilaian. Ulangi penilaian untuk mendapatkannya dalam bahasa ini.",
  emailEyebrow: "Kenali Gaya Anda · Gaya Trading Anda",
  emailProfileBody: "Enam dimensi cara Anda trading. Yang paling lemah adalah tempat uang Anda bocor.",
  emailSubject: "Hasil Kenali Gaya Anda — {archetype}",
  moves: {
    riskCourse: {
      label: "Modul Manajemen & Rutinitas",
      why: "Batas rugi harian dan ukuran posisi tetap — aturan risiko, dijadikan sistem.",
    },
    decisionTreesRisk: {
      label: "Decision Trees & Invalidation",
      why: "Tahu persis kapan Anda salah, sebelum masuk.",
    },
    ifThen: {
      label: "Baca eBook If-Then",
      why: "Tetapkan reaksi Anda sejak awal agar kerugian tidak mengendalikan Anda.",
    },
    liveClass: {
      label: "Ikuti Kelas Live",
      why: "Lihat MM Desk mengelola posisi dengan tenang, secara real time.",
    },
    startCourse: {
      label: "Mulai Kursus MM System",
      why: "Belajar membaca struktur sendiri, bukan bergantung pada sinyal.",
    },
    todaysRead: {
      label: "Analisis emas hari ini",
      why: "Lihat analisis lengkap disusun dan dijelaskan, sesi demi sesi.",
    },
    backtest: {
      label: "Backtest sebuah strategi",
      why: "Bangun kepercayaan pada aturan Anda agar berani mengeksekusi.",
    },
    decisionTreesDecide: {
      label: "Decision Trees & Invalidation",
      why: "Checklist yang jelas menghapus keraguan di depan chart.",
    },
    oneSystem: {
      label: "Berkomitmen pada satu sistem",
      why: "Satu kerangka, dipelajari dari awal sampai akhir, dijalankan cukup lama untuk terbukti.",
    },
    oneEdge: {
      label: "Satu keunggulan yang sudah di-backtest",
      why: "Pilih satu strategi dan beri sampel yang cukup.",
    },
    dailySop: {
      label: "SOP Harian",
      why: "Rutinitas yang bisa diulang: tandai, tentukan bias, tunggu, konfirmasi, kelola, catat jurnal.",
    },
    dailyPlan: {
      label: "Mulai dengan rencana harian",
      why: "Mulai setiap sesi dengan mengetahui ekspektasi MM Desk dan alasannya.",
    },
  },
};
