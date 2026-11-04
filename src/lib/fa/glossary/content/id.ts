import type { GlossaryContent } from "../types";

// Bahasa Indonesia explainers, translated from content/en.ts for readers with
// no economics background. Acronyms stay in Latin letters with a gloss, and
// market words Indonesian traders use as-is (risk-on, breakout, carry trade)
// keep their English form. "Biasanya" and "cenderung" on purpose — these are
// tendencies, not rules, and never a reason to trade on their own.
// "Imbal hasil" is the standard Indonesian word for a bond yield.

export const glossaryId: GlossaryContent = {
  dxy: {
    name: "DXY (indeks dolar AS)",
    what: "Satu angka yang menunjukkan seberapa kuat dolar AS terhadap sekeranjang mata uang utama lainnya. Naik berarti dolar menguat; turun berarti melemah.",
    moves: {
      metal: "{asset} dihargai dalam dolar, jadi dolar yang menguat biasanya menekannya, sedangkan dolar yang melemah biasanya menopangnya.",
      fxUsdQuote: "Dolar adalah mata uang kedua dalam {asset}, jadi dolar yang menguat biasanya mendorong {asset} turun, dan dolar yang melemah mendorongnya naik.",
      fxUsdBase: "Dolar adalah mata uang pertama dalam {asset}, jadi dolar yang menguat biasanya mendorong {asset} naik, dan dolar yang melemah mendorongnya turun.",
      crypto: "{asset} dihargai dalam dolar, jadi dolar yang melemah sering menopangnya — meski kripto lebih banyak mengikuti suasana pasar secara umum daripada dolar.",
    },
  },
  realYield: {
    name: "Imbal hasil riil (real yield)",
    what: "Bunga yang dibayar obligasi pemerintah AS setelah dikurangi inflasi. Inilah imbalan 'sebenarnya' dari menyimpan dana dalam dolar yang aman.",
    moves: {
      metal: "{asset} tidak memberi bunga, jadi saat imbal hasil riil naik, memegangnya berarti melewatkan bunga yang lebih besar dan harganya biasanya tertekan. Imbal hasil riil yang turun biasanya menopangnya.",
      fxUsdQuote: "Imbal hasil riil yang lebih tinggi membuat simpanan dalam dolar lebih menarik, yang cenderung menguatkan dolar dan mendorong {asset} turun.",
      fxUsdBase: "Imbal hasil riil yang lebih tinggi membuat simpanan dalam dolar lebih menarik, yang cenderung menguatkan dolar dan mendorong {asset} naik.",
      crypto: "Imbal hasil riil yang lebih tinggi membuat simpanan yang aman lebih menarik daripada aset berisiko, yang cenderung menekan {asset}.",
    },
  },
  treasuryYield: {
    name: "Imbal hasil obligasi AS (Treasury 2y, 10y, 30y)",
    what: "Suku bunga yang dibayar pemerintah AS untuk meminjam selama 2, 10, atau 30 tahun. Pasar memantaunya sebagai patokan bunga simpanan dalam dolar.",
    moves: {
      metal: "Imbal hasil yang naik membuat simpanan berbunga lebih menarik daripada {asset}, yang tidak memberi bunga, jadi biasanya menekannya.",
      fxUsdQuote: "Imbal hasil AS yang naik cenderung menarik dana ke dolar, yang mendorong {asset} turun.",
      fxUsdBase: "Imbal hasil AS yang naik cenderung menarik dana ke dolar, yang mendorong {asset} naik.",
      crypto: "Imbal hasil yang naik cenderung menarik dana keluar dari aset berisiko seperti {asset}.",
    },
  },
  fed: {
    name: "The Fed (bank sentral AS)",
    what: "Bank sentral Amerika Serikat. The Fed menetapkan suku bunga AS, dan keputusan serta pidatonya menggerakkan dolar lebih dari hampir apa pun.",
    moves: {
      metal: "Saat The Fed condong ke penurunan suku bunga, dolar dan imbal hasil biasanya melunak, yang cenderung menopang {asset}. Sinyal suku bunga lebih tinggi biasanya menekannya.",
      fxUsdQuote: "Saat The Fed condong ke suku bunga lebih tinggi, dolar biasanya menguat dan {asset} turun; saat condong ke penurunan, {asset} cenderung naik.",
      fxUsdBase: "Saat The Fed condong ke suku bunga lebih tinggi, dolar biasanya menguat dan {asset} naik; saat condong ke penurunan, {asset} cenderung turun.",
      crypto: "Kebijakan The Fed yang lebih longgar (suku bunga lebih rendah) cenderung menopang {asset}; kebijakan yang lebih ketat cenderung menekannya.",
    },
  },
  rateCut: {
    name: "Penurunan suku bunga (rate cut)",
    what: "Saat bank sentral menurunkan suku bunganya. Meminjam jadi lebih murah, dan simpanan dalam mata uang itu memberi bunga lebih kecil.",
    moves: {
      metal: "Penurunan suku bunga AS biasanya berarti dolar lebih lemah dan imbal hasil lebih rendah, yang cenderung menopang {asset}.",
      fxUsdQuote: "Penurunan suku bunga AS biasanya melemahkan dolar, yang cenderung mengangkat {asset}. Penurunan oleh bank sentral mata uang satunya dalam pasangan ini berdampak sebaliknya.",
      fxUsdBase: "Penurunan suku bunga AS biasanya melemahkan dolar, yang cenderung mendorong {asset} turun. Penurunan oleh bank sentral mata uang satunya dalam pasangan ini berdampak sebaliknya.",
      crypto: "Penurunan suku bunga membuat meminjam lebih murah dan cenderung membuat investor lebih berani masuk ke aset berisiko seperti {asset}.",
    },
  },
  rateHike: {
    name: "Kenaikan suku bunga (rate hike)",
    what: "Saat bank sentral menaikkan suku bunganya, biasanya untuk meredam inflasi. Meminjam jadi lebih mahal, dan simpanan dalam mata uang itu memberi bunga lebih besar.",
    moves: {
      metal: "Kenaikan suku bunga AS biasanya menguatkan dolar dan menaikkan imbal hasil, yang cenderung menekan {asset}.",
      fxUsdQuote: "Kenaikan suku bunga AS biasanya menguatkan dolar, yang cenderung mendorong {asset} turun. Kenaikan oleh bank sentral mata uang satunya dalam pasangan ini berdampak sebaliknya.",
      fxUsdBase: "Kenaikan suku bunga AS biasanya menguatkan dolar, yang cenderung mendorong {asset} naik. Kenaikan oleh bank sentral mata uang satunya dalam pasangan ini berdampak sebaliknya.",
      crypto: "Kenaikan suku bunga membuat uang lebih ketat dan cenderung meredam minat pada aset berisiko seperti {asset}.",
    },
  },
  hawkish: {
    name: "Hawkish (condong ke suku bunga tinggi)",
    what: "Bank sentral (atau salah satu pejabatnya) yang condong menaikkan suku bunga untuk melawan inflasi. Kebalikannya adalah dovish.",
    moves: "Nada hawkish biasanya menguatkan mata uang bank sentral itu. Untuk {asset}, arahnya tergantung di sisi mana mata uang itu berada.",
  },
  dovish: {
    name: "Dovish (condong ke suku bunga rendah)",
    what: "Bank sentral yang condong menurunkan suku bunga untuk mendukung pertumbuhan ekonomi dan lapangan kerja. Kebalikannya adalah hawkish.",
    moves: "Nada dovish biasanya melemahkan mata uang bank sentral itu. Untuk {asset}, arahnya tergantung di sisi mana mata uang itu berada.",
  },
  policyGap: {
    name: "Selisih suku bunga (perbedaan kebijakan)",
    what: "Perbedaan suku bunga antara dua negara. Dana cenderung mengalir ke mata uang yang memberi bunga lebih tinggi.",
    moves: "Saat selisihnya melebar ke arah salah satu mata uang dalam {asset}, mata uang itu cenderung menguat terhadap yang lain.",
  },
  carryTrade: {
    name: "Carry trade (pinjam di bunga rendah, simpan di bunga tinggi)",
    what: "Meminjam dalam mata uang bersuku bunga rendah untuk memegang mata uang bersuku bunga lebih tinggi, demi mengantongi selisih bunganya. Populer di kalangan dana besar saat pasar tenang.",
    moves: "Carry trade cenderung membuat mata uang bersuku bunga rendah (seperti yen atau franc) tetap lemah saat pasar tenang, dan bisa ditutup beramai-ramai saat rasa takut naik — mata uang bersuku bunga rendah itu lalu melonjak.",
  },
  basisPoints: {
    name: "Basis poin (bp)",
    what: "Satuan untuk mengukur pergerakan kecil suku bunga. 100 basis poin = 1%, jadi penurunan 25bp menurunkan suku bunga sebesar seperempat persen.",
    moves: "Semakin besar pergerakannya dalam basis poin, semakin besar perubahan suku bunga yang harus direspons pasar.",
  },

  ecb: {
    name: "ECB (bank sentral Eropa)",
    what: "Bank sentral untuk euro. ECB menetapkan suku bunga bagi 20 negara yang memakai euro.",
    moves: "ECB yang lebih hawkish cenderung mengangkat euro; yang lebih dovish cenderung menekannya.",
  },
  boe: {
    name: "BoE (bank sentral Inggris)",
    what: "Bank sentral Inggris. BoE menetapkan suku bunga untuk poundsterling.",
    moves: "BoE yang lebih hawkish cenderung mengangkat poundsterling; yang lebih dovish cenderung menekannya.",
  },
  boj: {
    name: "BoJ (bank sentral Jepang)",
    what: "Bank sentral Jepang. Selama bertahun-tahun BoJ menahan suku bunga sangat rendah, jadi isyarat kenaikan sekecil apa pun langsung menyita perhatian.",
    moves: "Tanda-tanda BoJ akan menaikkan suku bunga cenderung menguatkan yen; tanda-tanda BoJ akan menahannya cenderung membuat yen tetap lemah.",
  },
  snb: {
    name: "SNB (bank sentral Swiss)",
    what: "Bank sentral Swiss. SNB menetapkan suku bunga untuk franc dan sesekali turun tangan di pasar agar franc tidak terlalu kuat.",
    moves: "SNB yang lebih hawkish cenderung mengangkat franc; SNB yang dovish, atau sinyal akan turun tangan untuk melemahkannya, cenderung menekannya.",
  },
  rba: {
    name: "RBA (bank sentral Australia)",
    what: "Bank sentral Australia. RBA menetapkan suku bunga untuk dolar Australia.",
    moves: "RBA yang lebih hawkish cenderung mengangkat dolar Australia; yang lebih dovish cenderung menekannya.",
  },
  rbnz: {
    name: "RBNZ (bank sentral Selandia Baru)",
    what: "Bank sentral Selandia Baru. RBNZ menetapkan suku bunga untuk dolar Selandia Baru.",
    moves: "RBNZ yang lebih hawkish cenderung mengangkat dolar Selandia Baru; yang lebih dovish cenderung menekannya.",
  },
  boc: {
    name: "BoC (bank sentral Kanada)",
    what: "Bank sentral Kanada. BoC menetapkan suku bunga untuk dolar Kanada.",
    moves: "BoC yang lebih hawkish cenderung mengangkat dolar Kanada; yang lebih dovish cenderung menekannya.",
  },

  inflation: {
    name: "Inflasi",
    what: "Seberapa cepat harga-harga naik di seluruh perekonomian. Bank sentral menaikkan suku bunga saat inflasi terlalu panas dan menurunkannya saat inflasi mereda.",
    moves: "Inflasi yang lebih tinggi dari perkiraan biasanya berarti suku bunga tinggi bertahan lebih lama, yang cenderung menguatkan mata uang negara itu. Emas juga dipandang sebagai pelindung jangka panjang dari kenaikan harga.",
  },
  cpi: {
    name: "CPI / PCE (laporan inflasi)",
    what: "Laporan bulanan tentang seberapa besar kenaikan harga. CPI adalah ukuran utamanya; PCE adalah ukuran yang lebih disukai The Fed. Versi 'core' (inti) tidak memasukkan makanan dan energi, yang harganya naik-turun tajam.",
    moves: "Angka yang panas biasanya mengangkat mata uangnya karena pasar memperkirakan suku bunga lebih tinggi; angka yang lunak biasanya melemahkannya. Rilis ini sering memicu pergerakan tajam.",
  },
  jobsReport: {
    name: "Laporan tenaga kerja (NFP, ADP, klaim pengangguran)",
    what: "Data tentang berapa banyak lapangan kerja yang bertambah di AS. NFP (non-farm payrolls) adalah laporan bulanan utamanya; ADP dan klaim pengangguran mingguan adalah petunjuk awalnya.",
    moves: {
      metal: "Data tenaga kerja yang kuat biasanya mengangkat dolar dan imbal hasil, yang cenderung menekan {asset}. Data yang lemah cenderung menopangnya.",
      fxUsdQuote: "Data tenaga kerja yang kuat biasanya mengangkat dolar, yang cenderung mendorong {asset} turun. Data yang lemah cenderung mengangkatnya.",
      fxUsdBase: "Data tenaga kerja yang kuat biasanya mengangkat dolar, yang cenderung mendorong {asset} naik. Data yang lemah cenderung mendorongnya turun.",
      crypto: "Data tenaga kerja yang lemah bisa menumbuhkan harapan penurunan suku bunga, yang cenderung menopang {asset} — kecuali jika memicu kekhawatiran yang lebih luas soal ekonomi.",
    },
  },
  pmi: {
    name: "PMI / ISM (survei bisnis)",
    what: "Survei bulanan yang menanyakan pelaku usaha apakah aktivitas bisnis sedang tumbuh atau menyusut. Di atas 50 berarti tumbuh; di bawah 50 berarti menyusut.",
    moves: "Survei yang kuat cenderung menopang mata uang negara itu; survei yang lemah cenderung menekannya.",
  },

  vix: {
    name: "VIX ('pengukur rasa takut')",
    what: "Ukuran seberapa gelisah pasar saham AS, berdasarkan berapa yang dibayar investor untuk melindungi diri. Di bawah sekitar 15 berarti tenang; di atas 25 berarti pasar ketakutan.",
    moves: "VIX yang naik biasanya berarti dana berpindah ke tempat aman: emas, yen, franc, dan dolar cenderung menguat, sementara mata uang yang peka risiko dan kripto cenderung turun.",
  },
  riskOff: {
    name: "Risk-off (pasar menghindari risiko)",
    what: "Suasana pasar saat investor gelisah dan memindahkan dana dari aset berisiko ke aset yang lebih aman.",
    moves: "Saat risk-off, aset safe haven seperti emas, yen, franc, dan sering juga dolar cenderung naik; dolar Australia, dolar Selandia Baru, dan kripto cenderung turun.",
  },
  riskOn: {
    name: "Risk-on (pasar berani mengambil risiko)",
    what: "Suasana pasar saat investor merasa percaya diri dan mau memegang aset berisiko seperti saham dan kripto.",
    moves: "Saat risk-on, saham, kripto, serta dolar Australia dan Selandia Baru cenderung naik; aset safe haven seperti yen dan franc cenderung tertinggal.",
  },
  safeHaven: {
    name: "Safe haven (aset aman)",
    what: "Aset yang diburu orang saat pasar ketakutan — biasanya emas, yen Jepang, franc Swiss, dan obligasi pemerintah AS.",
    moves: "Aset safe haven cenderung naik saat rasa takut meningkat, bahkan ketika alasan lain menunjuk ke arah sebaliknya.",
  },
  equities: {
    name: "Pasar saham (S&P 500, Nasdaq)",
    what: "Indeks saham utama AS. Fundamental Desk memantaunya untuk membaca seberapa percaya diri investor.",
    moves: "Saham yang naik biasanya menandakan suasana risk-on yang percaya diri; saham yang turun menandakan suasana risk-off yang gelisah.",
  },
  oil: {
    name: "Minyak (Brent, WTI)",
    what: "Dua harga acuan untuk minyak mentah. Minyak ikut memengaruhi inflasi dan sangat penting bagi negara pengekspor minyak seperti Kanada.",
    moves: "Minyak yang naik cenderung menopang dolar Kanada dan bisa mendorong inflasi naik, yang memengaruhi cara bank sentral menimbang suku bunga.",
  },
  geopolitics: {
    name: "Risiko geopolitik",
    what: "Perang, konflik, sanksi, dan ketegangan antarnegara yang bisa mengguncang pasar.",
    moves: "Ketegangan yang meningkat biasanya mendorong dana ke aset safe haven seperti emas, yen, dan franc.",
  },
  election: {
    name: "Pemilu (termasuk pemilu sela AS)",
    what: "Pemungutan suara yang bisa mengubah rencana belanja, pajak, dan perdagangan pemerintah. Pemilu sela (midterms) AS menentukan siapa yang menguasai Kongres di pertengahan masa jabatan presiden.",
    moves: "Pasar bergerak berdasarkan arti hasil pemilu bagi belanja negara, utang, dan suku bunga ke depan — kejutannya lebih berpengaruh daripada hasilnya sendiri.",
  },

  etfFlows: {
    name: "Aliran dana ETF",
    what: "Dana yang masuk ke atau keluar dari ETF (reksa dana yang diperdagangkan di bursa) yang memegang aset tersebut untuk investor. Ini petunjuk seberapa besar permintaan yang nyata.",
    moves: "Dana yang terus mengalir masuk ke ETF {asset} cenderung menopang harganya; dana yang keluar cenderung menekannya.",
  },
  structuralBid: {
    name: "Structural bid (permintaan beli jangka panjang)",
    what: "Pembelian yang stabil dan berjangka panjang, yang tidak bergantung pada berita harian — misalnya bank sentral yang terus menambah cadangannya dari tahun ke tahun.",
    moves: "Structural bid cenderung menahan {asset} saat harganya turun, bahkan ketika pendorong jangka pendek menunjuk ke arah sebaliknya.",
  },
  positioning: {
    name: "Positioning (posisi pasar, COT)",
    what: "Seberapa besar trader-trader besar sudah bertaruh ke satu arah. Laporan COT menunjukkannya setiap minggu untuk pasar berjangka.",
    moves: "Saat satu arah sudah terlalu ramai, pembeli atau penjual baru yang tersisa makin sedikit, dan kejutan apa pun bisa memicu pergerakan tajam ke arah sebaliknya.",
  },

  goldSilverRatio: {
    name: "Rasio emas/perak",
    what: "Berapa ons perak yang dibutuhkan untuk membeli satu ons emas. Rasio ini menunjukkan apakah perak sedang murah atau mahal dibandingkan emas.",
    moves: "Rasio yang turun berarti perak bergerak lebih kencang daripada emas; rasio yang naik berarti emas yang bergerak lebih kencang daripada perak.",
  },
  copper: {
    name: "Tembaga",
    what: "Logam industri yang dipakai dalam konstruksi dan elektronik, dan sering dipantau sebagai tanda seberapa kuat ekonomi global.",
    moves: "Perak sebagian juga merupakan logam industri, jadi tembaga yang kuat sering beriringan dengan permintaan perak yang lebih kuat.",
  },
  wgc: {
    name: "WGC (World Gold Council / Dewan Emas Dunia)",
    what: "Lembaga riset pasar industri emas. WGC menerbitkan data tentang siapa yang membeli emas — bank sentral, dana investasi, dan pembeli perhiasan.",
    moves: "Laporannya menunjukkan apakah permintaan terhadap {asset} sedang tumbuh atau memudar.",
  },
  centralBankBuying: {
    name: "Pembelian emas oleh bank sentral",
    what: "Bank-bank sentral di seluruh dunia menambah emas ke cadangan mereka, sering kali agar tidak terlalu bergantung pada dolar AS.",
    moves: "Pembelian yang stabil oleh bank sentral menjadi salah satu penopang jangka panjang terbesar bagi {asset}.",
  },

  btcDominance: {
    name: "Dominasi Bitcoin",
    what: "Porsi Bitcoin dari total nilai seluruh mata uang kripto.",
    moves: "Dominasi yang naik berarti dana lebih memilih Bitcoin dibanding koin lain; dominasi yang turun berarti dana menyebar ke koin lain seperti Ether.",
  },
  fundingRate: {
    name: "Funding rate (biaya pendanaan)",
    what: "Biaya kecil yang dibayar antar-trader agar posisi kripto dengan leverage tetap terbuka. Positif berarti lebih banyak trader yang bertaruh harga naik.",
    moves: "Funding rate yang sangat tinggi berarti pasar terlalu ramai di satu sisi, yang bisa memicu pergerakan tajam ke arah sebaliknya saat posisi-posisi itu terpaksa ditutup.",
  },

  ema: {
    name: "EMA (rata-rata bergerak)",
    what: "Garis di grafik yang menunjukkan harga rata-rata beberapa candle terakhir, dengan bobot lebih besar pada yang terbaru. Fundamental Desk memakai 50 EMA untuk menilai tren.",
    moves: "Harga di atas garis menandakan tren terbaru sedang naik; di bawahnya menandakan tren sedang turun. 'Reclaim' (merebut kembali) garis itu berarti harga sudah naik lagi ke atasnya.",
  },
  timeframe: {
    name: "Timeframe grafik (H1, H4, D1)",
    what: "Rentang waktu yang diwakili setiap candle di grafik: H1 = 1 jam, H4 = 4 jam, D1 = 1 hari, W1 = 1 minggu.",
    moves: "Timeframe yang lebih panjang menunjukkan tren besarnya; yang lebih pendek menunjukkan pergerakan di dalam tren itu.",
  },
  supportResistance: {
    name: "Support dan resistance",
    what: "Area harga tempat pembeli (support, di bawah) atau penjual (resistance, di atas) pernah masuk sebelumnya.",
    moves: "Harga sering tertahan atau berbalik di area ini. Jika harga menembusnya dengan tegas, gambarannya bisa berubah.",
  },
  breakout: {
    name: "Breakout / breakdown",
    what: "Saat harga menembus dengan tegas level yang sebelumnya menjadi batas atasnya (breakout) atau batas bawahnya (breakdown).",
    moves: "Breakout yang bertahan sering diikuti pergerakan lanjutan ke arah yang sama; yang cepat berbalik disebut false break (tembus palsu).",
  },
  invalidation: {
    name: "Invalidasi",
    what: "Titik di mana pandangan Fundamental Desk terbukti salah — level harga atau peristiwa yang membuat tesisnya dibatalkan atau dipikir ulang.",
    moves: "Jika harga melewati level invalidasi, pandangan Fundamental Desk saat ini tentang {asset} tidak berlaku lagi.",
  },
  conviction: {
    name: "Keyakinan (conviction)",
    what: "Seberapa kuat Fundamental Desk memegang pandangannya, berdasarkan berapa banyak pendorong utama yang sejalan.",
    moves: "Keyakinan tinggi berarti pendorongnya searah; keyakinan rendah berarti pendorongnya campur aduk dan gambarannya bisa cepat berubah.",
  },
  regime: {
    name: "Rezim (regime)",
    what: "Latar besar yang sedang menggerakkan pasar — misalnya 'suku bunga sedang turun' atau 'investor sedang gelisah'. Bisa bertahan berminggu-minggu hingga berbulan-bulan.",
    moves: "Rezim menentukan berita mana yang paling penting bagi {asset}; saat rezim bergeser, reaksi yang biasa bisa berbalik.",
  },
  tactical: {
    name: "Taktis (tactical)",
    what: "Pandangan jangka pendek, untuk beberapa jam atau hari ke depan, bukan gambaran besarnya.",
    moves: "Pandangan taktis bisa menunjuk ke satu arah, sementara gambaran jangka panjangnya menunjuk ke arah lain.",
  },
};
