import type { Messages } from "../types";

// Know Your Style: the assessment, the report screen and the emailed copy.
// moves.* are the "next move" buttons chosen from the two weakest dimensions
// (src/lib/kys/routing.ts holds where each one goes).
export const kys: Messages["kys"] = {
  eyebrow: "Bot · Profil",
  subtitle: "Empat belas soalan, kemudian huraian bertulis tentang cara anda berdagang: jenis pedagang anda, enam dimensi anda, dan kelemahan yang merugikan anda.",
  headline: "Setiap pedagang ada {tell} {find}",
  headlineTell: "petanda tersendiri.",
  headlineFind: "Mari cari petanda anda.",
  intro: "Empat belas soalan, kira-kira enam minit. Jawab dengan jujur — laporan hanya sebaik apa yang anda beritahu.",
  getArchetype: "Jenis pedagang anda —",
  getArchetypeDetail: "yang mana satu daripada {n} jenis pedagang anda sebenarnya.",
  getDimensions: "Enam dimensi anda —",
  getDimensionsDetail: "kedudukan anda pada setiap spektrum, diskor daripada jawapan anda.",
  getLeak: "Kelemahan anda —",
  getLeakDetail: "yang paling lemah, dan apa kosnya kepada anda.",
  start: "Mulakan penilaian →",
  savedNote: "Disimpan dalam profil anda — anda boleh kembali kepadanya bila-bila masa.",
  measured: "Apa yang diukur",
  question: "Soalan",
  analysing: {
    s1: "Membaca jawapan anda…",
    s2: "Memetakan tingkah laku risiko anda…",
    s3: "Merujuk silang {n} jenis pedagang…",
    s4: "Mencari kelemahan anda…",
    s5: "Menulis penilaian anda…",
  },
  errorTitle: "Ia tidak selesai.",
  errorSession: "Sesi anda telah tamat. Log masuk semula, kemudian cuba sekali lagi.",
  errorService: "Laporan tidak dapat ditulis buat masa ini (ralat {status}). Cuba lagi sebentar nanti.",
  errorNetwork: "Kami tidak dapat menghubungi perkhidmatan laporan. Semak sambungan anda dan cuba lagi.",
  errorKept: "Jawapan anda masih di sini — cuba lagi.",
  yourStyle: "Gaya dagangan anda",
  taken: "Diambil pada {date} · profil anda yang disimpan",
  sendCopy: "Hantar salinan kepada saya",
  sending: "Menghantar salinan anda…",
  sent: "Dihantar — semak peti masuk anda.",
  sendFailed: "Ia tidak dihantar. Profil anda telah disimpan — cuba lagi dari sini bila-bila masa.",
  profileTitle: "Profil anda",
  profileBody: "Enam dimensi cara anda berdagang. Anda bukan satu perkara sahaja — inilah bentuk penuhnya, dan yang paling lemah ialah tempat wang anda bocor.",
  nextMoves: "Langkah seterusnya",
  movesNote: "Dipilih berdasarkan jenis pedagang dan dua dimensi terlemah anda",
  retake: "Ambil semula",
  fallbackName: "Profil pedagang anda",
  leak: "Kelemahan anda",
  strength: "Kekuatan",
  score: "{score} / 100",
  reportLanguageNote: "Laporan anda yang disimpan ditulis dalam bahasa yang anda gunakan semasa penilaian. Ambil semula untuk mendapatkannya dalam bahasa ini.",
  emailEyebrow: "Kenali Gaya Anda · Gaya Dagangan Anda",
  emailProfileBody: "Enam dimensi cara anda berdagang. Yang paling lemah ialah tempat wang anda bocor.",
  emailSubject: "Keputusan Kenali Gaya Anda — {archetype}",
  moves: {
    riskCourse: {
      label: "Modul Pengurusan & Rutin",
      why: "Had rugi harian dan saiz tetap — peraturan risiko, dijadikan sistem.",
    },
    decisionTreesRisk: {
      label: "Decision Trees & Invalidation",
      why: "Tahu dengan tepat bila anda salah, sebelum anda masuk.",
    },
    ifThen: {
      label: "Baca eBuku If-Then",
      why: "Tetapkan reaksi anda lebih awal supaya kerugian tidak mengawal anda.",
    },
    liveClass: {
      label: "Sertai Kelas Langsung",
      why: "Lihat MM Desk mengurus posisi dengan tenang, secara langsung.",
    },
    startCourse: {
      label: "Mulakan Kursus MM System",
      why: "Belajar membaca struktur sendiri dan bukan bergantung pada isyarat.",
    },
    todaysRead: {
      label: "Analisis emas hari ini",
      why: "Lihat analisis penuh dibina dan dihuraikan, sesi demi sesi.",
    },
    backtest: {
      label: "Uji balik strategi",
      why: "Bina kepercayaan pada peraturan anda supaya anda berani bertindak.",
    },
    decisionTreesDecide: {
      label: "Decision Trees & Invalidation",
      why: "Senarai semak yang jelas menghapuskan keraguan di depan carta.",
    },
    oneSystem: {
      label: "Komited pada satu sistem",
      why: "Satu rangka kerja, dipelajari dari awal hingga akhir, didagangkan cukup lama untuk dibuktikan.",
    },
    oneEdge: {
      label: "Satu kelebihan yang diuji balik",
      why: "Pilih satu strategi dan beri ia sampel yang sebenar.",
    },
    dailySop: {
      label: "SOP Harian",
      why: "Rutin yang boleh diulang: tanda, tentukan arah, tunggu, sahkan, urus, catat jurnal.",
    },
    dailyPlan: {
      label: "Mulakan dengan pelan harian",
      why: "Mulakan setiap sesi dengan mengetahui jangkaan MM Desk dan sebabnya.",
    },
  },
};
