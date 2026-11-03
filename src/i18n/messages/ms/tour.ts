import type { Messages } from "../types";

// The guided tour's words, by step key (components/tour/steps.ts holds the
// structure: which element each stop points at).
export const tour: Messages["tour"] = {
  dialogLabel: "Cara menggunakan aplikasi",
  close: "Tutup lawatan",
  stepOf: "Langkah {n} daripada {total}",
  steps: {
    intro: {
      title: "Mari saya tunjukkan",
      body: "Sembilan hentian ringkas, kira-kira dua minit. Pada akhirnya anda akan tahu di mana semuanya berada dan fungsi setiap bahagian. Anda boleh keluar bila-bila masa.",
    },
    nav: {
      title: "Semuanya dalam satu menu ini",
      body: "Seluruh meja ada di sebelah kiri, dikumpulkan mengikut cara anda benar-benar menggunakannya: membaca pasaran, melaksanakan, mengurus dagangan, dan asas di bawah ketiga-tiganya.",
    },
    home: {
      title: "Mula di sini dan Papan pemuka",
      body: "Mula di sini ialah halaman yang anda buka sekarang: enam langkah anda dan kemajuan anda. Papan pemuka ialah rumah harian anda — apa yang baharu, dan apa yang perlu dibuat seterusnya.",
    },
    read: {
      title: "Baca pasaran",
      body: "Mulakan sesi dengan ini. Analisis Harian ialah bacaan meja tentang emas beserta parasnya; Meja Fundamental membaca faktor makro merentasi sebelas instrumen; Berita dan Kalendar memberitahu apa yang akan datang.",
    },
    execute: {
      title: "Laksana",
      body: "Tempat pelan menjadi dagangan. Isyarat ialah isyarat meja, Indikator meletakkan alat kami pada carta TradingView anda sendiri, dan Strategi ialah sistem yang ditulis sebagai skrip.",
    },
    manage: {
      title: "Urus dagangan",
      body: "Bahagian paling sukar, dan tempat kebanyakan akaun hilang. Kelas Langsung berdagang bersama anda, Kenali Gaya Anda mencari tabiat yang merugikan anda, dan Pembantu Dagangan AI menyemak dagangan sebenar anda.",
    },
    foundations: {
      title: "Asas",
      body: "Kursus MM System — sembilan belas pelajaran daripada minda hingga mengurus posisi — serta perpustakaan bertulis di sebaliknya. Kembali ke sini bila-bila masa sesuatu di atas tidak masuk akal.",
    },
    account: {
      title: "Pelan anda ada di sini",
      body: "Tahap anda dipaparkan di bawah e-mel anda. Ikon mangga di sebelah mana-mana item menu bermaksud ia dibuka pada tahap yang lebih tinggi — ketik untuk melihat isinya sebelum membuat sebarang keputusan.",
    },
    steps: {
      title: "Kemudian ikut senarai",
      body: "Enam langkah anda, mengikut urutan, setiap satu dengan apa yang anda peroleh dan sasaran selepasnya. Satu sehari sudah memadai.",
    },
    done: {
      title: "Itulah meja",
      body: "Anda boleh menjalankan lawatan ini semula bila-bila masa melalui butang di bahagian atas Mula di sini. Langkah pertama ialah menyertai saluran awam — ia mengambil masa kira-kira sepuluh saat.",
    },
  },
};
