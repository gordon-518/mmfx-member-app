import type { Messages } from "../types";

// Know Your Style's fourteen questions. Only the words are here: the scoring
// lives in src/lib/kys/questions.ts and is identical in every language, and the
// answers are stored by option id (a, b, c...), never by their text.
export const kysQuestions: Messages["kysQuestions"] = {
  q1: {
    theme: "Pengalaman",
    text: "Sudah berapa lama Anda trading?",
    options: {
      a: "Kurang dari 6 bulan",
      b: "6 bulan sampai 2 tahun",
      c: "2 sampai 5 tahun",
      d: "Lebih dari 5 tahun",
    },
  },
  q2: {
    theme: "Gaya & Timeframe",
    text: "Berapa lama biasanya durasi trade Anda di XAU/USD?",
    options: {
      a: "Hitungan menit (masuk dan keluar dalam jam yang sama)",
      b: "Hitungan jam (beberapa kali sehari)",
      c: "Satu atau dua hari",
      d: "Beberapa hari sampai minggu",
      e: "Saya belum trading emas",
    },
  },
  q3: {
    theme: "Keunggulan Anda",
    text: "Saat masuk posisi, apa alasan sebenarnya?",
    options: {
      a: "Setup tertentu dari sistem yang saya ikuti",
      b: "Sinyal yang diberikan orang lain",
      c: "Beberapa indikator sejalan sekaligus (RSI + MACD + MA)",
      d: "Peristiwa berita atau rilis data ekonomi",
      e: "Firasat dari apa yang saya lihat",
      f: "Saya hanya ingin punya posisi terbuka",
    },
  },
  q4: {
    theme: "Risiko & Ukuran Posisi",
    text: "Bagaimana Anda menggambarkan ukuran posisi Anda yang biasa?",
    options: {
      a: "Kecil dan konsisten (% yang sama di setiap trade)",
      b: "Sedikit berubah saat saya lebih yakin",
      c: "Kadang besar saat saya yakin",
      d: "Saya perbesar ukuran saat rugi untuk membalikkannya",
      e: "Tidak ada rencana yang jelas",
    },
  },
  q5: {
    theme: "Titik Lemah Anda",
    text: "Mana yang paling merugikan Anda?",
    options: {
      a: "Ragu-ragu dan melewatkan trade yang seharusnya saya ambil",
      b: "Mengejar harga setelah pergerakannya sudah lewat",
      c: "Overtrading saat tidak ada peluang",
      d: "Akun jebol setelah rentetan kerugian",
      e: "Gonta-ganti sistem sebelum ada yang sempat terbukti",
      f: "Indikator saling bertentangan dan saya jadi beku",
      g: "Saya belum cukup banyak trading untuk tahu",
    },
  },
  q6: {
    theme: "Sinyal",
    text: "Bagaimana Anda memakai sinyal dari orang lain?",
    options: {
      a: "Saya ikuti mentah-mentah, itulah seluruh pendekatan saya",
      b: "Saya pakai sebagai salah satu masukan di samping analisis saya sendiri",
      c: "Saya abaikan sepenuhnya",
      d: "Saya tidak mengikuti sumber sinyal mana pun",
    },
  },
  q7: {
    theme: "Psikologi",
    text: "Setelah rugi, apa yang paling sering Anda lakukan?",
    options: {
      a: "Tenang — saya evaluasi lalu lanjut",
      b: "Saya ingin langsung membalikkannya",
      c: "Saya menjauh sebentar dan kembali dalam kondisi baik",
      d: "Saya menghindari trading selama berhari-hari",
      e: "Saya belum pernah rugi yang berarti",
    },
  },
  q8: {
    theme: "Motivasi",
    text: "Mengapa Anda trading?",
    options: {
      a: "Membangun penghasilan yang konsisten",
      b: "Menambah penghasilan dari sumber lain",
      c: "Bersiap untuk prop firm",
      d: "Trading penuh waktu suatu saat nanti",
      e: "Penasaran / sedang mencoba",
      f: "Belum yakin",
    },
  },
  q9: {
    theme: "Rutinitas Anda",
    text: "Sebelum membuka posisi, seberapa sering rencananya — entry, stop, target — sudah ditentukan sebelumnya?",
    options: {
      a: "Selalu — sudah tertulis sebelum saya klik",
      b: "Biasanya, setidaknya jelas di kepala",
      c: "Kadang — tergantung setup-nya",
      d: "Jarang — saya putuskan sambil jalan",
    },
  },
  q10: {
    theme: "Evaluasi & Jurnal",
    text: "Apakah Anda mencatat jurnal trading dan mengevaluasinya?",
    options: {
      a: "Setiap trade, dievaluasi rutin",
      b: "Kadang-kadang",
      c: "Pernah mencoba tapi tidak konsisten",
      d: "Tidak, saya tidak membuat jurnal",
    },
  },
  q11: {
    theme: "Komitmen",
    text: "Anda sudah menjalankan satu strategi selama 8 trade dan sedikit minus. Apa langkah Anda?",
    options: {
      a: "8 trade belum membuktikan apa-apa — lanjutkan sampai sampelnya cukup",
      b: "Ubah sedikit aturannya lalu lanjut",
      c: "Mulai mencari strategi yang lebih baik",
      d: "Berhenti trading sampai saya kembali yakin",
    },
  },
  q12: {
    theme: "Ketegasan",
    text: "Setup yang biasa Anda trading muncul, tapi hanya sekitar 80% sesuai buku. Apa yang Anda lakukan?",
    options: {
      a: "Ambil — tidak ada setup yang 100%",
      b: "Ambil, tapi dengan ukuran lebih kecil",
      c: "Tunggu konfirmasi tambahan",
      d: "Lewati — saya hanya mengambil setup yang sempurna",
    },
  },
  q13: {
    theme: "Di Bawah Tekanan",
    text: "Emas melonjak 30 pip melawan posisi Anda beberapa detik setelah masuk — stop Anda belum kena. Apa yang sebenarnya terjadi?",
    options: {
      a: "Tidak ada — stop saya sudah dipasang dan saya biarkan",
      b: "Saya pantau ketat, siap keluar lebih awal",
      c: "Saya geser stop lebih jauh untuk memberi ruang",
      d: "Saya tambah posisi untuk harga rata-rata yang lebih baik",
    },
  },
  q14: {
    theme: "Kemandirian",
    text: "Jika semua grup sinyal dan indikator hilang besok, bisakah Anda menemukan dan mengelola trade di chart XAU/USD yang polos?",
    options: {
      a: "Ya, dengan nyaman — saya membaca struktur sendiri",
      b: "Sebagian besar bisa, tapi lebih lambat",
      c: "Tidak juga — saya bergantung pada alat dan sinyal saya",
      d: "Tidak — saya tidak tahu harus mulai dari mana",
    },
  },
};
