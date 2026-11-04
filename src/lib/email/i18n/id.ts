import type { EmailMessages } from "./types";

// The member emails in Bahasa Indonesia, polite "Anda" as the app writes it.
// Terms follow the app's id dictionary (src/i18n/messages/id) so an email and
// the page it links to agree. "MM Desk", "Fundamental Desk" and the paid tier
// names stay in English as names, never translated; signed by Don.
export const id: EmailMessages = {
  common: {
    hi: "Halo {name},",
    hiNoName: "Halo,",
    signoff: "— Don, Market Makers FX",
    bias: { bullish: "Bullish", bearish: "Bearish", neutral: "Netral" },
    biasLine: "Bias: {bias}",
    deskWritesEnglish: "MM Desk menulis analisisnya dalam bahasa Inggris.",
  },

  shell: {
    footerNote: "Anda menerima email ini karena Anda memiliki akun Market Makers FX.",
    unsubscribe: "Berhenti berlangganan",
    riskLine: "Trading melibatkan risiko, termasuk kemungkinan kehilangan modal. Isi email ini bukan merupakan saran keuangan.",
    contextDay: "HARI {day} / 14",
    contextMember: "MEMBER",
    contextDesk: "MM DESK · XAU/USD",
  },

  tracker: {
    title: "14 HARI PERTAMA ANDA",
    textTitle: "14 hari pertama Anda:",
    today: "HARI INI",
    day: "HARI {day}",
    textDay: "(hari ke-{day})",
    done: "Selesai",
    notDone: "Belum selesai",
    steps: {
      analysis: "Baca Analisis Harian hari ini",
      kys: "Kenali Gaya Anda — 3 menit",
      tv: "Hubungkan TradingView",
      lesson1: "Pelajaran 1 — Golden Mindset",
      desk: "Lihat yang dibuka setiap tingkat",
    },
  },

  ladder: {
    rungs: {
      free: { name: "Gratis", amount: "tanpa deposit", line: "Analisis Harian, Kenali Gaya Anda, kalender, berita, Modul 1" },
      foundation: { name: "Foundation", amount: "$50", line: "kursus lengkap dan Perpustakaan MM" },
      desk: { name: "Desk", amount: "$200", line: "indikator, strategi, kelas live, Fundamental Desk" },
      team: { name: "Team MM", amount: "$500", line: "channel Team MM dan Asisten Trading AI" },
    },
    note: "Setiap angka adalah deposit ke akun Anda sendiri di broker partner, atas nama Anda, dan bisa Anda tarik.",
  },

  lifecycle: {
    welcome: {
      copy: {
        subject: "Mulai dengan analisis emas hari ini",
        preheader: "Satu halaman tentang XAU/USD, dianalisis dari chart harian. Cukup tiga menit saja.",
        paragraphs: [
          "Mulai di sini: buka Analisis Harian hari ini. Satu halaman tentang emas, dianalisis secara top-down mulai dari chart harian. Tiga menit, dan Anda akan tahu bagaimana MM Desk membaca harga di sesi ini.",
          "Analisis ini terbit setiap hari trading. Ini MM Desk, bukan perpustakaan kursus: analisisnya ada untuk Anda pertanyakan, agar Anda membangun pandangan sendiri dan bukan meminjam pandangan kami.",
          "Uji coba 14 hari Anda sudah aktif, dan akses ini tidak dipungut biaya apa pun. Kami adalah introducing broker, jadi broker yang membayar kami saat Anda trading. Setiap deposit masuk ke akun Anda sendiri, atas nama Anda, dan tetap milik Anda. Setelah hari ke-14, Analisis Harian, Kenali Gaya Anda, dan Modul 1 kursus tetap terbuka.",
        ],
        ctaLabel: "Buka analisis hari ini",
      },
      heroEyebrow: "Selamat datang di MM Desk",
      heroHeadline: "BACA PASAR.\nBARU BERTINDAK.",
      todayRead: "Analisis hari ini: {title} — bias {bias}.",
      todayReadNoBias: "Analisis hari ini: {title}.",
      noRead: "Analisis hari ini terbit pada sesi Asia. Itulah hal pertama yang perlu dicek setiap pagi.",
    },
    analysis: {
      copy: {
        subject: "Analisis emas hari ini",
        preheader: "Ditulis sebelum sesi dibuka. Video singkat, PDF, dan level yang sedang dipantau.",
        paragraphs: [
          "Setiap pagi di hari trading, MM Desk menuliskan analisisnya tentang emas sebelum sesi dibuka. Analisis hari ini ada di email ini, beserta bias yang menjadi pegangannya.",
          "Video singkat dan PDF. Posisi harga sepanjang malam, dan level yang sedang dipantau MM Desk.",
          "Anda tidak harus setuju. Bandingkan dengan chart Anda sendiri dan lihat di mana keduanya berbeda.",
        ],
        ctaLabel: "Buka analisis hari ini",
      },
      todayUp: "Analisis hari ini sudah terbit: {title}, bias {bias}.",
      noRead: "Analisis berikutnya terbit sebelum sesi dimulai.",
    },
    kys: {
      copy: {
        subject: "Delapan tipe trader. Satu milik Anda.",
        preheader: "Tiga menit menjawab pertanyaan, lalu kebiasaan yang paling sulit Anda sadari.",
        paragraphs: [
          "Kenali Gaya Anda mengajukan beberapa pertanyaan singkat dan menyebutkan tipe trader Anda. Ada delapan tipe. Waktunya sekitar tiga menit.",
          "Hasilnya adalah sekumpulan kebiasaan yang menyertai tipe itu, termasuk kebiasaan yang tidak bisa dilihat kebanyakan trader dalam diri mereka sendiri.",
          "Hasilnya milik Anda untuk disimpan. Setelah itu, dasbor Anda dan halaman tingkat akan membacanya, lalu mengarahkan Anda ke materi yang sesuai dengan cara Anda benar-benar trading.",
        ],
        ctaLabel: "Ikuti Kenali Gaya Anda",
      },
    },
    tv: {
      copy: {
        subject: "Username TradingView Anda",
        preheader: "Akses TradingView diberikan per username, dan hanya kolom itu yang belum Anda isi.",
        paragraphs: [
          "Sepuluh indikator Market Makers sudah siap di pihak kami. TradingView memberi akses per username, jadi hanya username Anda yang masih kurang.",
          "Tambahkan di halaman indikator. Akses diberikan otomatis, dan kesepuluh indikator akan muncul di chart Anda dalam satu sampai tiga jam.",
          "Satu kolom, sekitar sepuluh detik. Sebelum kolom itu terisi, tidak ada hal lain soal indikator yang bisa berjalan.",
        ],
        ctaLabel: "Tambahkan username Anda",
      },
    },
    lesson1: {
      copy: {
        subject: "Mulai dengan Golden Mindset",
        preheader: "Pelajaran 1, Modul 1. Delapan belas lagi bisa menunggu akhir pekan yang tak kunjung tiba.",
        paragraphs: [
          "Sembilan belas pelajaran adalah jenis angka yang membuat orang menunda. Jadi abaikan angkanya. Hari ini hanya ada satu pelajaran.",
          "Golden Mindset membuka Modul 1. Inilah disiplin yang menjadi landasan seluruh sistem, dan semua pelajaran setelahnya menganggap Anda sudah memilikinya. Satu video, dengan slide di sampingnya.",
          "Modul 1 tersedia di setiap akun di sini, deposit atau tidak. Buka pelajarannya. Anda boleh berhenti setelah itu.",
        ],
        ctaLabel: "Tonton Golden Mindset",
      },
    },
    ladder: {
      copy: {
        subject: "Setiap tingkat, dan apa yang dibukanya",
        preheader: "Analisis Harian tetap gratis selamanya. Jumlahnya adalah deposit ke akun Anda sendiri.",
        paragraphs: [
          "Sudah sembilan hari. Inilah peta cara kerja akses di sini. Tanpa promosi: cukup baca, tidak perlu melakukan apa pun.",
          "Angka-angka itu bukan harga dan tidak dibayarkan kepada Market Makers. Masing-masing adalah deposit ke akun trading di broker partner, yang dibuka atas nama Anda. Anda yang memegangnya, Anda yang trading dengannya, dan Anda bisa menariknya.",
          "Total deposit Anda menentukan tingkat Anda, dan dihitung dari titik tertingginya, jadi drawdown tidak akan pernah mencabut akses. Paket Gratis tetap memberi Analisis Harian, Kenali Gaya Anda, kalender, dan Modul 1 tanpa deposit sama sekali.",
        ],
        ctaLabel: "Lihat yang terbuka",
      },
    },
    day12: {
      copy: {
        subject: "Apa yang ditutup di hari ke-14",
        preheader: "Analisis Harian, Kenali Gaya Anda, dan Modul 1 tetap ada. Tanpa penghapusan, tanpa biaya.",
        paragraphs: [
          "Hari ke-14 mengakhiri masa uji coba. Yang ditutup: sepuluh indikator TradingView, skrip strategi, kelas live, Fundamental Desk, dan pelajaran setelah Modul 1.",
          "Yang tetap ada, tanpa deposit sama sekali: Analisis Harian setiap hari trading, Kenali Gaya Anda, Modul 1, kalender ekonomi, feed berita, dan channel sinyal publik. Login Anda tetap berfungsi.",
          "Setiap tingkat di atas Gratis adalah deposit ke akun trading Anda sendiri di broker, dibuka atas nama Anda, dan sepenuhnya milik Anda untuk dipakai trading dan ditarik. Halaman tingkat menunjukkan apa yang dibuka setiap tingkat.",
        ],
        ctaLabel: "Lihat yang terbuka",
      },
    },
    digest: {
      copy: {
        subject: "Emas hari ini: {bias}",
        preheader: "Rentang harga sepanjang malam, level yang dipantau MM Desk, dan pandangannya saat ini.",
        paragraphs: [],
        ctaLabel: "Baca analisis hari ini",
      },
      keeps:
        "Analisis Harian tetap terbuka di akun gratis Anda, bersama Kenali Gaya Anda, kalender ekonomi, berita live, dan Modul 1 kursus MM System. Tidak ada yang perlu dilakukan dan tidak ada yang perlu dibayar — semuanya tersedia setiap hari trading.",
      fallbackTitle: "Analisis XAU/USD hari ini",
      fallbackHeadline: "Analisis MM Desk tentang emas hari ini",
    },
    spotlight: {
      copy: {
        subject: "Panduan minggu ini dari MM Desk",
        preheader: "Satu analisis emas, dari awal sampai akhir. Terbuka di paket Gratis, tanpa deposit.",
        paragraphs: [
          "Panduan minggu ini belum terbit, jadi inilah yang selalu ada: analisis MM Desk tentang emas, diposting setiap pagi di hari trading.",
          "Posisi harga sepanjang malam, level yang dipantau MM Desk, dan bias yang menjadi pegangannya. Semuanya tersedia di akun Anda, deposit atau tidak.",
        ],
        ctaLabel: "Baca panduan minggu ini",
      },
      ladder:
        "Semua isi panduan ini ada di sisi gratis akun Anda. Tingkat di atas Gratis dimulai dari deposit $50 ke akun trading Anda sendiri, dan halaman tingkat menjelaskan apa yang dibuka masing-masing.",
      fallbackCta: "Buka analisis hari ini",
      guideInEnglish: "Panduan minggu ini ditulis dalam bahasa Inggris.",
    },
    upgradeSeen: {
      copy: {
        subject: "Deposit tetap atas nama Anda",
        preheader: "Bukan bayaran kepada kami. Ini modal trading di broker, Anda pegang dan bisa Anda tarik.",
        paragraphs: [
          "Anda membuka halaman tingkat dua hari lalu dan berhenti di sana. Ganjalannya biasanya sama, jadi inilah penjelasannya secara terus terang.",
          "Deposit itu tidak dibayarkan kepada Market Makers. Dana masuk ke akun trading yang dibuka atas nama Anda, dengan login Anda sendiri. Anda yang memegangnya, Anda yang trading dengannya, dan Anda bisa menariknya.",
          "Di pihak kami, deposit hanya menentukan tingkat Anda. Totalnya dihitung secara kumulatif dan bertahan di titik tertingginya, jadi drawdown tidak akan pernah mencabut akses yang sudah Anda miliki. Halaman itu akan terasa berbeda setelah Anda tahu hal ini.",
        ],
        ctaLabel: "Baca lagi halaman tingkat",
      },
    },
    brokerClicked: {
      copy: {
        subject: "Setengah jalan mengisi formulir broker",
        preheader: "Amelia mengurus ini setiap hari. Sebutkan di mana Anda berhenti, dia bantu dari sana.",
        paragraphs: [
          "Kemarin Anda membuka halaman akun broker dan berhenti di tengah jalan. Hal ini cukup sering terjadi, sampai-sampai kami menyiapkan satu orang khusus untuk membantu.",
          "Formulir itu meminta dokumen identitas dan bukti alamat. Unggahan bisa ditolak karena alasan sepele. Formulir juga meminta hal-hal yang saat itu tidak ada di tangan Anda.",
          "Kirim pesan ke Admin Amelia di Telegram dan sebutkan di mana Anda berhenti. Dia tidak bisa menghubungi Anda lebih dulu, jadi pesan pertama harus dari Anda. Jika Anda berubah pikiran, itu juga jawaban yang wajar. Sisi gratis akun Anda tetap seperti sekarang.",
        ],
        ctaLabel: "Pesan Admin Amelia",
      },
    },
    memberD3: {
      copy: {
        subject: "Hubungkan Asisten Trading AI",
        preheader: "Akses hanya-baca ke trade Anda yang sudah ditutup. Satu koneksi, sekitar tiga menit.",
        paragraphs: [
          "Asisten ini sudah termasuk di tingkat Anda. Selama belum ada akun yang terhubung, tidak ada yang bisa dibacanya, dan itulah sebabnya fitur ini biasanya tidak pernah terpakai.",
          "Hubungkan akun trading Anda dan asisten akan membaca trade Anda yang sudah ditutup, lalu menunjukkan kembali catatan trading Anda sendiri: berapa lama Anda menahan posisi, apa yang Anda lakukan dalam satu jam setelah trade rugi, dan setup mana yang terus Anda ambil.",
          "Koneksinya hanya-baca. Asisten bisa melihat riwayat akun, tetapi tidak bisa membuka, mengatur ukuran, atau menutup apa pun. Makin banyak trade yang dibacanya, makin berguna asisten ini, jadi memulai hari ini lebih baik daripada bulan depan.",
        ],
        ctaLabel: "Hubungkan asisten",
      },
      cardName: "Asisten Trading AI",
      cardLine: "Hanya-baca. Asisten menunjukkan kembali catatan trading Anda sendiri.",
    },
    memberD7: {
      copy: {
        subject: "Buka Fundamental Desk hari ini",
        preheader: "Yang sebenarnya menggerakkan emas minggu ini: dolar, real yield, satu agenda kalender",
        paragraphs: [
          "Sudah seminggu, dan Anda sudah menemukan indikator. Fundamental Desk adalah separuh lainnya yang lebih jarang dibuka, jadi inilah dia.",
          "Ini analisis yang mudah dipahami tentang apa yang sedang menggerakkan emas saat ini: dolar, real yield, apa yang diisyaratkan bank sentral, dan satu agenda di kalender minggu ini yang benar-benar penting.",
          "Buka sebelum sesi Anda berikutnya. Kelas live bersama MM Desk ada di sebelahnya di aplikasi, sudah termasuk di tingkat Anda.",
        ],
        ctaLabel: "Buka Fundamental Desk",
      },
      cardName: "Fundamental Desk",
      cardLine: "Gambaran makro di balik pergerakan harga, dalam bahasa Inggris yang sederhana.",
    },
    memberDormant: {
      copy: {
        subject: "Analisis emas hari ini",
        preheader: "Sebulan sepi tidak apa-apa. Satu analisis, tiga menit, tidak perlu mengejar ketinggalan.",
        paragraphs: [
          "Akun Anda sudah sepi sekitar sebulan. Tidak ada promosi di email ini. Pasar memang lebih mudah ditinggalkan daripada didatangi kembali.",
          "MM Desk terus menulis setiap pagi di hari trading: posisi emas sepanjang malam, level yang dipantaunya, bias yang menjadi pegangannya. Video singkat dan PDF, sebelum sesi dimulai.",
          "Mulailah dengan analisis hari ini, bukan tumpukan sebulan. Analisisnya sudah ada di akun Anda. Dan jika Market Makers sudah tidak cocok untuk Anda, berhenti berlangganan di bawah dan kami tidak akan mengganggu Anda lagi.",
        ],
        ctaLabel: "Buka analisis hari ini",
      },
      cardName: "Analisis Harian",
      cardLine: "Analisis MM Desk tentang emas, setiap pagi di hari trading.",
    },
  },

  deposit: {
    riskLine: "Trading melibatkan risiko, termasuk kemungkinan kehilangan modal. Tidak ada imbal hasil yang dijamin.",
    deposit: "deposit",
    topUp: "top up",
    verified: {
      subject: "Terverifikasi: Anda kini di {tier}",
      // {what} sits mid-sentence: it is the lowercase "deposit" / "top up".
      body: "Kami sudah memverifikasi {what} {amount} Anda. Anda kini di {tier}, dengan total deposit {cumulative} sejauh ini, dan MM Desk Anda sudah terbuka.",
      unlocked: "Semua yang ada di tingkat Anda sudah terbuka. Buka MM Desk: {url}",
      cta: "Buka MM Desk Anda",
    },
    reminder: {
      subject: "Satu langkah terakhir untuk deposit {amount} Anda",
      body: "Deposit {amount} Anda sedang ditinjau. Tinggal satu langkah: kirim pesan ke {admin} di Telegram.",
      why: "Admin kami tidak bisa mengirim pesan kepada Anda lebih dulu, jadi lewat pesan inilah kami menghubungi Anda jika ada yang perlu dicek soal deposit Anda.",
      textLink: "Kirim pesan ke {admin}: {url}",
      cta: "Kirim pesan ke {admin} di Telegram",
      ref: "Kode referensi Anda adalah {ref}. Kode ini sudah tercantum di pesan.",
    },
    rejected: {
      subject: "Tentang kiriman deposit Anda",
      body: "Kami belum bisa memverifikasi deposit {amount} Anda: {reason}",
      text: "Anda bisa mengirimkannya ulang dari {url}, atau kirim pesan kepada kami di WhatsApp atau Telegram dan kami akan membereskannya bersama Anda.",
      cta: "Kirim ulang",
      other: "Atau kirim pesan kepada kami di WhatsApp atau Telegram dan kami akan membereskannya bersama Anda.",
    },
  },

  fundamental: {
    subject: "Tesis fundamental {instrument} Anda",
    title: "MMFX Fundamental Dispatch",
    kicker: "Terminal Dispatch · Fundamental Desk",
    attached: "Tesis fundamental {instrument} Anda terlampir.",
    inside: "Isinya: bacaan makro terkini yang menggerakkan pair ini — positioning pasar, katalis yang sedang berperan, dan bias yang ditunjukkannya. Buka PDF terlampir untuk laporan lengkapnya.",
    compliance: "Hanya analisis fundamental — bukan sinyal, target, atau instruksi untuk membeli atau menjual.",
    footer: "Anda menerima email ini karena Anda meminta salinan dari Fundamental Desk di akun Market Makers FX Anda.",
  },

  journal: {
    doThis: "Lakukan ini:",
    cta: "Buka Asisten Trading AI Anda",
    footerNote: "Anda menerima email ini karena Anda mencatat trading Anda di Market Makers FX.",
  },
};
