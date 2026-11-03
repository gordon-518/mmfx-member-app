import type { Messages } from "../types";

// The guided tour's words, by step key (components/tour/steps.ts holds the
// structure: which element each stop points at).
export const tour: Messages["tour"] = {
  dialogLabel: "Cara memakai aplikasi",
  close: "Tutup tur",
  stepOf: "Langkah {n} dari {total}",
  steps: {
    intro: {
      title: "Mari saya tunjukkan",
      body: "Sembilan perhentian singkat, sekitar dua menit. Setelah selesai, Anda akan tahu di mana semuanya berada dan apa fungsi setiap bagian. Anda bisa keluar kapan saja.",
    },
    nav: {
      title: "Semuanya ada di menu ini",
      body: "Seluruh meja ada di sisi kiri, dikelompokkan sesuai cara Anda benar-benar memakainya: membaca pasar, eksekusi, mengelola trade, dan fondasi di bawah ketiganya.",
    },
    home: {
      title: "Mulai di sini dan Dasbor",
      body: "Mulai di sini adalah halaman yang sedang Anda buka: enam langkah Anda dan progres Anda. Dasbor adalah beranda harian — apa yang baru, dan apa yang perlu dilakukan berikutnya.",
    },
    read: {
      title: "Baca pasar",
      body: "Buka sesi dengan ini. Analisis Harian adalah bacaan meja tentang emas beserta levelnya; Meja Fundamental membaca faktor makro di sebelas instrumen; Berita dan Kalender memberi tahu apa yang akan datang.",
    },
    execute: {
      title: "Eksekusi",
      body: "Tempat rencana menjadi trade. Sinyal adalah call dari meja, Indikator memasang alat kami di chart TradingView Anda sendiri, dan Strategi adalah sistem yang ditulis sebagai skrip.",
    },
    manage: {
      title: "Kelola trade",
      body: "Bagian tersulit, dan tempat sebagian besar akun habis. Kelas Live trading bersama Anda, Kenali Gaya Anda menemukan kebiasaan yang merugikan Anda, dan Asisten Trading AI meninjau trade nyata Anda.",
    },
    foundations: {
      title: "Fondasi",
      body: "Kursus MM System — sembilan belas pelajaran dari mindset hingga mengelola posisi — dan perpustakaan tertulis di baliknya. Kembali ke sini kapan pun ada yang belum masuk akal.",
    },
    account: {
      title: "Paket Anda ada di sini",
      body: "Tingkat Anda ditampilkan di bawah email Anda. Ikon gembok di samping item menu berarti fitur itu terbuka di tingkat yang lebih tinggi — ketuk untuk melihat isinya sebelum memutuskan apa pun.",
    },
    steps: {
      title: "Lalu ikuti daftarnya",
      body: "Enam langkah Anda, berurutan, masing-masing dengan manfaatnya dan target setelahnya. Satu per hari sudah cukup.",
    },
    done: {
      title: "Itulah meja",
      body: "Anda bisa menjalankan tur ini lagi kapan saja lewat tombol di bagian atas Mulai di sini. Langkah pertama adalah bergabung ke channel publik — hanya butuh sekitar sepuluh detik.",
    },
  },
};
