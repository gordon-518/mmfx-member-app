import type { GlossaryContent } from "../types";

// Bahasa Melayu explainers, translated from content/en.ts. Plain Malaysian
// Malay for readers with no economics background. Acronyms stay in Latin
// letters with a Malay gloss; market words Malaysian traders use as-is
// (risk-on, breakout, carry trade, funding rate) stay in English with a short
// explanation. "Biasanya" and "cenderung" on purpose — tendencies, not rules.
// "Yield" is "kadar hasil" (bond yield) / "hasil sebenar" (real yield).

export const glossaryMs: GlossaryContent = {
  dxy: {
    name: "DXY (indeks dolar AS)",
    what: "Satu angka yang menunjukkan kekuatan dolar AS berbanding sekumpulan mata wang utama lain. Naik bermakna dolar semakin kukuh; turun bermakna semakin lemah.",
    moves: {
      metal: "{asset} disebut harga dalam dolar, jadi dolar yang lebih kukuh biasanya menekan harganya dan dolar yang lebih lemah biasanya membantunya.",
      fxUsdQuote: "Dolar ialah mata wang kedua dalam {asset}, jadi dolar yang lebih kukuh biasanya menolak {asset} turun dan dolar yang lebih lemah menolaknya naik.",
      fxUsdBase: "Dolar ialah mata wang pertama dalam {asset}, jadi dolar yang lebih kukuh biasanya menolak {asset} naik dan dolar yang lebih lemah menolaknya turun.",
      crypto: "{asset} disebut harga dalam dolar, jadi dolar yang lebih lemah sering membantunya, walaupun kripto lebih mengikut mood umum pasaran berbanding dolar.",
    },
  },
  realYield: {
    name: "Hasil sebenar (real yield)",
    what: "Faedah yang dibayar oleh bon kerajaan AS selepas ditolak inflasi. Ia ganjaran 'sebenar' untuk menyimpan wang dalam dolar secara selamat.",
    moves: {
      metal: "{asset} tidak membayar faedah, jadi apabila hasil sebenar naik, memegangnya bermakna terlepas lebih banyak faedah dan ia biasanya tertekan. Hasil sebenar yang turun biasanya membantunya.",
      fxUsdQuote: "Hasil sebenar yang lebih tinggi menjadikan simpanan dalam dolar lebih menarik, yang cenderung mengukuhkan dolar dan menolak {asset} turun.",
      fxUsdBase: "Hasil sebenar yang lebih tinggi menjadikan simpanan dalam dolar lebih menarik, yang cenderung mengukuhkan dolar dan menolak {asset} naik.",
      crypto: "Hasil sebenar yang lebih tinggi menjadikan simpanan selamat lebih menarik berbanding aset berisiko, yang cenderung menekan {asset}.",
    },
  },
  treasuryYield: {
    name: "Kadar hasil bon AS (Treasury 2y, 10y, 30y)",
    what: "Kadar faedah yang dibayar kerajaan AS untuk meminjam selama 2, 10 atau 30 tahun. Pasaran melihatnya sebagai kadar semasa bagi simpanan dalam dolar.",
    moves: {
      metal: "Kadar hasil yang naik menjadikan simpanan berfaedah lebih menarik berbanding {asset}, yang tidak membayar apa-apa, jadi ia biasanya tertekan.",
      fxUsdQuote: "Kadar hasil AS yang naik cenderung menarik wang ke dalam dolar, lalu menolak {asset} turun.",
      fxUsdBase: "Kadar hasil AS yang naik cenderung menarik wang ke dalam dolar, lalu menolak {asset} naik.",
      crypto: "Kadar hasil yang naik cenderung menarik wang keluar daripada aset berisiko seperti {asset}.",
    },
  },
  fed: {
    name: "Fed (Rizab Persekutuan AS)",
    what: "Bank pusat Amerika. Ia menetapkan kadar faedah AS, dan keputusan serta ucapannya menggerakkan dolar lebih daripada hampir apa-apa lagi.",
    moves: {
      metal: "Apabila Fed condong ke arah menurunkan kadar, dolar dan kadar hasil biasanya melemah, yang cenderung membantu {asset}. Isyarat kadar lebih tinggi biasanya menekannya.",
      fxUsdQuote: "Apabila Fed condong ke arah kadar lebih tinggi, dolar biasanya mengukuh dan {asset} jatuh; apabila ia condong ke arah penurunan kadar, {asset} cenderung naik.",
      fxUsdBase: "Apabila Fed condong ke arah kadar lebih tinggi, dolar biasanya mengukuh dan {asset} naik; apabila ia condong ke arah penurunan kadar, {asset} cenderung jatuh.",
      crypto: "Dasar Fed yang lebih longgar (kadar lebih rendah) cenderung membantu {asset}; dasar yang lebih ketat cenderung menekannya.",
    },
  },
  rateCut: {
    name: "Penurunan kadar (rate cut)",
    what: "Apabila bank pusat menurunkan kadar faedahnya. Meminjam menjadi lebih murah dan simpanan dalam mata wang itu memberi faedah lebih rendah.",
    moves: {
      metal: "Penurunan kadar AS biasanya bermakna dolar lebih lemah dan kadar hasil lebih rendah, yang cenderung membantu {asset}.",
      fxUsdQuote: "Penurunan kadar AS biasanya melemahkan dolar, yang cenderung mengangkat {asset}. Penurunan oleh bank pusat satu lagi dalam pasangan itu memberi kesan sebaliknya.",
      fxUsdBase: "Penurunan kadar AS biasanya melemahkan dolar, yang cenderung menolak {asset} turun. Penurunan oleh bank pusat satu lagi dalam pasangan itu memberi kesan sebaliknya.",
      crypto: "Penurunan kadar menjadikan pinjaman lebih murah dan cenderung membuat pelabur lebih berminat pada aset berisiko seperti {asset}.",
    },
  },
  rateHike: {
    name: "Kenaikan kadar (rate hike)",
    what: "Apabila bank pusat menaikkan kadar faedahnya, biasanya untuk menyejukkan inflasi. Meminjam menjadi lebih mahal dan simpanan dalam mata wang itu memberi faedah lebih tinggi.",
    moves: {
      metal: "Kenaikan kadar AS biasanya mengukuhkan dolar dan menaikkan kadar hasil, yang cenderung menekan {asset}.",
      fxUsdQuote: "Kenaikan kadar AS biasanya mengukuhkan dolar, yang cenderung menolak {asset} turun. Kenaikan oleh bank pusat satu lagi dalam pasangan itu memberi kesan sebaliknya.",
      fxUsdBase: "Kenaikan kadar AS biasanya mengukuhkan dolar, yang cenderung menolak {asset} naik. Kenaikan oleh bank pusat satu lagi dalam pasangan itu memberi kesan sebaliknya.",
      crypto: "Kenaikan kadar mengetatkan aliran wang dan cenderung menyejukkan permintaan untuk aset berisiko seperti {asset}.",
    },
  },
  hawkish: {
    name: "Hawkish (condong menaikkan kadar)",
    what: "Bank pusat (atau pegawainya) yang condong ke arah kadar faedah lebih tinggi untuk melawan inflasi. Lawannya ialah dovish.",
    moves: "Nada hawkish biasanya mengukuhkan mata wang bank itu. Kesannya pada {asset} bergantung pada kedudukan mata wang itu dalam pasangan.",
  },
  dovish: {
    name: "Dovish (condong menurunkan kadar)",
    what: "Bank pusat yang condong ke arah kadar faedah lebih rendah untuk menyokong pertumbuhan ekonomi dan pekerjaan. Lawannya ialah hawkish.",
    moves: "Nada dovish biasanya melemahkan mata wang bank itu. Kesannya pada {asset} bergantung pada kedudukan mata wang itu dalam pasangan.",
  },
  policyGap: {
    name: "Jurang kadar faedah (policy divergence)",
    what: "Perbezaan antara kadar faedah dua negara. Wang cenderung mengalir ke mata wang yang membayar faedah lebih tinggi.",
    moves: "Apabila jurang itu melebar memihak kepada satu mata wang dalam {asset}, mata wang itu cenderung mengukuh berbanding yang satu lagi.",
  },
  carryTrade: {
    name: "Carry trade (pinjam faedah rendah, pegang faedah tinggi)",
    what: "Meminjam dalam mata wang berkadar faedah rendah untuk memegang mata wang berkadar faedah lebih tinggi, sambil mengutip beza faedahnya. Popular dalam kalangan dana besar ketika pasaran tenang.",
    moves: "Carry trade cenderung mengekalkan mata wang berkadar rendah (seperti yen atau franc) lemah ketika pasaran tenang, dan boleh ditutup beramai-ramai secara mendadak apabila ketakutan meningkat — mata wang berkadar rendah itu lalu melonjak.",
  },
  basisPoints: {
    name: "Mata asas (basis points, bp)",
    what: "Cara mengukur pergerakan kecil dalam kadar faedah. 100 mata asas = 1%, jadi penurunan 25bp merendahkan kadar sebanyak suku peratus.",
    moves: "Semakin besar pergerakan dalam mata asas, semakin besar perubahan kadar faedah yang perlu ditindak balas oleh pasaran.",
  },

  ecb: {
    name: "ECB (Bank Pusat Eropah)",
    what: "Bank pusat bagi euro. Ia menetapkan kadar faedah untuk 20 negara yang menggunakannya.",
    moves: "ECB yang lebih hawkish cenderung mengangkat euro; yang lebih dovish cenderung menekannya.",
  },
  boe: {
    name: "BoE (bank pusat UK)",
    what: "Bank pusat United Kingdom. Ia menetapkan kadar faedah bagi pound.",
    moves: "BoE yang lebih hawkish cenderung mengangkat pound; yang lebih dovish cenderung menekannya.",
  },
  boj: {
    name: "BoJ (bank pusat Jepun)",
    what: "Bank pusat Jepun. Ia mengekalkan kadar sangat rendah selama bertahun-tahun, jadi sebarang bayangan untuk menaikkannya menarik banyak perhatian.",
    moves: "Tanda BoJ akan menaikkan kadar cenderung mengukuhkan yen; tanda ia tidak akan berganjak cenderung mengekalkan yen lemah.",
  },
  snb: {
    name: "SNB (bank pusat Switzerland)",
    what: "Bank pusat Switzerland. Ia menetapkan kadar bagi franc dan kadangkala campur tangan dalam pasaran untuk menghalang franc menjadi terlalu kukuh.",
    moves: "SNB yang lebih hawkish cenderung mengangkat franc; SNB yang dovish, atau isyarat campur tangan untuk melemahkannya, cenderung menekannya.",
  },
  rba: {
    name: "RBA (bank pusat Australia)",
    what: "Bank pusat Australia. Ia menetapkan kadar faedah bagi dolar Australia.",
    moves: "RBA yang lebih hawkish cenderung mengangkat dolar Australia; yang lebih dovish cenderung menekannya.",
  },
  rbnz: {
    name: "RBNZ (bank pusat New Zealand)",
    what: "Bank pusat New Zealand. Ia menetapkan kadar faedah bagi dolar New Zealand.",
    moves: "RBNZ yang lebih hawkish cenderung mengangkat dolar New Zealand; yang lebih dovish cenderung menekannya.",
  },
  boc: {
    name: "BoC (bank pusat Kanada)",
    what: "Bank pusat Kanada. Ia menetapkan kadar faedah bagi dolar Kanada.",
    moves: "BoC yang lebih hawkish cenderung mengangkat dolar Kanada; yang lebih dovish cenderung menekannya.",
  },

  inflation: {
    name: "Inflasi",
    what: "Kelajuan harga barang naik dalam ekonomi. Bank pusat menaikkan kadar apabila inflasi terlalu panas dan menurunkannya apabila ia reda.",
    moves: "Inflasi yang lebih tinggi daripada jangkaan biasanya bermakna kadar tinggi lebih lama, yang cenderung mengukuhkan mata wang negara itu. Emas juga dilihat sebagai pelindung jangka panjang daripada kenaikan harga.",
  },
  cpi: {
    name: "CPI / PCE (laporan inflasi)",
    what: "Laporan bulanan tentang berapa banyak harga naik. CPI ialah ukuran utama; PCE ialah ukuran pilihan Fed. 'Core' (teras) mengecualikan makanan dan tenaga, yang harganya kerap turun naik.",
    moves: "Bacaan yang tinggi biasanya mengangkat mata wang kerana pasaran menjangka kadar lebih tinggi; bacaan yang rendah biasanya melemahkannya. Laporan ini sering mencetuskan pergerakan mendadak.",
  },
  jobsReport: {
    name: "Laporan pekerjaan (NFP, ADP, tuntutan pengangguran)",
    what: "Data tentang berapa banyak pekerjaan baharu dalam ekonomi AS. NFP (non-farm payrolls) ialah laporan bulanan yang besar; ADP dan tuntutan pengangguran mingguan memberi petunjuk lebih awal.",
    moves: {
      metal: "Data pekerjaan yang kukuh biasanya mengangkat dolar dan kadar hasil, yang cenderung menekan {asset}. Data yang lemah cenderung membantunya.",
      fxUsdQuote: "Data pekerjaan yang kukuh biasanya mengangkat dolar, yang cenderung menolak {asset} turun. Data yang lemah cenderung mengangkatnya.",
      fxUsdBase: "Data pekerjaan yang kukuh biasanya mengangkat dolar, yang cenderung menolak {asset} naik. Data yang lemah cenderung menolaknya turun.",
      crypto: "Data pekerjaan yang lemah boleh menimbulkan harapan penurunan kadar, yang cenderung membantu {asset}, kecuali jika ia mencetuskan kebimbangan lebih luas tentang ekonomi.",
    },
  },
  pmi: {
    name: "PMI / ISM (tinjauan perniagaan)",
    what: "Tinjauan bulanan yang bertanya kepada syarikat sama ada aktiviti perniagaan berkembang atau menguncup. Melebihi 50 bermakna berkembang; di bawah 50 bermakna menguncup.",
    moves: "Tinjauan yang kukuh cenderung menyokong mata wang negara itu; yang lemah cenderung menekannya.",
  },

  vix: {
    name: "VIX ('pengukur ketakutan')",
    what: "Ukuran betapa gementarnya pasaran saham AS, berdasarkan harga yang dibayar pelabur untuk melindungi diri. Bawah kira-kira 15 bermakna tenang; atas 25 bermakna takut.",
    moves: "VIX yang naik biasanya bermakna wang beralih ke tempat selamat: emas, yen, franc dan dolar cenderung mengukuh, manakala mata wang yang sensitif risiko dan kripto cenderung jatuh.",
  },
  riskOff: {
    name: "Risk-off (pasaran berhati-hati)",
    what: "Mood pasaran apabila pelabur menjadi gementar dan memindahkan wang daripada aset berisiko ke aset yang lebih selamat.",
    moves: "Ketika mood risk-off, aset selamat seperti emas, yen, franc dan selalunya dolar cenderung naik; dolar Australia, dolar New Zealand dan kripto cenderung jatuh.",
  },
  riskOn: {
    name: "Risk-on (pasaran yakin)",
    what: "Mood pasaran apabila pelabur berasa yakin dan sanggup memegang aset berisiko seperti saham dan kripto.",
    moves: "Ketika mood risk-on, saham, kripto serta dolar Australia dan New Zealand cenderung naik; aset selamat seperti yen dan franc cenderung ketinggalan.",
  },
  safeHaven: {
    name: "Aset selamat (safe haven)",
    what: "Aset yang diburu orang ketika takut — secara tradisinya emas, yen Jepun, franc Swiss dan bon kerajaan AS.",
    moves: "Aset selamat cenderung naik apabila ketakutan meningkat, walaupun faktor lain menunjuk ke arah sebaliknya.",
  },
  equities: {
    name: "Pasaran saham (S&P 500, Nasdaq)",
    what: "Indeks saham utama AS. Fundamental Desk memantaunya sebagai bacaan tentang tahap keyakinan pelabur.",
    moves: "Saham yang naik biasanya menandakan mood yakin (risk-on); saham yang jatuh menandakan mood gementar (risk-off).",
  },
  oil: {
    name: "Minyak (Brent, WTI)",
    what: "Dua harga penanda aras bagi minyak mentah. Minyak mempengaruhi inflasi dan sangat penting bagi negara pengeksport minyak seperti Kanada.",
    moves: "Minyak yang naik cenderung menyokong dolar Kanada dan boleh menaikkan inflasi, yang mempengaruhi cara bank pusat menilai kadar faedah.",
  },
  geopolitics: {
    name: "Risiko geopolitik",
    what: "Perang, konflik, sekatan dan ketegangan antara negara yang boleh menggugat pasaran.",
    moves: "Ketegangan yang meningkat biasanya mendorong wang ke aset selamat seperti emas, yen dan franc.",
  },
  election: {
    name: "Pilihan raya (termasuk midterms AS)",
    what: "Undian yang boleh mengubah rancangan perbelanjaan, cukai dan perdagangan kerajaan. Pilihan raya pertengahan penggal (midterms) AS menentukan siapa menguasai Kongres di separuh penggal presiden.",
    moves: "Pasaran bergerak berdasarkan maksud keputusan pilihan raya terhadap perbelanjaan, hutang dan kadar faedah akan datang — kejutan lebih penting daripada keputusan itu sendiri.",
  },

  etfFlows: {
    name: "Aliran ETF",
    what: "Wang yang masuk ke atau keluar dari dana dagangan bursa (ETF) yang memegang aset itu bagi pihak pelabur. Ia bacaan tentang besarnya permintaan sebenar.",
    moves: "Aliran wang yang berterusan masuk ke dana {asset} cenderung menyokong harganya; aliran keluar cenderung menekannya.",
  },
  structuralBid: {
    name: "Structural bid (belian berterusan jangka panjang)",
    what: "Belian yang stabil dan jangka panjang yang tidak bergantung pada berita harian — contohnya, bank pusat yang menambah rizab mereka tahun demi tahun.",
    moves: "Structural bid cenderung menjadi penampan apabila {asset} jatuh, walaupun faktor jangka pendek menunjuk ke arah sebaliknya.",
  },
  positioning: {
    name: "Positioning (COT)",
    what: "Sejauh mana pedagang besar sudah memegang posisi ke satu arah. Laporan COT menunjukkannya setiap minggu bagi pasaran niaga hadapan.",
    moves: "Apabila satu dagangan menjadi terlalu sesak, tinggal sedikit pembeli atau penjual baharu, dan sebarang kejutan boleh menyebabkan pergerakan mendadak ke arah sebaliknya.",
  },

  goldSilverRatio: {
    name: "Nisbah emas/perak",
    what: "Berapa auns perak diperlukan untuk membeli satu auns emas. Ia menunjukkan sama ada perak murah atau mahal berbanding emas.",
    moves: "Nisbah yang turun bermakna perak bergerak lebih kencang daripada emas; nisbah yang naik bermakna emas bergerak lebih kencang daripada perak.",
  },
  copper: {
    name: "Tembaga",
    what: "Logam industri yang digunakan dalam pembinaan dan elektronik, sering dipantau sebagai tanda kekuatan ekonomi global.",
    moves: "Perak sebahagiannya logam industri, jadi tembaga yang kukuh sering seiring dengan permintaan perak yang lebih kuat.",
  },
  wgc: {
    name: "WGC (Majlis Emas Dunia)",
    what: "Badan penyelidikan pasaran bagi industri emas. Ia menerbitkan data tentang siapa yang membeli emas — bank pusat, dana dan pembeli barang kemas.",
    moves: "Laporannya menunjukkan sama ada permintaan terhadap {asset} sedang meningkat atau semakin pudar.",
  },
  centralBankBuying: {
    name: "Belian emas oleh bank pusat",
    what: "Bank pusat di seluruh dunia menambah emas ke dalam rizab mereka, selalunya untuk kurang bergantung pada dolar AS.",
    moves: "Belian berterusan oleh bank pusat telah menjadi salah satu sokongan jangka panjang terbesar bagi {asset}.",
  },

  btcDominance: {
    name: "Dominasi Bitcoin",
    what: "Bahagian Bitcoin daripada jumlah nilai semua mata wang kripto.",
    moves: "Dominasi yang naik bermakna wang lebih memihak kepada bitcoin berbanding syiling lain; dominasi yang turun bermakna wang mula tersebar ke syiling seperti ether.",
  },
  fundingRate: {
    name: "Funding rate (kadar pembiayaan)",
    what: "Yuran kecil yang dibayar antara pedagang untuk mengekalkan posisi kripto berleveraj. Positif bermakna lebih ramai pedagang menjangka harga naik.",
    moves: "Funding rate yang sangat tinggi bermakna pasaran sesak di satu pihak, dan ini boleh membawa kepada pergerakan mendadak ke arah sebaliknya apabila posisi itu terpaksa ditutup.",
  },

  ema: {
    name: "EMA (purata bergerak)",
    what: "Garisan pada carta yang menunjukkan purata harga bagi beberapa lilin terkini, dengan lebih berat pada lilin terbaru. Fundamental Desk menggunakan 50 EMA untuk menilai trend.",
    moves: "Harga di atas garisan menunjukkan trend terkini menaik; di bawahnya menunjukkan trend menurun. 'Reclaim' bermakna harga telah naik semula ke atas garisan itu.",
  },
  timeframe: {
    name: "Jangka masa carta (H1, H4, D1)",
    what: "Tempoh masa yang diliputi setiap lilin pada carta: H1 = 1 jam, H4 = 4 jam, D1 = 1 hari, W1 = 1 minggu.",
    moves: "Jangka masa yang lebih panjang menunjukkan trend yang lebih besar; yang lebih pendek menunjukkan pergerakan di dalamnya.",
  },
  supportResistance: {
    name: "Sokongan dan rintangan (support/resistance)",
    what: "Kawasan harga di mana belian (sokongan, di bawah) atau jualan (rintangan, di atas) pernah masuk sebelum ini.",
    moves: "Harga sering berhenti seketika atau berpatah balik di kawasan ini. Pergerakan yang jelas menembusinya boleh mengubah gambaran.",
  },
  breakout: {
    name: "Breakout / breakdown (penembusan paras)",
    what: "Apabila harga bergerak dengan tegas menembusi paras yang sebelum ini menahannya di bawah (breakout) atau di atas (breakdown).",
    moves: "Breakout yang bertahan sering membawa kepada pergerakan lanjut ke arah itu; yang cepat berpatah balik dipanggil false break (penembusan palsu).",
  },
  invalidation: {
    name: "Pembatalan (invalidation)",
    what: "Titik di mana pandangan Fundamental Desk terbukti salah — paras harga atau peristiwa yang akan membuatnya menggugurkan atau memikirkan semula tesis.",
    moves: "Jika harga melepasi paras pembatalan, pandangan semasa Fundamental Desk tentang {asset} tidak lagi terpakai.",
  },
  conviction: {
    name: "Keyakinan (conviction)",
    what: "Sejauh mana Fundamental Desk yakin dengan pandangannya, berdasarkan berapa banyak pemacu utama yang sehaluan.",
    moves: "Keyakinan tinggi bermakna pemacu-pemacu itu sehaluan; keyakinan rendah bermakna ia bercampur-campur dan gambaran boleh berubah dengan cepat.",
  },
  regime: {
    name: "Rejim (regime)",
    what: "Latar belakang besar yang memacu pasaran sekarang — contohnya, 'kadar faedah sedang turun' atau 'pelabur sedang gementar'. Ia boleh berlarutan berminggu-minggu atau berbulan-bulan.",
    moves: "Rejim menentukan berita mana yang paling penting bagi {asset}; apabila ia berubah, reaksi biasa boleh berbalik.",
  },
  tactical: {
    name: "Taktikal",
    what: "Pandangan jangka pendek, untuk beberapa jam atau hari akan datang, bukan gambaran besar.",
    moves: "Pandangan taktikal boleh menunjuk ke satu arah sementara gambaran jangka panjang menunjuk ke arah lain.",
  },
};
