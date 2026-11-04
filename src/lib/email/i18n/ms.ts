import type { EmailMessages } from "./types";

// The member emails in Malaysian Malay, "anda" lowercase as the app writes it.
// Terms follow the app's ms dictionary (src/i18n/messages/ms) so an email and
// the page it links to agree. "MM Desk", "Fundamental Desk" and the paid tier
// names stay in English as names, never translated; signed by Don.
export const ms: EmailMessages = {
  common: {
    hi: "Hai {name},",
    hiNoName: "Hai,",
    signoff: "— Don, Market Makers FX",
    bias: { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" },
    biasLine: "Kecenderungan: {bias}",
    deskWritesEnglish: "MM Desk menulis analisisnya dalam bahasa Inggeris.",
  },

  shell: {
    footerNote: "Anda menerima e-mel ini kerana anda mempunyai akaun Market Makers FX.",
    unsubscribe: "Berhenti melanggan",
    riskLine: "Dagangan melibatkan risiko, termasuk kemungkinan kehilangan modal. Tiada kandungan di sini yang merupakan nasihat kewangan.",
    contextDay: "HARI {day} / 14",
    contextMember: "AHLI",
    contextDesk: "MM DESK · XAU/USD",
  },

  tracker: {
    title: "14 HARI PERTAMA ANDA",
    textTitle: "14 hari pertama anda:",
    today: "HARI INI",
    day: "HARI {day}",
    textDay: "(hari {day})",
    done: "Selesai",
    notDone: "Belum selesai",
    steps: {
      analysis: "Baca Analisis Harian hari ini",
      kys: "Kenali Gaya Anda — 3 minit",
      tv: "Sambungkan TradingView",
      lesson1: "Pelajaran 1 — Minda Emas",
      desk: "Lihat apa yang dibuka setiap tahap",
    },
  },

  ladder: {
    rungs: {
      free: { name: "Percuma", amount: "tanpa deposit", line: "Analisis Harian, Kenali Gaya Anda, kalendar, berita, Modul 1" },
      foundation: { name: "Foundation", amount: "$50", line: "kursus penuh dan Perpustakaan MM" },
      desk: { name: "Desk", amount: "$200", line: "indikator, strategi, kelas langsung, Fundamental Desk" },
      team: { name: "Team MM", amount: "$500", line: "saluran Team MM dan Pembantu Dagangan AI" },
    },
    note: "Setiap angka ialah deposit ke akaun anda sendiri di broker rakan kongsi, atas nama anda, dan anda boleh mengeluarkannya.",
  },

  lifecycle: {
    welcome: {
      copy: {
        subject: "Mula dengan analisis emas hari ini",
        preheader: "Satu halaman tentang XAU/USD, dianalisis dari carta harian. Ia hanya perlukan tiga minit.",
        paragraphs: [
          "Mula di sini: buka Analisis Harian hari ini. Satu halaman tentang emas, dianalisis secara top-down bermula dari carta harian. Tiga minit, dan anda akan tahu cara MM Desk membaca harga pada sesi ini.",
          "Ia diterbitkan setiap hari dagangan. Ini MM Desk, bukan perpustakaan kursus: analisis ini ada untuk anda persoalkan, supaya anda membina pandangan sendiri dan bukan meminjam pandangan kami.",
          "Percubaan 14 hari anda kini aktif, dan akses ini tidak dikenakan sebarang bayaran. Kami ialah introducing broker, jadi broker yang membayar kami apabila anda berdagang. Sebarang deposit masuk ke akaun anda sendiri, atas nama anda, dan kekal milik anda. Selepas hari ke-14, Analisis Harian, Kenali Gaya Anda dan Modul 1 kursus kekal dibuka.",
        ],
        ctaLabel: "Buka analisis hari ini",
      },
      heroEyebrow: "Selamat datang ke MM Desk",
      heroHeadline: "BACA PASARAN.\nBARU BERTINDAK.",
      todayRead: "Analisis hari ini: {title} — kecenderungan {bias}.",
      todayReadNoBias: "Analisis hari ini: {title}.",
      noRead: "Analisis hari ini diterbitkan semasa sesi Asia. Itulah perkara pertama untuk disemak setiap pagi.",
    },
    analysis: {
      copy: {
        subject: "Analisis emas hari ini",
        preheader: "Ditulis sebelum sesi dibuka. Video ringkas, PDF, dan paras yang sedang dipantau.",
        paragraphs: [
          "Setiap pagi hari dagangan, MM Desk menulis analisisnya tentang emas sebelum sesi dibuka. Analisis hari ini disertakan dalam e-mel ini, bersama kecenderungan yang menjadi pegangannya.",
          "Video ringkas dan PDF. Kedudukan harga semalaman, dan paras yang sedang dipantau MM Desk.",
          "Anda tidak perlu bersetuju dengannya. Bandingkan dengan carta anda sendiri dan lihat di mana kedua-duanya berbeza.",
        ],
        ctaLabel: "Buka analisis hari ini",
      },
      todayUp: "Analisis hari ini sudah diterbitkan: {title}, kecenderungan {bias}.",
      noRead: "Analisis seterusnya akan diterbitkan sebelum sesi.",
    },
    kys: {
      copy: {
        subject: "Lapan jenis pedagang. Satu milik anda.",
        preheader: "Tiga minit menjawab soalan, kemudian tabiat yang paling sukar anda sedari.",
        paragraphs: [
          "Kenali Gaya Anda mengemukakan beberapa soalan ringkas dan menamakan jenis pedagang anda. Ada lapan semuanya. Ia mengambil masa kira-kira tiga minit.",
          "Hasilnya ialah set tabiat yang datang bersama jenis itu, termasuk tabiat yang kebanyakan pedagang tidak nampak pada diri sendiri.",
          "Ia milik anda untuk disimpan. Selepas itu, papan pemuka anda dan halaman tahap akan membacanya, dan mengarahkan anda kepada bahan yang sesuai dengan cara anda sebenarnya berdagang.",
        ],
        ctaLabel: "Ambil Kenali Gaya Anda",
      },
    },
    tv: {
      copy: {
        subject: "Nama pengguna TradingView anda",
        preheader: "Akses TradingView diberi mengikut nama pengguna; hanya ruangan itu yang belum anda isi.",
        paragraphs: [
          "Sepuluh indikator Market Makers sudah sedia di pihak kami. TradingView memberi akses mengikut nama pengguna, jadi hanya nama pengguna anda yang belum ada.",
          "Tambahkannya di halaman indikator. Akses diberikan secara automatik, dan kesemua sepuluh indikator akan muncul di carta anda dalam masa satu hingga tiga jam.",
          "Satu ruangan, kira-kira sepuluh saat. Selagi ia belum diisi, tiada apa-apa lagi berkenaan indikator boleh diteruskan.",
        ],
        ctaLabel: "Tambah nama pengguna anda",
      },
    },
    lesson1: {
      copy: {
        subject: "Mula dengan Minda Emas",
        preheader: "Pelajaran 1, Modul 1. Lapan belas lagi boleh tunggu hujung minggu yang tak pernah tiba.",
        paragraphs: [
          "Sembilan belas pelajaran ialah jenis angka yang membuatkan orang menangguh. Jadi abaikan angka itu. Hari ini hanya ada satu pelajaran.",
          "Minda Emas membuka Modul 1. Ia disiplin yang menjadi asas seluruh sistem, dan setiap pelajaran selepasnya menganggap anda sudah memilikinya. Satu video, bersama slaid di sebelahnya.",
          "Modul 1 tersedia pada setiap akaun di sini, sama ada anda deposit atau tidak. Buka pelajaran itu. Anda boleh berhenti selepasnya.",
        ],
        ctaLabel: "Tonton Minda Emas",
      },
    },
    ladder: {
      copy: {
        subject: "Setiap tahap, dan apa yang dibukanya",
        preheader: "Analisis Harian kekal percuma selamanya. Jumlahnya ialah deposit ke akaun anda sendiri.",
        paragraphs: [
          "Sudah sembilan hari. Inilah peta cara akses berfungsi di sini. Tiada promosi di sini: baca sahaja, dan tidak perlu buat apa-apa.",
          "Jumlah-jumlah ini bukan harga dan tidak dibayar kepada Market Makers. Setiap satu ialah deposit ke akaun dagangan di broker rakan kongsi, yang dibuka atas nama anda. Anda yang memegangnya, anda yang berdagang dengannya, dan anda boleh mengeluarkannya.",
          "Jumlah deposit anda menentukan tahap anda, dan ia dikira pada paras tertingginya, jadi drawdown tidak akan menarik balik akses. Pelan Percuma mengekalkan Analisis Harian, Kenali Gaya Anda, kalendar dan Modul 1 tanpa sebarang deposit.",
        ],
        ctaLabel: "Lihat apa yang dibuka",
      },
    },
    day12: {
      copy: {
        subject: "Apa yang ditutup pada hari ke-14",
        preheader: "Analisis Harian, Kenali Gaya Anda dan Modul 1 kekal. Tiada yang dipadam atau dicaj.",
        paragraphs: [
          "Hari ke-14 menamatkan tempoh percubaan. Yang ditutup: sepuluh indikator TradingView, skrip strategi, kelas langsung, Fundamental Desk, dan pelajaran selepas Modul 1.",
          "Yang kekal, tanpa sebarang deposit: Analisis Harian setiap hari dagangan, Kenali Gaya Anda, Modul 1, kalendar ekonomi, suapan berita dan saluran isyarat awam. Log masuk anda terus berfungsi.",
          "Setiap tahap di atas Percuma ialah deposit ke akaun dagangan anda sendiri di broker, dibuka atas nama anda, milik anda untuk didagangkan dan dikeluarkan. Halaman tahap menunjukkan apa yang dibuka oleh setiap tahap.",
        ],
        ctaLabel: "Lihat apa yang dibuka",
      },
    },
    digest: {
      copy: {
        subject: "Emas hari ini: {bias}",
        preheader: "Julat harga semalaman, paras yang dipantau MM Desk, dan pendiriannya sekarang.",
        paragraphs: [],
        ctaLabel: "Baca analisis hari ini",
      },
      keeps:
        "Analisis Harian kekal dibuka pada akaun percuma anda, bersama Kenali Gaya Anda, kalendar ekonomi, berita langsung dan Modul 1 kursus MM System. Tiada apa-apa yang perlu dibuat dan tiada apa-apa yang perlu dibayar — ia ada setiap hari dagangan.",
      fallbackTitle: "Analisis XAU/USD hari ini",
      fallbackHeadline: "Analisis MM Desk tentang emas hari ini",
    },
    spotlight: {
      copy: {
        subject: "Panduan minggu ini daripada MM Desk",
        preheader: "Satu analisis emas, dari awal hingga akhir. Dibuka pada pelan Percuma, tanpa deposit.",
        paragraphs: [
          "Panduan minggu ini belum diterbitkan, jadi inilah yang sentiasa ada: analisis MM Desk tentang emas, disiarkan setiap pagi hari dagangan.",
          "Kedudukan harga semalaman, paras yang dipantau MM Desk, dan kecenderungan yang menjadi pegangannya. Ia ada pada akaun anda sama ada anda deposit atau tidak.",
        ],
        ctaLabel: "Baca panduan minggu ini",
      },
      ladder:
        "Semua dalam panduan ini ada pada bahagian percuma akaun anda. Tahap di atas Percuma bermula dengan deposit $50 ke akaun dagangan anda sendiri, dan halaman tahap menerangkan apa yang dibuka oleh setiap satu.",
      fallbackCta: "Buka analisis hari ini",
      guideInEnglish: "Panduan minggu ini ditulis dalam bahasa Inggeris.",
    },
    upgradeSeen: {
      copy: {
        subject: "Deposit itu kekal atas nama anda",
        preheader: "Bukan bayaran kepada kami. Ia modal dagangan di broker, anda pegang dan boleh keluarkan.",
        paragraphs: [
          "Anda membuka halaman tahap dua hari lalu dan berhenti di situ. Perkara yang membuatkan orang teragak-agak biasanya sama, jadi inilah penjelasannya secara terus terang.",
          "Deposit itu tidak dibayar kepada Market Makers. Ia masuk ke akaun dagangan yang dibuka atas nama anda, dengan log masuk anda sendiri. Anda yang memegangnya, anda yang berdagang dengannya, dan anda boleh mengeluarkannya.",
          "Di pihak kami, ia hanya menentukan tahap anda. Jumlahnya dikira secara terkumpul dan kekal pada paras tertingginya, jadi drawdown tidak akan menarik balik akses yang sudah anda miliki. Halaman itu terasa lain apabila anda tahu perkara ini.",
        ],
        ctaLabel: "Baca semula halaman tahap",
      },
    },
    brokerClicked: {
      copy: {
        subject: "Separuh jalan mengisi borang broker",
        preheader: "Amelia uruskan ini setiap hari. Beritahu di mana anda berhenti, dia sambung dari situ.",
        paragraphs: [
          "Anda membuka halaman akaun broker semalam dan berhenti di separuh jalan. Ia cukup kerap berlaku sehingga kami menyediakan seorang petugas khas untuknya.",
          "Borang itu meminta dokumen pengenalan diri dan bukti alamat. Muat naik ditolak atas sebab-sebab kecil. Borang meminta perkara yang tiada di tangan anda ketika itu.",
          "Mesej Admin Amelia di Telegram dan beritahu di mana anda berhenti. Dia tidak boleh menulis kepada anda dahulu, jadi mesej pertama mesti daripada anda. Jika anda sudah berubah fikiran, itu juga jawapan yang baik. Bahagian percuma akaun anda kekal seperti sedia ada.",
        ],
        ctaLabel: "Mesej Admin Amelia",
      },
    },
    memberD3: {
      copy: {
        subject: "Sambungkan Pembantu Dagangan AI",
        preheader: "Akses baca sahaja ke dagangan yang ditutup. Satu sambungan, kira-kira tiga minit.",
        paragraphs: [
          "Pembantu ini sudah termasuk dalam tahap anda. Selagi tiada akaun dipautkan, ia tiada apa-apa untuk dibaca, sebab itulah ia biasanya ciri yang tidak pernah digunakan.",
          "Pautkan akaun dagangan anda dan ia akan membaca dagangan anda yang sudah ditutup, kemudian menunjukkan semula rekod anda sendiri: berapa lama anda memegang posisi, apa yang anda lakukan dalam sejam selepas dagangan rugi, dan persediaan mana yang terus anda ambil.",
          "Pautan itu baca sahaja. Ia boleh melihat sejarah akaun, tetapi tidak boleh membuka, menetapkan saiz atau menutup apa-apa. Semakin banyak dagangan yang dibacanya, semakin berguna ia, jadi bermula hari ini lebih baik daripada bulan depan.",
        ],
        ctaLabel: "Sambungkan pembantu",
      },
      cardName: "Pembantu Dagangan AI",
      cardLine: "Baca sahaja. Ia menunjukkan semula rekod dagangan anda sendiri.",
    },
    memberD7: {
      copy: {
        subject: "Buka Fundamental Desk hari ini",
        preheader: "Apa yang menggerakkan emas minggu ini: dolar, hasil sebenar, satu acara kalendar",
        paragraphs: [
          "Seminggu berlalu, dan anda sudah menemui indikator. Fundamental Desk ialah separuh lagi yang kurang kerap dibuka, jadi inilah ia.",
          "Ia analisis yang mudah difahami tentang apa yang sedang memacu emas sekarang: dolar, hasil sebenar, apa yang diisyaratkan oleh bank pusat, dan satu acara dalam kalendar minggu ini yang benar-benar penting.",
          "Bukanya sebelum sesi anda yang seterusnya. Kelas langsung bersama MM Desk ada di sebelahnya dalam aplikasi, sudah termasuk dalam tahap anda.",
        ],
        ctaLabel: "Buka Fundamental Desk",
      },
      cardName: "Fundamental Desk",
      cardLine: "Gambaran makro di sebalik pergerakan harga, dalam bahasa Inggeris yang mudah.",
    },
    memberDormant: {
      copy: {
        subject: "Analisis emas hari ini",
        preheader: "Sebulan senyap tidak mengapa. Satu analisis, tiga minit, tiada apa yang perlu dikejar.",
        paragraphs: [
          "Akaun anda senyap selama kira-kira sebulan. Tiada promosi dalam e-mel ini. Pasaran lebih mudah ditinggalkan berbanding untuk kembali kepadanya.",
          "MM Desk terus menulis setiap pagi hari dagangan: kedudukan emas semalaman, paras yang dipantaunya, kecenderungan yang menjadi pegangannya. Video ringkas dan PDF, sebelum sesi.",
          "Mulakan dengan analisis hari ini, bukan sebulan yang tertinggal. Ia sudah ada pada akaun anda. Dan jika Market Makers bukan lagi untuk anda, berhenti melanggan di bawah dan kami tidak akan mengganggu anda lagi.",
        ],
        ctaLabel: "Buka analisis hari ini",
      },
      cardName: "Analisis Harian",
      cardLine: "Analisis MM Desk tentang emas, setiap pagi hari dagangan.",
    },
  },

  deposit: {
    riskLine: "Dagangan melibatkan risiko, termasuk kemungkinan kehilangan modal. Tiada pulangan yang dijamin.",
    deposit: "deposit",
    topUp: "tambahan",
    verified: {
      subject: "Disahkan: anda kini pada {tier}",
      // {what} sits mid-sentence: it is the lowercase "deposit" / "tambahan".
      body: "Kami telah mengesahkan {what} {amount} anda. Anda kini pada {tier}, dengan jumlah deposit {cumulative} setakat ini, dan MM Desk anda sudah dibuka.",
      unlocked: "Semua dalam tahap anda kini dibuka. Buka MM Desk: {url}",
      cta: "Buka MM Desk anda",
    },
    reminder: {
      subject: "Satu langkah terakhir untuk deposit {amount} anda",
      body: "Deposit {amount} anda sedang disemak. Tinggal satu langkah: hantar mesej kepada {admin} di Telegram.",
      why: "Admin kami tidak boleh mesej anda dahulu, jadi inilah cara kami menghubungi anda jika ada perkara tentang deposit anda yang perlu disemak.",
      textLink: "Mesej {admin}: {url}",
      cta: "Mesej {admin} di Telegram",
      ref: "Nombor rujukan anda ialah {ref}. Ia sudah dimasukkan dalam mesej.",
    },
    rejected: {
      subject: "Tentang penghantaran deposit anda",
      body: "Kami belum dapat mengesahkan deposit {amount} anda: {reason}",
      text: "Anda boleh menghantarnya semula di {url}, atau mesej kami di WhatsApp atau Telegram dan kami akan menyelesaikannya bersama anda.",
      cta: "Hantar semula",
      other: "Atau mesej kami di WhatsApp atau Telegram dan kami akan menyelesaikannya bersama anda.",
    },
  },

  fundamental: {
    subject: "Tesis fundamental {instrument} anda",
    title: "MMFX Fundamental Dispatch",
    kicker: "Terminal Dispatch · Fundamental Desk",
    attached: "Tesis fundamental {instrument} anda dilampirkan.",
    inside: "Kandungannya: bacaan makro semasa yang menggerakkan pasangan ini — kedudukan pasaran, pemangkin yang sedang aktif, dan kecenderungan yang ditunjukkan oleh semua itu. Buka PDF yang dilampirkan untuk laporan penuh.",
    compliance: "Analisis fundamental sahaja — bukan isyarat, sasaran, atau arahan untuk membeli atau menjual.",
    footer: "Anda menerima e-mel ini kerana anda meminta salinan daripada Fundamental Desk dalam akaun Market Makers FX anda.",
  },

  journal: {
    doThis: "Lakukan ini:",
    cta: "Buka Pembantu Dagangan AI anda",
    footerNote: "Anda menerima e-mel ini kerana anda menjejaki dagangan anda bersama Market Makers FX.",
  },
};
