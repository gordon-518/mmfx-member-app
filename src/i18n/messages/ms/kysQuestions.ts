import type { Messages } from "../types";

// Know Your Style's fourteen questions. Only the words are here: the scoring
// lives in src/lib/kys/questions.ts and is identical in every language, and the
// answers are stored by option id (a, b, c...), never by their text.
export const kysQuestions: Messages["kysQuestions"] = {
  q1: {
    theme: "Pengalaman",
    text: "Sudah berapa lama anda berdagang?",
    options: {
      a: "Kurang daripada 6 bulan",
      b: "6 bulan hingga 2 tahun",
      c: "2 hingga 5 tahun",
      d: "Lebih 5 tahun",
    },
  },
  q2: {
    theme: "Gaya & Jangka Masa",
    text: "Berapa lama biasanya tempoh dagangan anda bagi XAU/USD?",
    options: {
      a: "Beberapa minit (masuk dan keluar dalam jam yang sama)",
      b: "Beberapa jam (beberapa kali sehari)",
      c: "Sehari dua",
      d: "Beberapa hari hingga minggu",
      e: "Saya belum berdagang emas",
    },
  },
  q3: {
    theme: "Kelebihan Anda",
    text: "Apabila anda masuk dagangan, apakah sebab sebenarnya?",
    options: {
      a: "Setup khusus daripada sistem yang saya ikuti",
      b: "Isyarat yang diberikan oleh orang lain",
      c: "Beberapa indikator sejajar serentak (RSI + MACD + MA)",
      d: "Peristiwa berita atau keluaran data ekonomi",
      e: "Gerak hati berdasarkan apa yang saya lihat",
      f: "Saya cuma mahu ada dagangan terbuka",
    },
  },
  q4: {
    theme: "Risiko & Saiz",
    text: "Bagaimana anda menggambarkan saiz posisi anda yang biasa?",
    options: {
      a: "Kecil dan konsisten (% yang sama setiap dagangan)",
      b: "Berubah sedikit apabila saya lebih yakin",
      c: "Kadang-kadang besar apabila saya pasti",
      d: "Saya besarkan saiz ketika rugi untuk menebusnya semula",
      e: "Tiada pelan sebenar",
    },
  },
  q5: {
    theme: "Kelemahan Anda",
    text: "Antara berikut, yang mana paling merugikan anda?",
    options: {
      a: "Teragak-agak dan terlepas dagangan yang sepatutnya saya ambil",
      b: "Mengejar harga selepas pergerakan sudah berlalu",
      c: "Berdagang berlebihan apabila tiada peluang",
      d: "Akaun musnah selepas siri kerugian",
      e: "Menukar sistem sebelum mana-mana satu sempat berfungsi",
      f: "Indikator bercanggah dan saya jadi kaku",
      g: "Saya belum cukup berdagang untuk tahu",
    },
  },
  q6: {
    theme: "Isyarat",
    text: "Bagaimana anda menggunakan isyarat daripada orang lain?",
    options: {
      a: "Saya ikut membuta tuli, itulah seluruh pendekatan saya",
      b: "Saya gunakan sebagai satu input bersama analisis saya sendiri",
      c: "Saya abaikan sepenuhnya",
      d: "Saya tidak mengikuti mana-mana sumber isyarat",
    },
  },
  q7: {
    theme: "Psikologi",
    text: "Selepas rugi, apakah reaksi anda yang paling biasa?",
    options: {
      a: "Tenang — saya semak semula dan teruskan",
      b: "Saya mahu menebusnya serta-merta",
      c: "Saya berehat seketika dan kembali dalam keadaan baik",
      d: "Saya elak berdagang selama beberapa hari",
      e: "Saya belum pernah rugi dengan ketara",
    },
  },
  q8: {
    theme: "Motivasi",
    text: "Mengapa anda berdagang?",
    options: {
      a: "Membina pendapatan yang konsisten",
      b: "Menambah pendapatan daripada sumber lain",
      c: "Bersedia untuk prop firm",
      d: "Berdagang sepenuh masa satu hari nanti",
      e: "Ingin tahu / sedang meneroka",
      f: "Belum pasti",
    },
  },
  q9: {
    theme: "Rutin Anda",
    text: "Sebelum membuat dagangan, sekerap mana pelan — masuk, stop, sasaran — ditetapkan lebih awal?",
    options: {
      a: "Sentiasa — ia ditulis sebelum saya klik",
      b: "Biasanya, sekurang-kurangnya jelas dalam fikiran",
      c: "Kadang-kadang — bergantung pada setup",
      d: "Jarang — saya putuskan sambil ia berlaku",
    },
  },
  q10: {
    theme: "Semakan & Jurnal",
    text: "Adakah anda mencatat jurnal dagangan dan menyemaknya?",
    options: {
      a: "Setiap dagangan, disemak secara berkala",
      b: "Sekali-sekala",
      c: "Pernah cuba tetapi tidak berterusan",
      d: "Tidak, saya tidak menulis jurnal",
    },
  },
  q11: {
    theme: "Komitmen",
    text: "Anda telah mengikut satu strategi untuk 8 dagangan dan sedikit rugi. Apa langkah anda?",
    options: {
      a: "8 dagangan tidak membuktikan apa-apa — teruskan sehingga sampel sebenar",
      b: "Ubah sedikit peraturan dan teruskan",
      c: "Mula mencari strategi yang lebih baik",
      d: "Berhenti berdagang sehingga saya rasa yakin semula",
    },
  },
  q12: {
    theme: "Ketegasan",
    text: "Setup yang anda dagangkan muncul, tetapi hanya kira-kira 80% seperti buku teks. Apa yang anda lakukan?",
    options: {
      a: "Ambil — tiada setup yang pernah 100%",
      b: "Ambil, tetapi dengan saiz lebih kecil",
      c: "Tunggu pengesahan tambahan",
      d: "Langkau — saya hanya ambil setup yang sempurna",
    },
  },
  q13: {
    theme: "Di Bawah Tekanan",
    text: "Emas melonjak 30 pip menentang anda beberapa saat selepas anda masuk — stop anda belum kena. Apa yang sebenarnya berlaku?",
    options: {
      a: "Tiada apa-apa — stop saya sudah ditetapkan dan saya biarkan",
      b: "Saya perhatikan dengan teliti, bersedia untuk keluar awal",
      c: "Saya jauhkan stop untuk memberi ruang",
      d: "Saya tambah posisi untuk purata harga yang lebih baik",
    },
  },
  q14: {
    theme: "Berdikari",
    text: "Jika semua kumpulan isyarat dan indikator hilang esok, bolehkah anda mencari dan mengurus dagangan pada carta XAU/USD yang kosong?",
    options: {
      a: "Ya, dengan selesa — saya membaca struktur sendiri",
      b: "Kebanyakannya, tetapi saya lebih perlahan",
      c: "Tidak juga — saya bergantung pada alat dan isyarat saya",
      d: "Tidak — saya tidak tahu di mana hendak bermula",
    },
  },
};
