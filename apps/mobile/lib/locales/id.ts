import { registerLocale } from '../i18n';

/** Indonesian UI locale — machine-generated (Step 2), review recommended.
 *  Regenerate/extend with: node scripts/translate-locale.mjs id */
const id: Record<string, string> = {
  "app.today": "Hari ini",
  "app.signOut": "Keluar",
  "app.back": "Kembali ke hari ini",
  "app.tryAgain": "Coba lagi",
  "app.language": "Bahasa aplikasi",
  "auth.title": "Ruang kelas Anda",
  "auth.subtitle": "Guru privat yang mengingat setiap pelajaran, kesalahan, dan keberhasilan.",
  "auth.name": "Nama (opsional)",
  "auth.email": "Email",
  "auth.password": "Kata sandi",
  "auth.start": "Mulai belajar",
  "auth.signIn": "Masuk",
  "auth.haveAccount": "Saya sudah punya akun",
  "auth.createAccount": "Buat akun",
  "auth.headline": "Aktifkan kembaran digital Anda",
  "auth.emailPh": "anda@contoh.com",
  "auth.namePh": "Nama Anda",
  "auth.createBtn": "Buat akun saya",
  "auth.forgot": "Lupa kata sandi?",
  "auth.noAccount": "Belum punya akun?",
  "auth.otpTitle": "Konfirmasi email Anda",
  "auth.otpSubtitle": "Masukkan 6 digit kode yang dikirim ke {email}.",
  "auth.verify": "Verifikasi",
  "auth.notReceived": "Tidak menerima?",
  "auth.resend": "Kirim ulang kode",
  "auth.resendIn": "Kirim ulang dalam {n}d",
  "auth.skip": "Lewati langkah ini",
  "auth.expired": "Kode kedaluwarsa — minta yang baru.",
  "auth.otpError": "Kode tidak valid. Silakan coba lagi.",
  "auth.forgotTitle": "Lupa kata sandi",
  "auth.forgotSubtitle": "Masukkan email Anda dan kami akan mengirimkan kode pengaturan ulang.",
  "auth.sendCode": "Kirim kode",
  "auth.back": "Kembali",
  "auth.resetTitle": "Atur ulang kata sandi",
  "auth.resetSubtitle": "Masukkan kode dan kata sandi baru Anda.",
  "auth.newPassword": "Kata sandi baru",
  "auth.reset": "Atur ulang",
  "auth.resetSent": "Jika akun untuk {email} ada, kode pengaturan ulang telah dikirim.",
  "auth.resetOk": "Kata sandi diatur ulang — silakan masuk.",
  "auth.codeSent": "Kode telah dikirim ke {email}.",
  "auth.newCodeSent": "Kode baru terkirim.",
  "auth.2faTitle": "Verifikasi dua langkah",
  "auth.2faSubtitle": "Masukkan kode dari aplikasi autentikator Anda.",
  "auth.useRecovery": "Gunakan kode pemulihan",
  "auth.recoveryPh": "Kode pemulihan",
  "classroom.opening": "Membuka ruang kelas Anda…",
  "classroom.streak": "hari beruntun",
  "classroom.milestone": "Tonggak sejarah baru",
  "classroom.emptyTitle": "Belum ada jadwal",
  "classroom.emptyDetail": "Hari Anda dibangun dari pekerjaan nyata. Pindai halaman kursus Anda atau mulai diskusi, dan ruang kelas akan merencanakannya.",
  "classroom.replan": "Rencanakan ulang hari ini",
  "classroom.offlineTitle": "Tidak dapat terhubung ke ruang kelas Anda",
  "classroom.offlineDetail": "Anda masih masuk — server sedang tidak merespons. Periksa apakah API berjalan, lalu coba lagi.",
  "classroom.start": "Mulai",
  "classroom.done": "Selesai",
  "classroom.skip": "Lewati",
  "classroom.isDone": "✓ Selesai",
  "classroom.isSkipped": "Dilewati",
  "slot.morning": "Pagi · tinjau kemarin",
  "slot.afternoon": "Sore · pelajaran hari ini",
  "slot.evening": "Malam · latihan",
  "slot.night": "Sebelum tidur · ulasan singkat",
  "nav.teacher": "Tanya guru Anda",
  "nav.scan": "📷 Pindai kursus",
  "nav.languages": "Bahasa",
  "nav.revision": "Antrean ulasan",
  "nav.progress": "Kemajuan",
  "tab.home": "Beranda",
  "tab.learn": "Belajar",
  "tab.brain": "Otak Saya",
  "tab.study": "Belajar",
  "tab.profile": "Profil",
  "learn.title": "Belajar",
  "learn.intro": "Tempat Anda menyerap pengetahuan baru.",
  "learn.teacher.title": "Tanya guru Anda",
  "learn.teacher.detail": "Diskusikan apa saja — dijawab dari catatan Anda sendiri, melalui suara atau teks.",
  "learn.languages.title": "Bahasa",
  "learn.languages.detail": "Kosakata, percakapan, dan pelafalan dalam bahasa yang sedang Anda pelajari.",
  "learn.scan.title": "Pindai kursus",
  "learn.scan.detail": "Foto sebuah halaman atau catatan Anda dan simpan ke dalam memori.",
  "brain.title": "Otak Saya",
  "brain.intro": "Segala sesuatu yang telah Anda pelajari, dan seberapa baik Anda memahaminya.",
  "brain.progress.title": "Kemajuan & penguasaan",
  "brain.progress.detail": "Streak, tingkat retensi, konsep yang dikuasai, dan pencapaian Anda.",
  "study.title": "Belajar",
  "study.intro": "Latih pada saat yang tepat, dijadwalkan dengan pengulangan berjarak (spaced repetition).",
  "study.revision.title": "Antrean ulasan",
  "study.revision.detail": "Tinjau kartu yang harus dipelajari sekarang.",
  "profile.title": "Profil",
  "profile.account": "Akun",
  "profile.health.title": "Kesehatan sistem",
  "profile.health.detail": "Periksa apakah layanan di balik ruang kelas Anda aktif.",
  "home.greeting": "Halo",
  "home.objective": "Tujuan hari ini",
  "home.objectiveNone": "Belum ada rencana — pindai kursus atau mulai diskusi.",
  "home.teacher": "Guru AI Anda",
  "home.continue": "Lanjutkan pelajaran terakhir Anda",
  "home.continueNone": "Belum ada pelajaran — pelajaran pertama Anda akan muncul di sini.",
  "home.priority": "Ulasan prioritas",
  "home.cardsDue": "kartu harus ditinjau",
  "home.reviewNow": "Tinjau sekarang",
  "home.nothingDue": "Tidak ada yang perlu ditinjau — Anda sudah memperbaruinya.",
  "home.plan": "Rencana hari ini",
  "home.progress": "Kemajuan",
  "home.retention": "retensi",
  "home.mastered": "dikuasai",
  "home.recommendations": "Rekomendasi AI",
  "home.recommendWork": "Kerjakan",
  "home.recommendNone": "Tambahkan konsep atau dokumen dan rekomendasi akan muncul di sini.",
  "home.open": "Buka",
  "teacher.streak": "Konsistensi hebat — jaga agar streak Anda tetap aktif!",
  "teacher.due": "Anda memiliki ulasan yang menunggu. Mulailah dengan itu.",
  "teacher.first": "Siap untuk pelajaran pertama Anda? Pindai kursus atau tanyakan apa saja kepada saya.",
  "teacher.default": "Siap mempelajari sesuatu yang baru hari ini?",
  "soon.badge": "Segera hadir",
  "soon.detail": "Data akan muncul setelah sesi pembelajaran cukup.",
  "learn.library": "Perpustakaan",
  "learn.ocr": "Pemindai OCR",
  "learn.documents": "Dokumen",
  "learn.exercises": "Latihan",
  "learn.assessments": "Penilaian",
  "learn.assessments.detail": "Guru sebagai penguji: Pilihan ganda, esai, studi kasus, ujian latihan — dinilai lengkap dengan penjelasan dan saran.",
  "learn.writing.title": "Pelatih Menulis",
  "learn.writing.detail": "Kirim esai, laporan, atau disertasi — ditinjau dari segi struktur, logika, kejelasan, tata bahasa, dan argumentasi.",
  "learn.reading.title": "Pelatih Membaca",
  "learn.reading.detail": "Bacaan yang disesuaikan levelnya dengan pertanyaan pemahaman — tingkat kesulitannya menyesuaikan saat kemampuan Anda meningkat.",
  "study.planning": "Perencanaan",
  "study.fsrs": "FSRS",
  "study.fsrs.detail": "Ulas apa saja dengan FSRS",
  "study.goals": "Target",
  "study.exams": "Ujian",
  "study.notifications": "Notifikasi",
  "brain.twin": "Kembaran Digital",
  "brain.twin.detail": "Profil belajar Anda",
  "brain.memory": "Memori Belajar",
  "brain.memory.detail": "Semua yang diingat oleh AI",
  "brain.mastery": "Penguasaan Konsep",
  "brain.mastery.detail": "Nilai untuk setiap konsep",
  "brain.graph": "Peta Pengetahuan",
  "brain.graph.detail": "Bagaimana konsep Anda saling terhubung",
  "brain.dna": "DNA Belajar",
  "brain.score": "Skor Belajar",
  "brain.strengths": "Kekuatan",
  "brain.strengths.detail": "Hal yang Anda kuasai",
  "brain.weaknesses": "Kelemahan",
  "brain.weaknesses.detail": "Hal yang mulai menurun",
  "brain.insights": "Wawasan AI",
  "brain.insights.detail": "Alasan AI menyarankan ini",
  "brain.recommend": "Rekomendasi",
  "brain.recommend.detail": "Apa yang harus dilakukan selanjutnya",
  "brain.dash.tagline": "Pikiran yang belajar — semua yang Second Brain ketahui tentang Anda, secara langsung.",
  "brain.dash.memories": "memori",
  "brain.dash.concepts": "konsep",
  "brain.dash.links": "tautan",
  "brain.dash.none": "Belum ada apa pun",
  "revEng.title": "Mesin Revisi",
  "revEng.intro": "Satu antrean FSRS untuk segalanya — pelajaran, latihan, kuis, pekerjaan rumah, bahasa.",
  "revEng.loading": "Membangun antrean ulasan Anda…",
  "revEng.empty": "Belum ada yang perlu diulas — pelajari sesuatu dan itu akan dijadwalkan di sini.",
  "revEng.next": "berikutnya",
  "revEng.now": "sekarang",
  "revEng.tomorrow": "besok",
  "revEng.days": "hari",
  "revEng.again": "Ulangi",
  "revEng.hard": "Sulit",
  "revEng.good": "Baik",
  "revEng.easy": "Mudah",
  "plan.title": "Perencana Belajar",
  "plan.tileDetail": "Hari Anda, disusun oleh AI",
  "plan.intro": "Sang pengatur. AI tidak membuat apa pun sendiri — AI menyusun hari Anda dari mesin-mesin lainnya.",
  "plan.loading": "Menyusun hari Anda…",
  "plan.assembled": "Disusun dari",
  "plan.live": "Rencana langsung — berubah sepanjang hari.",
  "plan.replan": "🔄 Buat rencana ulang dari sekarang",
  "plan.items": "item",
  "plan.k.revision": "Revisi",
  "plan.k.lesson": "Pelajaran",
  "plan.k.discussion": "Diskusi",
  "plan.k.practical": "Praktik",
  "plan.k.quiz": "Kuis",
  "plan.k.summary": "Ringkasan",
  "plan.k.break": "Istirahat",
  "plan.k.end": "Selesai",
  "daily.title": "Sesi Harian",
  "daily.start": "🎓 Mulai sesi hari ini",
  "daily.loading": "Menyiapkan kelasmu…",
  "daily.noRevision": "Tidak ada yang perlu direview saat ini — langsung ke pembelajaran hari ini.",
  "daily.revisionIntro": "Pertama, mari segarkan apa yang harus ditinjau:",
  "daily.discussionIntro": "Tanyakan apa saja kepada gurumu tentang topik ini — langsung di sini.",
  "daily.ask": "💬 Tanya guru",
  "daily.askMore": "💬 Tanya lagi",
  "daily.askPrompt": "Bisakah kamu menjelaskan gagasan utama topik ini dengan cara yang sederhana?",
  "daily.askError": "Guru sedang tidak tersedia saat ini — coba lagi sebentar lagi.",
  "daily.checkIntro": "Jawab dengan kata-katamu sendiri — aku akan memeriksa pemahamanmu dan membantu jika diperlukan.",
  "daily.check.placeholder": "Jawabanmu…",
  "daily.check.btn": "Periksa pemahamanku",
  "daily.check.again": "Periksa lagi",
  "daily.check.understood": "Paham!",
  "daily.check.partial": "Hampir — mari sempurnakan",
  "daily.check.confused": "Mari bahas ini lagi",
  "daily.check.reexplain": "Berikut cara lain untuk memahaminya",
  "daily.planningIntro": "Inilah yang telah kuRencanakan untukmu berikutnya:",
  "daily.p.welcome": "Selamat datang",
  "daily.p.objectives": "Tujuan",
  "daily.p.revision": "Revisi",
  "daily.p.lesson": "Pelajaran",
  "daily.p.questions": "Pertanyaan",
  "daily.p.discussion": "Diskusi",
  "daily.p.exercises": "Latihan",
  "daily.p.homework": "Praktik / PR",
  "daily.p.correction": "Koreksi",
  "daily.p.quiz": "Kuis",
  "daily.p.summary": "Ringkasan",
  "daily.p.flashcards": "Flashcard",
  "daily.p.brain": "Pembaruan otak",
  "daily.p.planning": "Perencanaan otomatis",
  "cal.title": "Kalender Cerdas",
  "cal.tileDetail": "Ujian, revisi & lainnya — dibuat otomatis",
  "cal.intro": "Dibuat otomatis dari semua yang dijadwalkan AI. Tambahkan ujian dan tujuanmu sendiri; AI akan menjaga prioritasnya.",
  "cal.loading": "Membangun kalender...",
  "cal.add": "Tambahkan sendiri",
  "cal.titlePlaceholder": "mis. Ujian Matematika",
  "cal.addBtn": "➕ Tambahkan ke kalender",
  "cal.todayTag": "Hari ini",
  "cal.nothing": "Tidak ada rencana",
  "cal.today": "Hari ini",
  "cal.tomorrow": "Besok",
  "cal.in3": "Dalam 3 hari",
  "cal.in7": "Dalam seminggu",
  "cal.k.exam": "Ujian",
  "cal.k.homework": "PR",
  "cal.k.practical": "Praktik",
  "cal.k.language": "Bahasa",
  "cal.k.aiSession": "Sesi AI",
  "cal.k.revision": "Revisi",
  "cal.k.quiz": "Kuis",
  "cal.k.objective": "Tujuan",
  "cal.k.deadline": "Tenggat waktu",
  "pred.title": "Revisi Prediktif",
  "pred.tileDetail": "Antisipasi kelupaan sebelum itu terjadi",
  "pred.intro": "Lapisan di atas FSRS. FSRS memberi tahu apa yang harus diulas sekarang; fitur ini memprediksi apa yang akan kamu lupakan — sehingga AI bertindak sebelumnya.",
  "pred.loading": "Memproyeksikan kurva lupa kamu…",
  "pred.fsrs": "FSRS: “Kamu perlu mengulas hari ini.”",
  "pred.predictive": "Prediktif: “Dalam beberapa hari ke depan, daya ingatmu akan melewati ambang batas.”",
  "pred.empty": "Semua stabil — tidak ada yang berisiko terlupakan dalam waktu dekat.",
  "pred.in": "Dalam",
  "pred.forgettingPass": "daya ingatmu akan melewati",
  "pred.now": "sekarang",
  "pred.today": "hari ini",
  "pred.oneDay": "1 hari",
  "pred.days": "hari",
  "pred.reviewAhead": "🔁 Ulas sekarang agar tetap selangkah lebih maju",
  "notif.title": "Notifikasi Cerdas",
  "notif.tileDetail": "Pedagogis, selalu beralasan",
  "notif.loading": "Menyiapkan notifikasi kamu…",
  "notif.hello": "Halo",
  "notif.helloNoName": "Halo.",
  "notif.empty": "Tidak ada yang perlu diperhatikan saat ini — kamu sudah on track.",
  "notif.review": "Ulasan singkat berdurasi {m} menit untuk {s} hari ini akan meningkatkan penguasaanmu sebesar {p}%.",
  "notif.exam": "Ujian “{s}” kamu dalam {d} hari lagi. Aku telah menyusun ulang rencana kamu secara otomatis.",
  "notif.unlock": "Kerja bagus. Kita sekarang bisa mulai {next}.",
  "notif.forecast": "Dalam {d} hari, daya ingatmu terhadap {s} akan turun dan melampaui batas lupa {p}%. Ulasan cepat sekarang akan mencegahnya.",
  "notif.src.mastery": "Berdasarkan penguasaanmu saat ini",
  "notif.src.calendar": "Dari kalender kamu",
  "notif.src.path": "Dari jalur belajar kamu",
  "notif.src.forecast": "Dari pengulangan prediktif",
  "notif.cta.review": "🔁 Mulai ulasan",
  "notif.cta.exam": "📅 Lihat rencana saya",
  "notif.cta.unlock": "🎓 Mulai sekarang",
  "notif.cta.forecast": "🔮 Ulas lebih awal",
  "apath.title": "Jalur Adaptif",
  "apath.tileDetail": "AI menentukan urutan belajarmu",
  "apath.intro": "Beritahu aku apa yang ingin kamu pelajari. Aku akan memeriksa peta pengetahuan dan penguasaanmu, lalu menentukan urutan yang tepat.",
  "apath.loading": "Memuat konsep kamu…",
  "apath.thinking": "Menentukan urutan terbaik…",
  "apath.pickGoal": "Aku ingin belajar…",
  "apath.noConcepts": "Belum ada konsep — pelajari sesuatu terlebih dahulu, lalu tetapkan tujuan.",
  "apath.verdictConsolidate": "Sebelum memulai {target}, mari mantapkan {list}. Kamu akan lebih memahami materi berikutnya.",
  "apath.verdictReady": "Semuanya sudah siap — kamu bisa langsung mulai {target}!",
  "apath.and": "dan",
  "apath.a.ready": "Dikuasai",
  "apath.a.consolidate": "Untuk dimantapkan",
  "apath.a.target": "Tujuan",
  "profile.preferences": "Preferensi",
  "profile.languages": "Bahasa",
  "profile.subscription": "Langganan",
  "profile.aiSettings": "Pengaturan AI",
  "profile.notifications": "Notifikasi",
  "aiteacher.continue": "Hari ini kita akan melanjutkan",
  "aiteacher.work": "Hari ini kita akan mengerjakan",
  "aiteacher.reviewFirst": "Namun sebelumnya, mari kita ulas secara singkat",
  "aiteacher.startLesson": "Mulai pelajaran",
  "aiteacher.empty": "Aku adalah gurumu. Beritahu aku apa yang ingin kamu pelajari, atau pindai kursus untuk memulai.",
  "aiteacher.ready": "Kapan pun kamu siap.",
  "aiteacher.talkTitle": "Bicara dengan gurumu",
  "aiteacher.topicPlaceholder": "Apa yang ingin kamu diskusikan?",
  "aiteacher.talk": "Mulai berbicara",
  "aiteacher.resume": "💬 Lanjutkan percakapan kita",
  "aiteacher.twinPick": "Biarkan gurumu memilih bagian lemahmu",
  "aiteacher.recent": "Diskusi terbaru",
  "aiteacher.messages": "pesan",
  "aiteacher.focusedOn": "berfokus pada",
  "aiteacher.untitled": "Diskusi tanpa judul",
  "aiteacher.open": "Buka",
  "aiteacher.finishedLesson": "Kemarin kita telah menyelesaikan pelajaran tentang",
  "aiteacher.todayReview": "Hari ini saya sarankan untuk mengulas",
  "aiteacher.difficulties": "karena saya melihat ada beberapa kesulitan.",
  "aiteacher.todayDiscover": "Hari ini kita akan mulai membahas",
  "aiteacher.thenNext": "Lalu kita akan lanjut ke",
  "aiteacher.sessionCard": "Sesi hari ini",
  "aiteacher.objective": "Tujuan",
  "aiteacher.duration": "Estimasi waktu",
  "aiteacher.levelLabel": "Tingkat",
  "aiteacher.minutes": "men",
  "aiteacher.objReview": "Tinjau dan mantapkan",
  "aiteacher.objDiscover": "Pahami",
  "aiteacher.readyQ": "Siap?",
  "aiteacher.start": "▶  Mulai",
  "level.beginner": "Pemula",
  "level.intermediate": "Menengah",
  "level.advanced": "Mahir",
  "lesson.opening": "Membuka pelajaranmu…",
  "lesson.pitchedAt": "tingkat, disesuaikan untukmu",
  "lesson.objectives": "Tujuan",
  "lesson.introduction": "Pengantar",
  "lesson.concept": "Konsep",
  "lesson.explanation": "Penjelasan",
  "lesson.objectiveLabel": "Tujuan",
  "lesson.example": "Contoh",
  "lesson.keyPoints": "Poin penting",
  "lesson.examples": "Contoh",
  "lesson.questions": "Pertanyaan",
  "lesson.exercises": "Latihan",
  "lesson.correction": "Koreksi",
  "lesson.summary": "Ringkasan",
  "lesson.flashcards": "Kartu memori",
  "lesson.revision": "Ulasan",
  "lesson.homework": "Pekerjaan rumah",
  "lesson.reflect": "Renungkan ini sebelum melanjutkan.",
  "lesson.readAloud": "Bacakan ini untuk saya",
  "lesson.yourAnswer": "Jawabanmu",
  "lesson.submit": "Kirim jawaban",
  "lesson.answerAgain": "Jawab lagi",
  "lesson.correct": "✓ Benar",
  "lesson.notQuite": "✗ Kurang tepat",
  "lesson.feedback": "Umpan balik",
  "lesson.rootCause": "Akar masalah",
  "lesson.showCorrections": "Tampilkan contoh jawaban",
  "lesson.hideCorrections": "Sembunyikan contoh jawaban",
  "lesson.reveal": "Ketuk untuk membuka",
  "lesson.noFlashcards": "Tidak ada kartu memori untuk pelajaran ini.",
  "lesson.cardsScheduled": "kartu memori dijadwalkan dalam antrean ulasanmu.",
  "lesson.reviewNow": "Ulas sekarang",
  "lesson.savePdf": "📄 Simpan sebagai PDF",
  "lesson.doHomework": "📝 Kerjakan PR-ku",
  "lesson.step": "Langkah",
  "lesson.of": "dari",
  "lesson.continue": "Lanjutkan",
  "lesson.previous": "Kembali",
  "lesson.finish": "Selesaikan pelajaran",
  "lesson.finishSession": "Selesaikan sesi",
  "lesson.why": "Kenapa?",
  "lesson.how": "Bagaimana?",
  "lesson.errorMade": "Kesalahan apa?",
  "lesson.howToAvoid": "Bagaimana cara menghindarinya?",
  "exercise.qcm": "Pilihan ganda",
  "exercise.open": "Pertanyaan terbuka",
  "exercise.exercise": "Latihan",
  "exercise.case": "Kasus praktis",
  "lesson.scheduleIn": "Saya akan menjadwalkan ulasan ini dalam",
  "lesson.days": "hari",
  "lesson.day": "hari",
  "lesson.scheduleWhy": "Mengapa? Karena pengulangan berjarak memprediksi kapan Anda akan lupa — dan mengulasnya tepat sebelum itu terjadi.",
  "lesson.scheduleNow": "Kartu-kartu ini sudah siap. Ulaslah, dan saya akan menjadwalkan kartu berikutnya tepat saat Anda hampir lupa.",
  "aiteacher.yesterday": "Kemarin kita membahas",
  "aiteacher.beforeContinuing": "Sebelum kita lanjutkan, mari ulas ide-ide utamanya.",
  "lang.dialogue": "Dialog",
  "lang.dialogueHelp": "Percakapan singkat berseri untuk dipelajari.",
  "lang.scenarioPlaceholder": "Skenario (opsional) — cth. di pasar",
  "lang.generateDialogue": "Buat dialog",
  "lang.essay": "Koreksi tulisan saya",
  "lang.essayHelp": "Tulis beberapa kalimat dan saya akan mengoreksinya seperti seorang guru.",
  "lang.essayPlaceholder": "Tulis teks Anda di sini…",
  "lang.correctEssay": "Koreksi",
  "lang.assessment": "Penilaian",
  "lang.correctedVersion": "Versi yang dikoreksi",
  "lang.noMistakes": "Tidak ada kesalahan — bagus sekali!",
  "coach.title": "Pelatih Anda",
  "coach.suggestToday": "Hari ini saya menyarankan:",
  "coach.min": "menit",
  "coach.why": "Kenapa?",
  "mentor.why": "Alasan saya menyarankan ini",
  "mentor.act": "Ayo lakukan",
  "mentor.dismiss": "Jangan sekarang",
  "coachp.title": "Pelatih Akademik Saya",
  "coachp.tileDetail": "Kecepatan, tingkat kesulitan, dan metode — disesuaikan untuk Anda",
  "coachp.loading": "Membaca kebiasaan belajar Anda…",
  "coachp.state": "Posisi Anda saat ini",
  "coachp.streak": "Rentetan",
  "coachp.discipline": "Disiplin",
  "coachp.week": "Minggu ini",
  "coachp.mastery": "Penguasaan",
  "coachp.goals": "Target",
  "coachp.pace": "Kecepatan",
  "coachp.difficulty": "Kesulitan",
  "coachp.method": "Metode",
  "coachp.session": "Durasi sesi",
  "coachp.byCoach": "Pelatih",
  "coachp.byYou": "Pilihan Anda",
  "coachp.reset": "Serahkan kembali ke pelatih",
  "coachp.pace.gentle": "Santai",
  "coachp.pace.steady": "Stabil",
  "coachp.pace.intensive": "Intensif",
  "coachp.diff.beginner": "Pemula",
  "coachp.diff.intermediate": "Menengah",
  "coachp.diff.advanced": "Mahir",
  "coachp.method.practice": "Praktik",
  "coachp.method.reading": "Membaca",
  "coachp.method.socratic": "Sokratik",
  "coachp.method.mixed": "Campuran",
  "coachp.disc.strong": "Kuat",
  "coachp.disc.building": "Membangun",
  "coachp.disc.irregular": "Tidak teratur",
  "coach.forgetting": "Anda mulai melupakan",
  "risk.title": "Wawasan",
  "risk.tileDetail": "Risiko di depan — sebelum terjadi",
  "risk.loading": "Membaca jalan di depan…",
  "risk.intro": "Saya melihat ke depan dan menandai risiko di jalur Anda — agar kita bertindak sebelum menjadi masalah.",
  "risk.calm": "Tidak ada risiko mendesak saat ini — Anda berada di jalur yang baik.",
  "risk.cause": "Kemungkinan penyebab",
  "risk.action": "Tindakan yang disarankan",
  "risk.why": "Sinyal di balik ini",
  "risk.kind.dropout": "Risiko berhenti",
  "risk.kind.difficulty": "Kesulitan di depan",
  "risk.kind.overload": "Beban berlebih",
  "risk.kind.motivation": "Penurunan motivasi",
  "risk.kind.forgetting": "Kemungkinan lupa",
  "risk.level.low": "Rendah",
  "risk.level.moderate": "Sedang",
  "risk.level.high": "Tinggi",
  "reco.title": "Untuk Anda",
  "reco.tileDetail": "Pelajaran, latihan, bacaan — dipilih untuk Anda",
  "reco.loading": "Memilih yang tepat untuk Anda…",
  "reco.intro": "Saran personal untuk semua yang bisa Anda lakukan selanjutnya — lengkap dengan alasannya.",
  "reco.empty": "Belum ada saran saat ini — kembali lagi setelah belajar sedikit lagi.",
  "reco.accept": "Ayo lakukan",
  "reco.dismiss": "Jangan sekarang",
  "reco.kind.lesson": "Pelajaran baru",
  "reco.kind.exercise": "Latihan",
  "reco.kind.reading": "Bacaan",
  "reco.kind.review": "Ulasan",
  "reco.kind.practical": "Praktis",
  "reco.kind.document": "Dokumen",
  "ment.title": "AI Mentor",
  "ment.tileDetail": "Panduan jujur tentang progres Anda yang sebenarnya",
  "ment.loading": "Mundur sejenak untuk melihat gambaran besar…",
  "ment.intro": "Melampaui pelajaran hari ini — penilaian jujur tentang kesuksesan, persiapan ujian, organisasi, metode, dan kepercayaan diri Anda.",
  "ment.focus": "Fokus",
  "ment.why": "Dasar penilaian saya",
  "ment.dim.success": "Kesuksesan akademis",
  "ment.dim.exams": "Persiapan ujian",
  "ment.dim.organization": "Organisasi",
  "ment.dim.method": "Metode kerja",
  "ment.dim.confidence": "Kepercayaan diri",
  "ment.rating.good": "Di jalur yang benar",
  "ment.rating.building": "Membangun",
  "ment.rating.concern": "Perlu ditingkatkan",
  "succ.title": "Prediktor kesuksesan",
  "succ.tileDetail": "Peluang Anda per ujian — dan cara meningkatkannya",
  "succ.loading": "Memperkirakan kesiapan ujian Anda…",
  "succ.intro": "Untuk setiap ujian: tingkat persiapan, perkiraan peluang, dan tingkat keyakinan saya.",
  "succ.note": "Tujuannya bukan memprediksi masa depan — melainkan membantu Anda bersiap lebih baik.",
  "succ.empty": "Tidak ada ujian mendatang — tambahkan satu untuk melihat kesiapan Anda.",
  "succ.preparation": "Persiapan",
  "succ.probability": "Peluang sukses",
  "succ.confidence": "Keyakinan model",
  "succ.advice": "Cara mempersiapkan",
  "succ.why": "Faktor",
  "succ.in": "dalam",
  "succ.days": "hari",
  "succ.today": "hari ini",
  "succ.band.low": "rendah",
  "succ.band.medium": "sedang",
  "succ.band.high": "tinggi",
  "ic.title": "Pusat Kecerdasan",
  "ic.metricValue": "Kekuatan, kemajuan, langkah selanjutnya",
  "ic.loading": "Menyatukan kecerdasan Anda…",
  "ic.intro": "Segala sesuatu yang telah dipelajari AI tentang Anda — kekuatan, kelemahan, kemajuan, kebiasaan, performa, dan area untuk ditingkatkan. Selalu beserta alasannya.",
  "ic.cat.strengths": "Kekuatan",
  "ic.cat.weaknesses": "Kelemahan",
  "ic.cat.progress": "Kemajuan",
  "ic.cat.habits": "Kebiasaan",
  "ic.cat.performance": "Performa",
  "ic.cat.improvement": "Area untuk ditingkatkan",
  "dna.title": "DNA Belajar",
  "dna.metricValue": "Cara Anda belajar dengan paling optimal",
  "dna.loading": "Menyusun DNA Belajar Anda…",
  "dna.intro": "Profil pembelajaran Anda yang mendalam dan stabil — cara Anda menghafal, waktu puncak Anda, serta modalitas dan format apa yang cocok untuk Anda. Profil ini akan semakin tajam seiring Anda belajar.",
  "dna.maturity": "DNA dipetakan",
  "dna.interactions": "interaksi dipelajari dari",
  "dna.trait.memory": "Cara Anda menghafal",
  "dna.trait.peakTime": "Waktu puncak",
  "dna.trait.modality": "Modalitas belajar",
  "dna.trait.explanation": "Kedalaman penjelasan",
  "dna.trait.retentionFormat": "Format retensi terbaik",
  "dna.band.emerging": "baru muncul",
  "dna.band.forming": "sedang terbentuk",
  "dna.band.established": "mapan",
  "sync.title": "Pusat Sinkronisasi",
  "sync.tileDetail": "Bekerja offline — perubahan disinkronkan saat Anda kembali online",
  "sync.intro": "Terus bekerja tanpa koneksi. Perubahan Anda disimpan dan disinkronkan secara otomatis saat Anda kembali online.",
  "sync.online": "Online",
  "sync.online.detail": "Terhubung — perubahan disinkronkan secara instan.",
  "sync.offline": "Offline",
  "sync.offline.detail": "Tidak ada koneksi — perubahan disimpan dan akan disinkronkan secara otomatis.",
  "sync.pending": "Perubahan tertunda",
  "sync.last": "Sinkronisasi terakhir",
  "sync.never": "Tidak pernah",
  "sync.now": "Sinkronkan sekarang",
  "sync.note": "Pembacaan di-cache agar data Anda tetap terlihat saat offline; penulisan dimasukkan ke antrean dan diputar ulang sesuai urutan saat koneksi kembali.",
  "mon.title": "Pemantauan",
  "mon.tileDetail": "Kesehatan sistem — lalu lintas, latensi, AI, cache",
  "mon.loading": "Membaca kesehatan sistem…",
  "mon.intro": "Kesehatan platform secara langsung, dari metrik dalam proses (juga diekspor ke Prometheus).",
  "mon.http": "Lalu lintas HTTP",
  "mon.requests": "permintaan",
  "mon.errorRate": "tingkat kesalahan",
  "mon.ai": "Panggilan AI",
  "mon.aiCalls": "panggilan",
  "mon.errors": "kesalahan",
  "mon.avgLatency": "latensi rata-rata",
  "mon.byModel": "Berdasarkan model",
  "mon.cache": "Cache",
  "mon.hitRate": "tingkat hit",
  "mon.hits": "hit",
  "mon.misses": "miss",
  "mon.process": "Proses",
  "mon.memory": "memori",
  "mon.heap": "heap",
  "mon.uptime": "waktu aktif",
  "mon.note": "Errors also flow to the Sentry/OpenTelemetry seam (active once a DSN is configured). Prometheus scrapes GET /metrics.",
  "lm.title": "Bahasa",
  "lm.manage": "Kelola bahasa",
  "lm.intro": "Setiap bahasa antarmuka dan tingkat kelengkapannya. Mengganti bahasa juga akan mengubah bahasa guru AI.",
  "lm.active": "Aktif",
  "lm.translated": "diterjemahkan",
  "lm.fallback": "sisanya kembali ke bahasa Inggris",
  "lm.note": "Bahasa baru ditambahkan dengan menyertakan file sumber — tanpa mengubah kode aplikasi. Kunci yang belum diterjemahkan otomatis kembali ke bahasa Inggris.",
  "aim.title": "Penyedia AI",
  "aim.tileDetail": "Orkestrator multi-model — pilih yang terbaik / termurah / tercepat",
  "aim.loading": "Membaca infrastruktur AI…",
  "aim.intro": "Backend AI yang tersedia dan strategi untuk memilih di antaranya. Mengganti ini akan merute ulang setiap panggilan AI.",
  "aim.strategy": "Strategi",
  "aim.active": "Penyedia aktif",
  "aim.catalog": "Penyedia",
  "aim.ready": "Siap",
  "aim.off": "Mati",
  "aim.cost": "biaya",
  "aim.speed": "kecepatan",
  "aim.quality": "kualitas",
  "aim.vision": "visi",
  "aim.strat.quality": "Terbaik",
  "aim.strat.cost": "Termurah",
  "aim.strat.speed": "Tercepat",
  "aim.strat.balanced": "Seimbang",
  "plg.title": "Ekstensi",
  "plg.tileDetail": "Space, konektor & mesin AI — peta jalan",
  "plg.loading": "Memuat ekstensi…",
  "plg.intro": "Segala hal yang dapat dikembangkan oleh Second Brain — masing-masing adalah plugin yang terdaftar tanpa menyentuh inti.",
  "plg.active": "Aktif",
  "plg.available": "Tersedia",
  "plg.planned": "Direncanakan",
  "plg.requires": "Membutuhkan",
  "plg.note": "Mesin plugin memungkinkan Brain, konektor, dan mesin AI baru ditambahkan tanpa menulis ulang secara besar-besaran — aplikasi dapat terus berkembang selama bertahun-tahun.",
  "coach.upToDate": "Anda sudah mutakhir — tidak ada yang terlewat saat ini.",
  "coach.score": "Skor Belajar",
  "coach.wouldRaise": "Ulasan ini akan menaikkan Skor Belajar Anda sebesar",
  "coach.points": "poin",
  "coach.newScore": "Belum cukup data — mulai pelajaran untuk membangun skor Anda.",
  "briefing.hello": "Halo",
  "briefing.analyzed": "Saya telah menganalisis kemajuan Anda.",
  "briefing.recommend": "Hari ini saya menyarankan:",
  "briefing.achievable": "Anda dapat mencapai target dalam {n} menit.",
  "briefing.start": "Mulai sesi saya",
  "briefing.min": "menit",
  "briefing.k.review": "Revisi",
  "briefing.k.lesson": "Pelajaran baru",
  "briefing.k.vocabulary": "Kosakata",
  "briefing.upToDate": "Semua sudah selesai — tidak ada yang mendesak hari ini. Revisi singkat tetap membantu.",
  "homework.title": "Pekerjaan Rumah",
  "homework.preparing": "Menyiapkan pekerjaan rumah yang dipersonalisasi…",
  "homework.focusLabel": "Mengapa PR ini",
  "homework.masteryAt": "Disesuaikan dengan level Anda saat ini:",
  "homework.exercises": "Latihan",
  "homework.questions": "Pertanyaan",
  "homework.correction": "Koreksi",
  "homework.reflect": "Pikirkan ini baik-baik — tanpa nilai, hanya untuk refleksi.",
  "homework.showAnswers": "Tampilkan jawaban contoh",
  "homework.hideAnswers": "Sembunyikan jawaban contoh",
  "homework.regenerate": "↻ PR baru",
  "homework.regenHint": "Buat ulang, disesuaikan dengan progres terbaru Anda.",
  "homework.back": "Kembali",
  "session.startGuided": "▶ Mulai sesi terpimpin saya",
  "session.welcome": "Sesi Anda",
  "session.yourSession": "Sesi hari ini",
  "session.defaultPlan": "Saya akan memandu Anda di sepanjang sesi, langkah demi langkah, dan memperbarui Digital Twin Anda di akhir.",
  "session.thePlan": "Rencana",
  "session.start": "▶ Mulai pelajaran",
  "session.noLesson": "Sesi ini belum memiliki pelajaran.",
  "session.home": "Kembali ke beranda",
  "session.closing": "Menutup sesi Anda dan memperbarui Digital Twin…",
  "session.done": "Sesi selesai",
  "session.whatWeDid": "Yang telah kita lakukan",
  "session.twinUpdate": "Pembaruan Digital Twin",
  "session.before": "Sebelum",
  "session.after": "Sesudah",
  "session.points": "poin",
  "session.conceptMastery": "Penguasaan konsep ini:",
  "session.nowTracked": "Digital Twin Anda kini melacak konsep ini.",
  "session.results": "Hasil",
  "session.exercisesRight": "latihan benar",
  "session.cardsScheduled": "kartu hafalan dijadwalkan (FSRS)",
  "session.nextReview": "Ulasan berikutnya:",
  "session.reviewNow": "🔁 Ulas sekarang",
  "session.today": "hari ini",
  "session.tomorrow": "besok",
  "session.inDays": "hari",
  "session.stageLesson": "Pelajaran",
  "session.stageQuestions": "Pertanyaan",
  "session.stageExercises": "Latihan",
  "session.stageCorrection": "Koreksi",
  "session.stageSummary": "Ringkasan",
  "session.stageFlashcards": "Kartu hafalan",
  "session.stageFsrs": "Penjadwalan FSRS",
  "session.stageTwin": "Pembaruan Digital Twin",
  "twin.title": "Digital Twin",
  "twin.intro": "Profil belajar Anda — terus berkembang setelah setiap interaksi.",
  "twin.loading": "Membaca Digital Twin Anda…",
  "twin.notEnough": "Belum cukup data",
  "twin.progress": "Progres keseluruhan",
  "twin.conceptsTracked": "konsep dilacak",
  "twin.lessons": "pelajaran",
  "twin.evolves": "Belajar secara terus-menerus",
  "twin.interactions": "interaksi sejauh ini",
  "twin.level": "Level sebenarnya",
  "twin.speed": "Kecepatan belajar",
  "twin.subjects": "Subjek favorit",
  "twin.style": "Gaya belajar",
  "twin.depth": "Kedalaman penjelasan",
  "twin.language": "Bahasa pilihan",
  "twin.rhythm": "Rhythm kerja",
  "twin.focus": "Jam fokus",
  "twin.band.new": "Baru mulai",
  "twin.band.weak": "Rentan",
  "twin.band.building": "Membangun",
  "twin.band.strong": "Kuat",
  "twin.speed.building": "Membangun",
  "twin.speed.steady": "Stabil",
  "twin.speed.fast": "Cepat",
  "twin.style.voice": "Lisan",
  "twin.style.handsOn": "Praktik langsung",
  "twin.style.reading": "Membaca",
  "twin.depth.simple": "Sederhana, bertahap",
  "twin.depth.balanced": "Seimbang",
  "twin.depth.deep": "Mendalam",
  "twin.rhythm.occasional": "Jarang",
  "twin.rhythm.regular": "Rutin",
  "twin.rhythm.intensive": "Intensif",
  "twin.focus.morning": "Pagi",
  "twin.focus.afternoon": "Siang",
  "twin.focus.evening": "Sore",
  "twin.focus.night": "Malam",
  "memory.title": "Memori Belajar",
  "memory.intro": "Semua yang telah Anda lakukan — sehingga AI tidak pernah mulai dari nol.",
  "memory.loading": "Membuka memori belajar Anda…",
  "memory.remembered": "memori diingat",
  "memory.timeline": "Linimasa",
  "memory.empty": "Belum ada yang diingat — mulai pelajaran dan itu akan muncul di sini.",
  "memory.exercises": "Latihan",
  "memory.successes": "Keberhasilan",
  "memory.errors": "Kesalahan",
  "memory.revisions": "Pengulangan",
  "memory.conversations": "Percakapan",
  "memory.homework": "Pekerjaan Rumah",
  "memory.reports": "Laporan",
  "memory.documents": "Dokumen",
  "memory.k.lesson": "Pelajaran",
  "memory.k.success": "Berhasil",
  "memory.k.error": "Kesalahan",
  "memory.k.revision": "Pengulangan",
  "memory.k.conversation": "Percakapan",
  "memory.k.homework": "Pekerjaan Rumah",
  "memory.k.report": "Laporan sesi",
  "memory.k.document": "Dokumen",
  "mastery.title": "Penguasaan Konsep",
  "mastery.intro": "Setiap konsep mendapat skor — yang paling mendesak diulang lebih dulu.",
  "mastery.loading": "Menilai konsep Anda…",
  "mastery.empty": "Belum ada konsep — pelajari pelajaran yang terikat pada konsep untuk melihat skornya.",
  "mastery.mastery": "Penguasaan",
  "mastery.confidence": "Kepercayaan diri",
  "mastery.errors": "Kesalahan",
  "mastery.forgetting": "Kelupaan",
  "mastery.priority": "Prioritas pengulangan",
  "mastery.conf.low": "Rendah",
  "mastery.conf.medium": "Sedang",
  "mastery.conf.high": "Tinggi",
  "mastery.err.none": "Tidak ada",
  "mastery.err.low": "Jarang",
  "mastery.err.high": "Sering",
  "mastery.prio.low": "Rendah",
  "mastery.prio.medium": "Sedang",
  "mastery.prio.high": "Tinggi",
  "mastery.prio.urgent": "Mendesak",
  "graph.title": "Graf Pengetahuan",
  "graph.intro": "Bagaimana konsep Anda saling bergantung — fondasi didahulukan.",
  "graph.loading": "Memetakan konsep Anda…",
  "graph.empty": "Belum ada konsep — pelajari beberapa, lalu hubungkan untuk melihat grafiknya.",
  "graph.s.mastered": "Terkuasai",
  "graph.s.in_progress": "Sedang berlangsung",
  "graph.s.ready": "Siap",
  "graph.s.at_risk": "Berisiko",
  "graph.s.blocked": "Diblokir",
  "sw.title": "Kekuatan & kelemahan",
  "sw.intro": "Hal yang sudah Anda kuasai dan yang mulai menurun — AI merencanakan sesi Anda berikutnya berdasarkan ini.",
  "sw.loading": "Menimbang konsep Anda…",
  "sw.strengths": "Kekuatan",
  "sw.weaknesses": "Kelemahan",
  "sw.noStrengths": "Belum ada konsep yang dikuasai — teruskan!",
  "sw.noWeaknesses": "Tidak ada yang menurun saat ini. Kerja bagus!",
  "sw.aiNote": "AI akan memfokuskan sesi Anda berikutnya pada titik-titik lemah ini terlebih dahulu.",
  "sw.startWeakest": "▶ Kerjakan titik lemah saya",
  "rec.title": "Rekomendasi",
  "rec.intro": "Langkah selanjutnya dari mentor Anda — bukan sekadar analisis, tetapi apa yang harus dilakukan sekarang.",
  "rec.loading": "Memikirkan langkah Anda selanjutnya…",
  "rec.empty": "Belum ada yang direkomendasikan — belajar sedikit dan saya akan memandu Anda.",
  "rec.review": "Saya merekomendasikan {m} menit untuk merevisi {s}.",
  "rec.consolidate": "Konsolidasikan {s} sebelum mempelajari hal baru.",
  "rec.levelUp": "Anda telah menguasai {s} — siap untuk tingkat berikutnya.",
  "rec.advance": "Semuanya solid — Anda siap mempelajari sesuatu yang baru.",
  "rec.cta.review": "🔁 Tinjau sekarang",
  "rec.cta.consolidate": "🧱 Konsolidasikan",
  "rec.cta.levelUp": "🎓 Naik tingkat",
  "rec.cta.advance": "🚀 Pelajari sesuatu yang baru",
  "insight.title": "Wawasan AI",
  "insight.intro": "Alasan di balik saran AI — diambil dari aktivitas nyata Anda.",
  "insight.loading": "Membaca sinyal…",
  "insight.empty": "Aktivitas belum cukup — belajar sedikit dan wawasan akan muncul.",
  "insight.days": "hari",
  "insight.interactions": "interaksi",
  "insight.strengthA": "Anda berkembang pesat dalam",
  "insight.forgetA": "Anda cenderung lupa",
  "insight.forgetB": "setelah sekitar",
  "insight.atRiskA": "Anda mulai lupa",
  "insight.atRiskB": "— tinjau terlebih dahulu.",
  "insight.focusA": "Anda paling baik belajar antara",
  "insight.focusB": "dan",
  "insight.accA": "Anda menjawab",
  "insight.accB": "latihan Anda dengan benar.",
  "insight.rhythmA": "Anda telah bekerja",
  "insight.styleA": "Anda paling baik belajar dengan cara",
  "insight.rhythm.occasional": "sesekali",
  "insight.rhythm.regular": "secara teratur",
  "insight.rhythm.intensive": "secara intensif",
  "insight.style.voice": "mendengarkan",
  "insight.style.handsOn": "latihan",
  "insight.style.reading": "membaca",
  "tutor.discussion": "Diskusi",
  "tutor.opening": "Membuka diskusi…",
  "tutor.focusedOn": "Fokus pada",
  "tutor.placeholder": "Tanya guru Anda…",
  "tutor.send": "Kirim",
  "tutor.slower": "🐢 Lebih lambat",
  "tutor.faster": "🐇 Lebih cepat",
  "tutor.slowerMsg": "Bisakah Anda memperlambat dan menjelaskannya dengan lebih sederhana?",
  "tutor.stopSend": "Berhenti & kirim",
  "tutor.cancel": "Batal",
  "tutor.speak": "🎤 Bicara saja",
  "tutor.voiceUnsupported": "Suara memerlukan mikrofon — belum tersedia di build platform ini.",
  "tutor.recording": "Merekam… bicara, lalu berhenti.",
  "tutor.you": "Anda",
  "tutor.teacher": "Guru",
  "tutor.spoken": "🎤 lisan",
  "tutor.transcribing": "Mentranskrip, menjawab, and menulis pelajaran pada giliran ini meninggalkan…",
  "tutor.teacherSpeaking": "🔊 Guru sedang menjawab dengan suara nyaring…",
  "tutor.heard": "Terdengar:",
  "tutor.filedA": "— pelajaran tertulis",
  "tutor.filedInto": "telah disimpan ke dalam memori Anda dengan",
  "tutor.flashcards": "kartu hafalan",
  "tutor.groundedPre": "Berdasarkan pada",
  "tutor.groundedPassage": "bagian",
  "tutor.groundedPassages": "bagian",
  "tutor.groundedPost": "dari catatan Anda:",
  "header.lesson": "Pelajaran",
  "header.newLesson": "Pelajaran baru",
  "header.aiTeacher": "Guru AI",
  "header.teacher": "Guru",
  "header.homework": "Pekerjaan Rumah",
  "header.session": "Sesi belajar",
  "header.twin": "Digital Twin",
  "header.memory": "Learning Memory",
  "header.mastery": "ConceptMastery",
  "header.graph": "Knowledge Graph",
  "header.strengths": "Kekuatan & kelemahan",
  "header.insights": "Wawasan AI",
  "header.recommend": "Rekomendasi",
  "header.revEngine": "Revision Engine",
  "header.planner": "Perencana Belajar",
  "header.daily": "Sesi Harian",
  "header.calendar": "Kalender Cerdas",
  "header.predictions": "Revisi Prediktif",
  "header.notifications": "Notifikasi Cerdas",
  "header.adaptivePath": "Alur Adaptif",
  "header.goals": "Tujuan",
  "header.exams": "Ujian Mendatang",
  "header.library": "Perpustakaan",
  "header.document": "Dokumen",
  "header.ask": "Tanya perpustakaan saya",
  "header.resource": "Sumber belajar",
  "header.workspace": "Ruang Kerja Akademik",
  "lib.title": "Perpustakaan",
  "lib.tileDetail": "Perpustakaan Anda yang hidup dan diatur oleh AI",
  "lib.intro": "Setiap dokumen yang Anda tambahkan dipahami oleh AI: ringkasan, subjek, bahasa, konsep, dan tingkat kesulitan — semuanya otomatis.",
  "lib.loading": "Membuka perpustakaan Anda…",
  "lib.all": "Semua",
  "lib.favorites": "Favorit",
  "lib.recent": "Terbaru",
  "lib.shared": "Dibagikan",
  "lib.trash": "Sampah",
  "lib.subjects": "Subjek",
  "lib.languages": "Bahasa",
  "lib.collections": "Koleksi",
  "lib.empty": "Belum ada dokumen di sini.",
  "lib.sharedSoon": "Fitur berbagi akan hadir di tahap berikutnya — belum ada yang dibagikan.",
  "lib.analysing": "AI masih menganalisis dokumen ini…",
  "lib.pipelineRunning": "Pemrosesan otomatis…",
  "lib.stage.cleaning": "Membersihkan",
  "lib.stage.segmenting": "Mensegmentasi",
  "lib.stage.embedding": "Embedding",
  "lib.stage.indexing": "Mengindeks",
  "lib.stage.graphing": "Knowledge Graph",
  "lib.add": "＋ Tambah",
  "lib.scan": "Pindai",
  "lib.addText": "📝 Teks",
  "lib.addUrl": "🔗 URL",
  "lib.addTitle": "Judul",
  "lib.addBody": "Tempel catatan / teks Anda di sini…",
  "lib.addBtn": "Tambahkan ke pustaka",
  "lib.addFile": "📄 Impor file (PDF, txt, md)",
  "lib.addTextRequired": "Judul dan teks wajib diisi.",
  "lib.addUrlRequired": "URL wajib diisi.",
  "lib.diff.beginner": "Pemula",
  "lib.diff.intermediate": "Menengah",
  "lib.diff.advanced": "Mahir",
  "lib.status.pending": "Dalam antrean",
  "lib.status.processing": "Menganalisis",
  "lib.status.ready": "Siap",
  "lib.status.failed": "Gagal",
  "lib.summary": "Ringkasan AI",
  "lib.concepts": "Konsep terdeteksi",
  "lib.noConcepts": "Belum ada konsep terdeteksi — ketuk \"Deteksi konsep\".",
  "lib.content": "Konten",
  "lib.unknown": "Tidak terdeteksi",
  "lib.chars": "karakter",
  "lib.m.subject": "Subjek",
  "lib.m.language": "Bahasa",
  "lib.m.difficulty": "Tingkat Kesulitan",
  "lib.m.author": "Penulis",
  "lib.m.collection": "Koleksi",
  "lib.m.added": "Ditambahkan",
  "lib.m.size": "Ukuran",
  "lib.reanalyse": "🤖 Analisis ulang",
  "lib.detectConcepts": "🧩 Deteksi konsep",
  "lib.restore": "♻️ Pulihkan",
  "lib.moveToTrash": "🗑️ Pindahkan ke sampah",
  "lib.deleteForever": "Hapus permanen",
  "lib.askLibrary": "Tanya",
  "lib.askThisDoc": "❓ Tanya tentang dokumen ini",
  "lib.ask.title": "Tanya pustaka saya",
  "lib.ask.intro": "Ajukan pertanyaan — dijawab hanya dari dokumen Anda sendiri, dengan kutipan bagian sumber. Tanpa rekayasa.",
  "lib.ask.scope": "Cari di",
  "lib.ask.all": "Seluruh pustaka",
  "lib.ask.thisDoc": "Dokumen ini",
  "lib.ask.placeholder": "mis. Apa saja tahapan fotosintesis?",
  "lib.ask.btn": "Tanya",
  "lib.ask.answer": "Jawaban",
  "lib.ask.noContext": "Tidak ditemukan hal yang relevan dalam cakupan ini — coba pertanyaan lain atau peraslu cakupan.",
  "lib.ask.sources": "Sumber",
  "lib.u.title": "Pemahaman AI",
  "lib.u.summarize": "Ringkas",
  "lib.u.rephrase": "Parafrase",
  "lib.u.simplify": "Sederhanakan",
  "lib.u.explain": "Jelaskan",
  "lib.u.adapted": "Disesuaikan dengan tingkat Anda:",
  "lib.u.compareTitle": "Bandingkan",
  "lib.u.compare": "Bandingkan dengan dokumen lain",
  "lib.u.noOther": "Belum ada dokumen lain untuk dibandingkan.",
  "lib.u.prereqTitle": "Prasyarat",
  "lib.u.reviewFirst": "Tinjau ini sebelum mempelajari dokumen ini:",
  "lib.u.untracked": "tidak dilacak",
  "lib.level.new": "baru",
  "lib.level.beginner": "pemula",
  "lib.level.intermediate": "menengah",
  "lib.level.advanced": "lanjutan",
  "lib.r.title": "Sumber belajar",
  "lib.r.saved": "Sumber tersimpan",
  "lib.r.summary": "Ringkasan",
  "lib.r.revisionSheet": "Lembar revisi",
  "lib.r.flashcards": "Kartu memori",
  "lib.r.quiz": "Kuis",
  "lib.r.exercises": "Latihan",
  "lib.r.openQuestions": "Pertanyaan terbuka",
  "lib.r.coursePlan": "Rencana kursus",
  "lib.r.mindmap": "Peta pikiran (segera)",
  "lib.r.review": "🎴 Tinjau sekarang",
  "lib.workspace": "🎓 Academic Workspace",
  "ws.title": "Academic Workspace",
  "ws.analysing": "Guru sedang menganalisis pekerjaan ini…",
  "ws.analysisTitle": "Analisis",
  "ws.levelAdapted": "disesuaikan dengan:",
  "ws.objectives": "Tujuan",
  "ws.skills": "Keterampilan yang dievaluasi",
  "ws.prerequisites": "Prasyarat",
  "ws.successCriteria": "Kriteria keberhasilan",
  "ws.keyNotions": "Gagasan utama",
  "ws.likelyHard": "Kemungkinan sulit bagimu",
  "ws.chooseMode": "Pilih jenis pendampingan",
  "ws.mode.guide": "Panduan",
  "ws.mode.accompany": "Selesaikan bersama",
  "ws.mode.solve": "Solusi lengkap",
  "ws.thinking": "Guru sedang berpikir…",
  "ws.placeholder": "Tanya, jawab, atau bagikan usahamu…",
  "ws.send": "Kirim",
  "ws.finishTitle": "Ubah pekerjaan ini menjadi pembelajaran",
  "ws.finishHint": "Buat ringkasan, kartu memori, dan kuis dari pekerjaan ini — disimpan ke pustaka Anda dan dimasukkan ke dalam revisi Anda.",
  "ws.generate": "Buat sumber belajar",
  "ws.generated": "✅ Sumber berhasil dibuat dan disimpan — periksa sumber dokumen.",
  "lib.integ.title": "Integrasi otak",
  "lib.integ.summary": "Dokumen ini menambahkan {c} konsep, {ch} bagian memori, dan {e} tautan grafik ke otak Anda.",
  "lib.integ.new": "Konsep baru",
  "lib.integ.known": "Sudah diketahui (dari dokumen lain)",
  "lib.integ.mastered": "Sudah dikuasai",
  "lib.integ.fragile": "Masih rapuh",
  "lib.integ.prereq": "Prasyarat",
  "lib.integ.dependents": "Membangun ke arah",
  "lib.integ.links": "Terhubung ke pengetahuan yang ada",
  "goals.tileDetail": "Target harian, mingguan, dan bulanan",
  "goals.title": "Target",
  "goals.intro": "Apa yang ingin Anda capai? Atur target untuk hari ini, minggu ini, dan bulan ini.",
  "goals.placeholder": "mis. Selesaikan bab genetika",
  "goals.addBtn": "Tambah target",
  "goals.daily": "Harian",
  "goals.weekly": "Mingguan",
  "goals.monthly": "Bulanan",
  "goals.none": "Belum ada target.",
  "goals.loading": "Memuat target Anda…",
  "exams.tileDetail": "Subjek, tanggal, dan tingkat kesiapan",
  "exams.title": "Ujian Mendatang",
  "exams.intro": "Ujian Anda, diurutkan berdasarkan tanggal. Kesiapan diperkirakan dari penguasaan konsep Anda.",
  "exams.placeholder": "Subjek (mis. Genetika)",
  "exams.addBtn": "Tambah ujian",
  "exams.none": "Tidak ada ujian yang dijadwalkan.",
  "exams.loading": "Memuat ujian Anda…",
  "exams.prep": "Kesiapan",
  "exams.prepUnknown": "Belum cukup data",
  "exams.p.high": "Tinggi",
  "exams.p.medium": "Sedang",
  "exams.p.low": "Rendah",
  "exams.in3": "Dalam 3 hari",
  "exams.in7": "Dalam 1 minggu",
  "exams.in14": "Dalam 2 minggu",
  "exams.in30": "Dalam 1 bulan",
  "exams.past": "Terlewat",
  "exams.today": "Hari ini",
  "exams.tomorrow": "Besok",
  "exams.in": "dalam",
  "exams.days": "hari",
  "header.languages": "Bahasa",
  "header.language": "Bahasa",
  "header.scan": "Pindai kursus",
  "header.revision": "Revisi",
  "header.progress": "Progres",
  "header.health": "Kesehatan sistem",
  "verdict.correct": "benar",
  "verdict.partial": "sebagian",
  "verdict.incorrect": "salah",
  "rating.good": "baik",
  "rating.fair": "cukup",
  "rating.needs_work": "perlu peningkatan",
  "examiner.title": "📝 Penguji AI",
  "examiner.intro": "Guru menjadi penguji Anda — membuat penilaian, lalu memeriksanya dengan penjelasan dan saran. Nilainya tidak pernah sendirian.",
  "examiner.create": "Buat penilaian",
  "examiner.topicPlaceholder": "Topik — mis. Revolusi Prancis",
  "examiner.difficulty": "Kesulitan",
  "examiner.createTake": "Buat & kerjakan",
  "examiner.emptyTitle": "Belum ada penilaian",
  "examiner.emptyDetail": "Pilih jenis dan topik di atas — Pilihan ganda, pertanyaan terbuka, esai, latihan, studi kasus, simulasi ujian, atau evaluasi lisan.",
  "examiner.questionsCount": "{n} pertanyaan",
  "examiner.scored": "skor {n}/100",
  "examiner.notTaken": "belum dikerjakan",
  "examiner.review": "Tinjau",
  "examiner.take": "Kerjakan",
  "examiner.levelWord": "tingkat",
  "examiner.question": "Pertanyaan",
  "examiner.points": "{n} poin",
  "examiner.yourAnswer": "Jawaban Anda…",
  "examiner.why": "Alasan: ",
  "examiner.how": "Cara: ",
  "examiner.mistake": "Kesalahan: ",
  "examiner.avoid": "Hindari: ",
  "examiner.submit": "Kirim untuk dinilai",
  "examiner.next": "Langkah selanjutnya",
  "examiner.back": "Kembali ke penilaian",
  "examiner.t.mcq": "Pilihan ganda",
  "examiner.t.open": "Pertanyaan terbuka",
  "examiner.t.dissertation": "Esai",
  "examiner.t.exercise": "Latihan",
  "examiner.t.case_study": "Studi kasus",
  "examiner.t.mock_exam": "Simulasi ujian",
  "examiner.t.oral": "Evaluasi lisan",
  "writing.title": "✍️ Pelatih menulis",
  "writing.intro": "Kirimkan tulisan — guru menganalisis struktur, logika, kejelasan, ejaan, tata bahasa, argumentasi, dan kualitas akademik, lalu menjelaskan secara tepat cara meningkatkannya.",
  "writing.new": "Pengajuan baru",
  "writing.titlePlaceholder": "Judul (opsional)",
  "writing.briefPlaceholder": "Ringkasan / prompt yang dijawab (opsional)",
  "writing.textPlaceholder": "Tempel tulisan Anda di sini…",
  "writing.review": "Tinjau tulisan saya",
  "writing.emptyTitle": "Belum ada pengajuan",
  "writing.emptyDetail": "Tempel esai, laporan, disertasai, atau karya tulis apa pun di atas untuk mendapatkan ulasan yang lengkap dan terstruktur.",
  "writing.scored": "mendapatkan nilai {n}/100",
  "writing.open": "Buka ulasan",
  "writing.reviewTitle": "Ulasan tulisan",
  "writing.works": "Hal yang sudah baik",
  "writing.improve": "Cara meningkatkan: ",
  "writing.first": "Lakukan ini terlebih dahulu",
  "writing.back": "Kembali menulis",
  "writing.t.redaction": "Esai",
  "writing.t.dissertation": "Disertasi",
  "writing.t.memoire": "Tesis",
  "writing.t.rapport": "Laporan",
  "writing.t.compte_rendu": "Ringkasan",
  "writing.t.devoir": "Pekerjaan Rumah",
  "writing.d.structure": "Struktur",
  "writing.d.logic": "Logika",
  "writing.d.clarity": "Kejelasan",
  "writing.d.spelling": "Ejaan",
  "writing.d.grammar": "Tata bahasa",
  "writing.d.argumentation": "Argumentasi",
  "writing.d.academic_quality": "Kualitas akademik",
  "reading.title": "📖 Pelatih membaca",
  "reading.intro": "Dapatkan teks yang disesuaikan dengan level Anda beserta pertanyaan pemahaman. Pelatih akan menilai jawaban Anda dan menyesuaikan tingkat kesulitannya secara otomatis.",
  "reading.yourLevel": "Level membaca Anda",
  "reading.topicPlaceholder": "Topik (opsional) — mis. gunung berapi, ekonomi…",
  "reading.generate": "Buat teks",
  "reading.emptyTitle": "Belum ada teks",
  "reading.emptyDetail": "Buat teks pertama Anda di atas — levelnya akan menyesuaikan seiring berjalan.",
  "reading.scored": "mendapatkan nilai {n}/100",
  "reading.notTaken": "belum dikerjakan",
  "reading.review": "Ulasan",
  "reading.read": "Baca",
  "reading.levelWord": "level",
  "reading.question": "Pertanyaan",
  "reading.yourAnswer": "Jawaban Anda…",
  "reading.mistake": "Kesalahan: ",
  "reading.avoid": "Hindari ini: ",
  "reading.submit": "Kirim jawaban",
  "reading.back": "Kembali membaca",
  "reading.levelUp": "⬆ Naik level: {from} → {to}",
  "reading.levelDown": "⬇ Lebih mudah nanti: {from} → {to}",
  "reading.levelHeld": "Level tetap di {to}",
  "reading.lvl.beginner": "pemula",
  "reading.lvl.intermediate": "menengah",
  "reading.lvl.advanced": "lanjutan",
  "reading.lvl.expert": "ahli",
  "lang.learnTitle": "Belajar bahasa",
  "lang.langPlaceholder": "Bahasa (mis. Spanyol)",
  "lang.nativePlaceholder": "Bahasa ibu Anda (untuk terjemahan)",
  "lang.teachingMode": "Mode pengajaran",
  "lang.start": "Mulai",
  "lang.noLangsTitle": "Belum ada bahasa",
  "lang.noLangsDetail": "Guru Anda akan memasukkan kosakata ke dalam antrean revisi normal Anda, menjalankan percakapan imersif, dan menilai seberapa baik Anda dipahami saat membaca dengan lantang.",
  "lang.fromNative": "dari {native}",
  "lang.open": "Buka",
  "lang.metaWords": "kata",
  "lang.metaDue": "jatuh tempo",
  "lang.metaLessons": "pelajaran",
  "lang.immersionBadge": "🌊 Imersi · ~{pct}% {lang}",
  "lang.immersionHelp": "Gurumu tetap menggunakan {lang}, memformulasi ulang dan menjelaskan secara singkat jika kamu bingung, lalu kembali ke {lang} — dan akan lebih banyak berbicara dalam {lang} seiring meningkatnya level CEFR kamu.",
  "lang.skills": "Tata bahasa, konjugasi & pemahaman",
  "lang.skillsHelp": "Disesuaikan dengan level CEFR kamu ({level}). Biarkan kotak kosong jika ingin guru yang memilih, atau sebutkan topik/kata kerja.",
  "lang.skillPlaceholder": "Topik atau kata kerja (opsional) — mis. past tense, être",
  "lang.grammar": "📖 Tata bahasa",
  "lang.conjugation": "🔤 Konjugasi",
  "lang.comprehension": "📝 Pemahaman",
  "lang.listen": "🔊 Dengarkan (pemahaman lisan)",
  "lang.conversation": "Percakapan",
  "lang.conversationHelp": "Latihan berjalan di layar diskusi normalmu — guru akan tetap dalam perannya, dan dalam mode imersi tidak akan pernah keluar dari bahasa target.",
  "lang.scenarioConvo": "Skenario (opsional) — mis. di apotek",
  "lang.startTalking": "Mulai berbicara",
  "lang.vocabulary": "Kosakata",
  "lang.vocabularyHelp": "Tempel apa pun yang sedang kamu baca. Kata-kata akan menjadi kartu FSRS biasa, sehingga akan muncul di antrean revisi bersama materi lainnya.",
  "lang.vocabPlaceholder": "Tempel teks dalam bahasa targetmu…",
  "lang.mineVocab": "Gali kosakata",
  "lang.vocabResult": "{n} kata baru ditambahkan ke antrean revisimu{had}.",
  "lang.vocabHad": " ({n} sudah kamu miliki)",
  "lang.lesson": "Pelajaran",
  "lang.lessonPlaceholder": "Apa yang harus kita bahas? mis. memesan makanan",
  "lang.writeLesson": "Buatkan aku pelajaran",
  "lang.sayOutLoud": "Ucapkan dengan lantang",
  "lang.sayHelp": "Ini mengukur apakah ucapanmu DIKENALI sebagai frasa tersebut — uji nyata untuk memastikan kamu dipahami, bukan skor aksen.",
  "lang.phrasePlaceholder": "Frasa untuk dibaca dengan lantang",
  "lang.needsMic": "Memerlukan mikrofon — khusus versi web untuk saat ini.",
  "lang.stopScore": "Berhenti & nilai",
  "lang.record": "🎤 Rekam",
  "lang.understoodPct": "{pct}% kata berhasil dipahami",
  "lang.heard": "Terdengar: “{text}”",
  "lang.pronCoach": "Pelatih pelafalan",
  "lang.pronCoachHelp": "Bebas berbicara — guru akan mendengarkan dan melatih pelafalan, aksen, ritme, kelancaran, dan intonasi kamu. Tujuannya adalah agar dipahami, bukan kesempurnaan.",
  "lang.coachContextPlaceholder": "Apa yang ingin kamu bicarakan? (opsional) — mis. perkenalkan dirimu",
  "lang.stopCoaching": "⏹ Berhenti & dapatkan pelatihan",
  "lang.speakFreely": "🎙️ Bebas berbicara",
  "lang.whyMatters": "Mengapa ini penting",
  "lang.howImprove": "Cara meningkatkan",
  "lang.coachExercises": "Latihan",
  "lang.d.pronunciation": "pelafalan",
  "lang.d.accent": "aksen",
  "lang.d.rhythm": "ritme",
  "lang.d.fluency": "kelancaran",
  "lang.d.intonation": "intonasi",
  "langmode.beginner": "pemula",
  "langmode.intermediate": "menengah",
  "langmode.advanced": "lanjutan",
  "langmode.academic": "akademik",
  "langmode.professional": "profesional",
  "langmode.exam_prep": "persiapan ujian",
  "langmode.immersion": "imersi",
  "strategy.socratic": "Metode Sokratik",
  "strategy.project_based": "Berbasis proyek",
  "strategy.problem_solving": "Pemecahan masalah",
  "strategy.case_study": "Studi kasus",
  "strategy.task_based": "Berbasis tugas",
  "strategy.guided_demonstration": "Demonstrasi terpandu",
  "strategy.active_learning": "Pembelajaran aktif",
  "strategy.experiential": "Experiential",
  "common.backToday": "Kembali ke hari ini",
  "health.title": "Kesehatan Sistem",
  "health.unreachable": "Tidak dapat dijangkau",
  "health.allOk": "Semua sistem beroperasi",
  "health.degraded": "Menurun",
  "health.up": "aktif",
  "health.down": "mati",
  "health.refresh": "Muat ulang",
  "revision.loading": "Memuat antrean Anda…",
  "revision.queueCleared": "Antrean dibersihkan",
  "revision.nothingDue": "Tidak ada yang jatuh tempo saat ini",
  "revision.clearedDetail": "Anda telah mereview {n} kartu. Revisi berikutnya sudah dijadwalkan pada saat Anda paling mungkin lupa.",
  "revision.nothingDetail": "FSRS menjadwalkan setiap kartu tepat sebelum Anda melupakannya. Kembalilah saat ada yang jatuh tempo.",
  "revision.counter": "{i} dari {total} · {done} selesai",
  "revision.tapReveal": "Ketuk untuk membuka",
  "revision.reveal": "Buka jawaban",
  "revision.again": "Lagi",
  "revision.hard": "Sulit",
  "revision.good": "Bagus",
  "revision.easy": "Mudah",
  "lessonNew.writing": "Menulis pelajaran Anda",
  "lessonNew.detail": "Guru Anda sedang menulis pelajaran lengkap, membuat latihan dan kartu flash, serta memasukkannya ke dalam memori jangka panjang Anda. Ini memerlukan waktu sebentar.",
  "scan.title": "Pindai kursus Anda",
  "scan.help": "Foto sebuah halaman, papan tulis, atau catatan tulisan tangan Anda. Guru Anda akan membacanya, mempertahankan bahasa asli, dan memasukkannya ke dalam memori jangka panjang Anda — hingga {max} halaman sekaligus.",
  "scan.takePhoto": "📷 Ambil foto",
  "scan.chooseImages": "Pilih gambar",
  "scan.pagesReady": "{n} halaman siap",
  "scan.remove": "Hapus",
  "scan.titlePlaceholder": "Judul (opsional — jika tidak, diambil dari halaman)",
  "scan.readPages": "Baca halaman ini",
  "scan.reading": "Membaca halaman Anda… ini memerlukan waktu sebentar.",
  "scan.scanAnother": "Pindai yang lain",
  "scan.filed": "Dimasukkan ke memori Anda",
  "scan.filedDetail": "{n} karakter dibaca. Sedang diindeks — setelah siap, ini dapat dicari, dan guru Anda dapat membuat pelajaran darinya.",
  "scan.cameraRefused": "Akses kamera ditolak. Izinkan kamera dan coba lagi.",
  "progress.currentStreak": "Seri saat ini",
  "progress.longest": "Terpanjang",
  "progress.activeDays": "Hari aktif",
  "progress.days": "hari",
  "progress.yourNumbers": "Statistik Anda",
  "progress.cardsReviewed": "Kartu yang direview",
  "progress.retention": "Retensi",
  "progress.noReviews": "belum ada review",
  "progress.dueNow": "Jatuh tempo sekarang",
  "progress.conceptsMastered": "Konsep dikuasai",
  "progress.atRisk": "Konsep berisiko",
  "progress.lessonsCompleted": "Pelajaran selesai",
  "progress.exercisesCorrect": "Latihan benar",
  "progress.milestones": "Pencapaian",
  "progress.askMentor": "Tanya mentor Anda",
  "sub.tileDetail": "Paket Anda dan paket yang tersedia.",
  "sub.title": "Langganan",
  "sub.intro": "Paket Anda saat ini dan semua yang ditawarkan. Batasan dan manfaat per paket sedang ditentukan — harga dan pembayaran segera hadir.",
  "sub.current": "Paket saat ini",
  "sub.currentPlan": "Paket saat ini",
  "sub.choose": "Pilih",
  "sub.pricingSoon": "Harga segera hadir",
  "sub.note": "Langganan dapat diubah dengan bebas untuk saat ini — pembayaran dan batas per paket akan hadir pada pembaruan mendatang.",
  "sub.status.active": "Aktif",
  "sub.status.trialing": "Uji coba",
  "sub.status.past_due": "Terlambat bayar",
  "sub.status.canceled": "Dibatalkan",
  "sub.status.incomplete": "Belum lengkap",
  "sub.audience.individual": "Individu",
  "sub.audience.organization": "Organisasi",
  "sub.cancel": "Batalkan langganan",
  "sub.willCancel": "batal pada akhir periode",
  "sub.invoices": "Faktur",
  "sub.noInvoices": "Belum ada faktur.",
  "profile.usage": "Penggunaan & kuota",
  "usage.tileDetail": "Jumlah batas langganan yang telah Anda gunakan.",
  "usage.title": "Penggunaan & kuota",
  "usage.intro": "Penggunaan Anda pada periode ini terhadap batas langganan.",
  "usage.note": "Batas bergantung pada langganan Anda dan disetel ulang setiap periode.",
  "usage.unlimited": "Tanpa batas",
  "usage.gb": "GB",
  "usage.min": "men",
  "usage.metric.documents": "Dokumen",
  "usage.metric.storage": "Penyimpanan",
  "usage.metric.ai_questions": "Pertanyaan AI",
  "usage.metric.voice_minutes": "Menit suara",
  "profile.orgs": "Organisasi",
  "org.tileDetail": "Sekolah, universitas, dan tim tempat Anda bergabung.",
  "org.title": "Organisasi",
  "org.intro": "Sekolah, universitas, pusat pelatihan, dan perusahaan tempat Anda bergabung.",
  "org.create": "Buat organisasi",
  "org.createBtn": "Buat",
  "org.namePlaceholder": "Nama — cth. SMA Negeri 1",
  "org.type.school": "Sekolah",
  "org.type.university": "Universitas",
  "org.type.training_center": "Pusat pelatihan",
  "org.type.enterprise": "Perusahaan",
  "org.role.admin": "Admin",
  "org.role.teacher": "Guru",
  "org.role.student": "Siswa",
  "org.memberCount": "{n} anggota",
  "org.open": "Buka",
  "org.emptyTitle": "Belum ada organisasi",
  "org.emptyDetail": "Buat di atas, atau minta admin untuk memasukkan Anda ke organisasi mereka.",
  "org.members": "Anggota",
  "org.addMember": "Tambah anggota",
  "org.addMemberBtn": "Tambah anggota",
  "org.emailPlaceholder": "Email anggota",
  "org.groups": "Kelas & grup",
  "org.noGroups": "Belum ada kelas atau grup.",
  "org.createGroup": "Buat kelas",
  "org.createGroupBtn": "Buat kelas",
  "org.groupNamePlaceholder": "Nama kelas — cth. Kelas 12 – IPA",
  "org.kind.class": "Kelas",
  "org.kind.group": "Grup",
  "org.back": "Kembali ke organisasi",
  "org.insights": "🌐 Wawasan penyewa",
  "org.insightsMembers": "{s} siswa · {t} guru",
  "org.insightsActive": "{n} aktif minggu ini",
  "org.difficultSubjects": "Mata pelajaran tersulit",
  "org.recommendations": "Rekomendasi",
  "profile.admin": "Dasbor admin",
  "admin.tileDetail": "Back office platform (hanya admin).",
  "admin.title": "Dashboard admin",
  "admin.intro": "Ikhtisar platform untuk semua pengguna dan organisasi.",
  "admin.stat.users": "Pengguna",
  "admin.stat.orgs": "Organisasi",
  "admin.stat.docs": "Dokumen",
  "admin.stat.revenue": "Pendapatan",
  "admin.stat.incidents": "Insiden terbuka",
  "admin.stat.reports": "Laporan terbuka",
  "admin.aiUsage": "Penggunaan AI",
  "admin.aiQuestions": "Pertanyaan AI",
  "admin.voiceMinutes": "Menit suara",
  "admin.users": "Pengguna",
  "admin.suspend": "Tangguhkan",
  "admin.reactivate": "Aktifkan kembali",
  "admin.suspended": "ditangguhkan",
  "admin.incidents": "Insiden",
  "admin.incidentPlaceholder": "Judul insiden",
  "admin.createIncident": "Buat insiden",
  "admin.resolve": "Selesaikan",
  "admin.sev.low": "Rendah",
  "admin.sev.medium": "Sedang",
  "admin.sev.high": "Tinggi",
  "admin.sev.critical": "Kritis",
  "admin.istatus.open": "Terbuka",
  "admin.istatus.investigating": "Sedang diselidiki",
  "admin.istatus.resolved": "Diselesaikan",
  "admin.reports": "Laporan",
  "admin.noReports": "Tidak ada laporan.",
  "admin.review": "Tandai ditinjau",
  "admin.rstatus.open": "Terbuka",
  "admin.rstatus.reviewed": "Ditinjau",
  "admin.rstatus.dismissed": "Ditolak",
  "admin.logs": "Log audit",
  "profile.analytics": "Analitik",
  "an.tileDetail": "Business intelligence platform (hanya admin).",
  "an.title": "Analitik",
  "an.intro": "Indikator platform untuk memandu perbaikan berkelanjutan.",
  "an.active": "Pengguna aktif",
  "an.stickiness": "Keterikatan",
  "an.retention": "Retensi 7 hari",
  "an.newUsers": "Baru (7h)",
  "an.business": "Bisnis",
  "an.revenue": "Pendapatan",
  "an.conversion": "Konversi",
  "an.paid": "Pengguna berbayar",
  "an.learning": "Pembelajaran & AI",
  "an.studyTime": "Waktu belajar",
  "an.mastery": "Penguasaan rata-rata",
  "an.lessons": "Pelajaran",
  "an.aiQuestions": "Pertanyaan AI",
  "an.voiceMinutes": "Menit suara",
  "an.topFeatures": "Fitur yang paling sering digunakan",
  "an.feature.tutor": "AI Teacher",
  "an.feature.lessons": "Pelajaran",
  "an.feature.assessments": "Penilaian",
  "an.feature.writing": "Menulis",
  "an.feature.reading": "Membaca",
  "an.feature.documents": "Dokumen",
  "an.feature.languages": "Bahasa",
  "profile.privacy": "Privasi & data",
  "priv.tileDetail": "Persetujuan, ekspor data, dan penghapusan akun.",
  "priv.title": "Privasi & data",
  "priv.intro": "Kelola persetujuan Anda, ekspor data, atau hapus akun Anda.",
  "priv.consents": "Persetujuan",
  "priv.consent.analytics": "Analisis produk",
  "priv.consent.marketing": "Komunikasi pemasaran",
  "priv.consent.product_emails": "Email pembaruan produk",
  "priv.granted": "Diberikan",
  "priv.notGranted": "Tidak diberikan",
  "priv.grant": "Berikan",
  "priv.withdraw": "Tarik kembali",
  "priv.export": "Ekspor data Anda",
  "priv.exportHelp": "Unduh semua informasi tentang Anda yang kami simpan sebagai file JSON.",
  "priv.exportBtn": "Ekspor data saya",
  "priv.exportDone": "Ekspor data Anda telah diunduh.",
  "priv.exportReady": "Ekspor data Anda sudah siap.",
  "priv.danger": "Zona bahaya",
  "priv.deleteHelp": "Hapus akun Anda dan semua data secara permanen. Tindakan ini tidak dapat dibatalkan.",
  "priv.deleteBtn": "Hapus akun saya",
  "priv.passwordPlaceholder": "Konfirmasi dengan kata sandi Anda",
  "priv.cancel": "Batal",
  "priv.confirmDelete": "Hapus selamanya",
  "h.hero.analyzed": "Saya telah menganalisis kemajuan Anda dan menyiapkan hari Anda.",
  "h.ctx.new": "Selamat datang. Mari buat jalur belajar pertama Anda.",
  "h.ctx.active": "Saya telah menyiapkan sesi hari ini.",
  "h.ctx.exam": "Ujian Anda sudah dekat — saya telah menyesuaikan program Anda.",
  "h.ctx.revision": "Beberapa konsep berisiko terlupakan hari ini.",
  "h.ctx.success": "Anda baru saja memperkuat konsep penting.",
  "h.ctx.inactive": "Sudah beberapa hari berlalu — mari mulai kembali secara perlahan.",
  "h.hero.start": "Mulai sesi saya",
  "h.hero.detail": "Lihat detail",
  "h.hero.activities": "aktivitas",
  "h.hero.min": "menit",
  "h.hero.priorityHigh": "prioritas tinggi",
  "h.nba.title": "Tindakan selanjutnya",
  "h.nba.priority": "PRIORITAS",
  "h.nba.why": "Mengapa?",
  "h.nba.start": "Mulai",
  "h.nba.review": "Tinjau",
  "h.nba.learn": "Pelajari",
  "h.nba.r.at_risk": "Penguasaan Anda menurun — tinjauan singkat hari ini akan berdampak besar.",
  "h.nba.r.ready": "Prasyarat telah dikuasai — ini adalah langkah lanjutan yang ideal.",
  "h.nba.r.in_progress": "Anda sudah mempelajari ini — mari jaga momentumnya.",
  "h.nba.r.review": "Kartu harus ditinjau hari ini.",
  "h.nba.none": "Tidak ada yang mendesak — Anda sudah sinkron. Tinjauan singkat tetap membantu.",
  "h.capture.title": "Apa yang ingin Anda pelajari?",
  "h.capture.placeholder": "Jelaskan turunan… / ajukan pertanyaan",
  "h.capture.write": "Tulis",
  "h.capture.speak": "Bicara",
  "h.capture.drop": "Jatuhkan",
  "h.capture.scan": "Pindai",
  "h.capture.import": "Impor",
  "h.proactive.badge": "RENCANA YANG DISESUAIKAN",
  "h.today.title": "Hari ini",
  "h.today.none": "Tidak ada rencana hari ini.",
  "h.today.summary": "{min} mnt · {n} aktivitas",
  "h.st.done": "selesai",
  "h.st.in_progress": "sedang berjalan",
  "h.st.pending": "harus dilakukan",
  "h.st.skipped": "ditunda",
  "h.continue.title": "Lanjutkan",
  "h.continue.reached": "Anda telah mencapai:",
  "h.continue.btn": "Lanjutkan",
  "h.progress.week": "Minggu ini",
  "h.progress.reviews": "Ulasan",
  "h.progress.streak": "hari berturut-turut",
  "h.mastery.title": "Penguasaan",
  "h.mastery.none": "Belum ada konsep yang dilacak.",
  "h.exams.title": "Ujian mendatang",
  "h.exams.prep": "Persiapan",
  "h.exams.none": "Tidak ada ujian mendatang.",
  "h.exams.hint": "Anda dapat menambahkan ujian kapan pun diperlukan.",
  "h.exams.plan": "Lihat jadwal",
  "h.exams.inDays": "dalam {n} hari",
  "h.exams.today": "hari ini",
  "h.exams.tomorrow": "besok",
  "h.recs.title": "Saran dari pengajar Anda",
  "h.recs.none": "Tidak ada saran saat ini.",
  "h.recs.act": "Mulai",
  "h.capacity.title": "Kapasitas hari ini",
  "h.capacity.recommended": "Disarankan {n} menit",
  "h.streak.title": "Konsistensi",
  "h.streak.days": "hari",
  "h.block.error": "Tidak dapat memuat blok ini.",
  "h.block.retry": "Coba lagi",
  "h.open": "Buka",
  "error.title": "Terjadi kesalahan",
  "error.detail": "Layar ini mengalami kendala. Anda dapat mencoba lagi.",
  "learn.section.modes": "Bagaimana Anda ingin belajar?",
  "study.section.cards": "Smart Cards",
  "onboarding.preparing": "Menyiapkan ruang Anda…",
  "onboarding.gen.title": "Membuat otak digital Anda…",
  "onboarding.gen.analyzing": "Menganalisis profil Anda…",
  "onboarding.gen.graph": "Membangun peta pengetahuan Anda…",
  "onboarding.gen.teacher": "Personalisasi Profesor AI Anda…",
  "onboarding.gen.forming": "Otak digital Anda mulai terbentuk…",
  "profile.manageSubscription": "Kelola langganan saya",
  "onb.progress": "Ruang belajarmu mulai terbentuk…",
  "onb.why": "Kenapa aku menanyakan ini?",
  "onb.continue": "Lanjutkan",
  "onb.back": "Kembali",
  "onb.skip": "Lewati",
  "onb.cat.kindergarten": "TK",
  "onb.cat.primary": "SD",
  "onb.cat.secondary": "SMP",
  "onb.cat.highschool": "SMA",
  "onb.cat.university": "Universitas",
  "onb.cat.research": "Riset / S3",
  "onb.cat.professional": "Pelatihan profesional",
  "onb.cat.language": "Belajar bahasa",
  "onb.cat.personal": "Pembelajaran pribadi",
  "onb.age.under12": "Di bawah 12",
  "onb.age.12to15": "12–15",
  "onb.age.16to18": "16–18",
  "onb.age.18to25": "18–25",
  "onb.age.25to40": "25–40",
  "onb.age.over40": "40 ke atas",
  "onb.goal.understand": "Memahami kursus saya",
  "onb.goal.exams": "Lulus ujian saya",
  "onb.goal.grades": "Meningkatkan nilai saya",
  "onb.goal.language": "Belajar bahasa",
  "onb.goal.contest": "Persiapan ujian kompetitif",
  "onb.goal.homework": "Mengerjakan PR",
  "onb.goal.labs": "Menyelesaikan kerja lab",
  "onb.goal.reports": "Menulis laporan",
  "onb.goal.projects": "Mengerjakan proyek saya",
  "onb.goal.research": "Melakukan riset",
  "onb.goal.skills": "Membangun keterampilan saya",
  "onb.goal.curiosity": "Belajar karena penasaran",
  "onb.subj.math": "Matematika",
  "onb.subj.physics": "Fisika",
  "onb.subj.chemistry": "Kimia",
  "onb.subj.biology": "Biologi",
  "onb.subj.cs": "Ilmu komputer",
  "onb.subj.law": "Hukum",
  "onb.subj.economics": "Ekonomi",
  "onb.subj.history": "Sejarah",
  "onb.subj.geography": "Geografi",
  "onb.subj.languages": "Bahasa",
  "onb.subj.medicine": "Kedokteran",
  "onb.subj.philosophy": "Filosofi",
  "onb.pref.visual": "Penjelasan visual",
  "onb.pref.examples": "Contoh",
  "onb.pref.practice": "Praktik",
  "onb.pref.exercises": "Latihan",
  "onb.pref.conversation": "Percakapan",
  "onb.pref.reading": "Membaca",
  "onb.pref.listening": "Mendengarkan",
  "onb.pref.repetition": "Pengulangan",
  "onb.pref.problems": "Pemecahan masalah",
  "onb.tone.supportive": "Mendukung",
  "onb.tone.balanced": "Seimbang",
  "onb.tone.demanding": "Menuntut",
  "onb.expl.short": "Singkat",
  "onb.expl.balanced": "Seimbang",
  "onb.expl.detailed": "Detail",
  "onb.interv.let_me_think": "Biarkan aku berpikir",
  "onb.interv.guide_me": "Pandu saya langkah demi langkah",
  "onb.interv.interactive": "Sangat interaktif",
  "onb.corr.immediate": "Koreksi langsung",
  "onb.corr.let_me_finish": "Biarkan saya selesai dulu",
  "onb.corr.adaptive": "Sesuaikan dengan situasi",
  "onb.sup.guide": "Pandu saya",
  "onb.sup.understand": "Bantu saya memahami",
  "onb.sup.step_by_step": "Tuntun saya langkah demi langkah",
  "onb.sup.verify": "Periksa penalaran saya",
  "onb.sup.solution": "Tunjukkan solusi beserta penjelasannya",
  "onb.skill.comprehension": "Pemahaman",
  "onb.skill.speaking": "Berbicara",
  "onb.skill.pronunciation": "Pelafalan",
  "onb.skill.writing": "Menulis",
  "onb.skill.grammar": "Tata bahasa",
  "onb.skill.vocabulary": "Kosakata",
  "onb.rate.high": "Saya mengerti",
  "onb.rate.medium": "Rata-rata",
  "onb.rate.low": "Perlu ditingkatkan",
  "onb.welcome.title": "Selamat datang di Second Brain.",
  "onb.welcome.start": "Mulai",
  "onb.welcome.body": "Mari bangun ruang belajarmu sesuai dengan cara belajarmu.",
  "onb.welcome.teacher": "Aku akan mengenalmu agar bisa menyesuaikan Profesor AI dengan tingkat, tujuan, and gaya belajarmu.",
  "onb.identity.teacher": "Mari berkenalan — hanya yang penting saja, tidak lebih.",
  "onb.identity.title": "Siapa kamu?",
  "onb.identity.firstName": "Nama depan",
  "onb.identity.firstNamePh": "Nama depanmu",
  "onb.identity.lastName": "Nama belakang (opsional)",
  "onb.identity.lastNamePh": "Nama belakangmu",
  "onb.identity.avatar": "Avatar (opsional)",
  "onb.identity.age": "Rentang usia",
  "onb.identity.ageWhy": "Rentang usia hanya digunakan untuk menyesuaikan nada dan penyajian. Tidak ada tanggal lahir yang diminta, dan pengalaman untuk pelajar muda tetap terlindungi.",
  "onb.identity.country": "Negara / wilayah (opsional)",
  "onb.identity.countryPh": "mis. Prancis",
  "onb.category.teacher": "Ini membantuku memahami posisimu dalam perjalananmu.",
  "onb.category.title": "Di mana posisi saat ini?",
  "onb.category.subtitle": "Pilih yang paling cocok untukmu.",
  "onb.academic.teacher": "Jelaskan studimu — pilih, cari, atau ketik secara bebas.",
  "onb.academic.title": "Studimu",
  "onb.academic.subtitle": "Tidak ada yang wajib: isi yang sesuai denganmu.",
  "onb.academic.level": "Tingkat",
  "onb.academic.levelPh": "mis. Universitas",
  "onb.academic.system": "Negara / sistem pendidikan",
  "onb.academic.systemPh": "mis. Prancis — LMD",
  "onb.academic.field": "Bidang",
  "onb.academic.fieldPh": "mis. Ilmu komputer",
  "onb.academic.domain": "Ranah",
  "onb.academic.domainPh": "mis. Rekayasa perangkat lunak",
  "onb.academic.specialty": "Spesialisasi (opsional)",
  "onb.academic.specialtyPh": "mis. Sistem terdistribusi",
  "onb.academic.year": "Tahun / tingkat",
  "onb.academic.yearPh": "mis. Tahun ke-3",
  "onb.goals.teacher": "Beri tahu aku alasanmu berada di sini — kamu dapat memilih beberapa.",
  "onb.goals.title": "Mengapa kamu menggunakan Second Brain?",
  "onb.subjects.teacher": "Subjek-subjek ini akan mengisi memori, grafik pengetahuan, and jadwalmu.",
  "onb.subjects.title": "Subjekmu",
  "onb.subjects.add": "Tambah subjek",
  "onb.subjects.addPh": "mis. Astrofisika",
  "onb.subjects.addBtn": "Tambah",
  "onb.languages.teacher": "Bahasa membentuk penjelasan and dukungan yang bisa ku berikan padamu.",
  "onb.languages.title": "Bahasamu",
  "onb.languages.native": "Bahasa ibu",
  "onb.languages.interface": "Bahasa antarmuka",
  "onb.languages.interfaceWhy": "Bahasa antarmuka mengubah tampilan and bahasa yang digunakan Profesor AI untuk mengajar.",
  "onb.languages.study": "Bahasa belajar (opsional)",
  "onb.languages.studyWhy": "Jika kamu belajar dalam bahasa selain bahasa ibu, aku akan mengaktifkan dukungan bilingual and kosakata akademik.",
  "onb.mobility.title": "Mobilitas internasional",
  "onb.mobility.subtitle": "Apakah kamu sedang belajar dalam bahasa yang berbeda dari bahasa ibumu?",
  "onb.mobility.yes": "Ya",
  "onb.mobility.no": "Tidak",
  "onb.mobility.alertTitle": "Dukungan bahasa diaktifkan",
  "onb.mobility.alertDetail": "Terjemahan kontekstual, kosakata akademik, penjelasan bilingual, and imersi bertahap.",
  "onb.ll.teacher": "Mari bangun perjalanan bahasamu, yang disesuaikan untukmu.",
  "onb.ll.title": "Belajar bahasa",
  "onb.ll.target": "Aku ingin belajar",
  "onb.ll.currentLevel": "Tingkat saat ini",
  "onb.ll.goalLevel": "Tujuan",
  "onb.ll.mainGoal": "Tujuan utama",
  "onb.ll.mainGoalPh": "mis. Percakapan",
  "onb.ll.skills": "Apa yang ingin Anda kerjakan",
  "onb.prefs.teacher": "Preferensi, bukan diagnosis. Anda dapat mengubahnya kapan saja.",
  "onb.prefs.title": "Bagaimana cara belajar yang Anda sukai?",
  "onb.teacher.teacher": "Atur saya. Saya kemudian akan beradaptasi berdasarkan hasil Anda.",
  "onb.teacher.title": "Profesor AI Anda",
  "onb.teacher.tone": "Nada",
  "onb.teacher.explanations": "Penjelasan",
  "onb.teacher.intervention": "Intervensi",
  "onb.teacher.correction": "Koreksi",
  "onb.support.teacher": "Praktikum, PR, laporan, proyek, disertasi — bagaimana Anda ingin saya membantu?",
  "onb.support.title": "Bantuan akademik",
  "onb.assess.teacher": "Mari lihat sekilas apa yang sudah Anda ketahui — beberapa pertanyaan, bukan ujian.",
  "onb.assess.title": "Pemeriksaan singkat",
  "onb.assess.save": "Simpan",
  "onb.assess.noSubjectTitle": "Tidak ada subjek yang dipilih",
  "onb.assess.noSubjectDetail": "Tambahkan subjek pada langkah sebelumnya untuk menjalankan pemeriksaan, atau lewati langkah ini.",
  "onb.assess.whichSubject": "Pada subjek apa?",
  "onb.assess.preparing": "Menyiapkan…",
  "onb.assess.run": "Mulai pemeriksaan",
  "onb.assess.unavailableTitle": "Pemeriksaan tidak tersedia",
  "onb.assess.unavailableDetail": "Anda dapat menilai sendiri level Anda di bawah ini.",
  "onb.assess.selfRate": "Nilai sendiri level Anda pada",
  "onb.assess.answerPh": "Jawaban Anda (opsional)",
  "onb.twin.title": "Inilah yang saya pahami tentang Anda",
  "onb.twin.subtitle": "Anda dapat langsung memperbaiki apa yang dipahami Second Brain.",
  "onb.twin.confirm": "Itu benar",
  "onb.twin.profile": "Profil",
  "onb.twin.langs": "Bahasa",
  "onb.twin.goals": "Tujuan",
  "onb.twin.subjects": "Subjek",
  "onb.twin.prof": "Profesor",
  "onb.twin.target": "Target",
  "onb.twin.native": "bahasa ibu",
  "onb.twin.study": "belajar",
  "onb.twin.hi": "Halo",
  "onb.twin.almost": "kita hampir sampai.",
  "onb.twin.toAdapt": "Untuk beradaptasi",
  "onb.adapt.title": "Beginilah cara Profesor AI Anda bekerja",
  "onb.adapt.enter": "Masuk ke Second Brain",
  "onb.adapt.preparing": "Menyiapkan…",
  "onb.adapt.willBody": "Saya akan:",
  "onb.adapt.p1": "menyesuaikan penjelasan saya dengan level Anda",
  "onb.adapt.p2": "mendeteksi kesulitan Anda",
  "onb.adapt.p3": "membuat Anda berlatih",
  "onb.adapt.p4": "merencanakan ulasan Anda",
  "onb.adapt.p5": "menggunakan dokumen Anda",
  "onb.adapt.p6": "membantu Anda dengan tugas Anda",
  "onb.edit": "Edit",
  "error.serverBusy": "Layanan sedang sibuk. Silakan coba sebentar lagi.",
  "error.network": "Masalah koneksi. Periksa jaringan Anda dan coba lagi.",
  "onb.cfg.title": "Konfigurasi diterapkan",
  "onb.cfg.profileUpdated": "Profil diperbarui",
  "onb.cfg.langCreated": "Profil bahasa dibuat",
  "onb.cfg.concepts": "konsep awal",
  "auth.brandTitle": "Otak Augmented AI Anda",
  "auth.brandSubtitle": "Belajar. Pahami. Ingat. Profesor AI Anda berkembang bersama Anda.",
  "auth.badgeLangs": "34 bahasa",
  "auth.badgeModels": "AI multi-model",
  "auth.badgeGraph": "Grafik Pengetahuan",
  "auth.sceneQuestion": "Jelaskan konsep ini kepada saya dengan sederhana.",
  "auth.sceneAnswer": "Tentu — ini dia, langkah demi langkah, sesuai tingkat pemahaman Anda.",
  "auth.sceneConcept": "Konsep",
  "auth.sceneRelation": "Relasi",
  "auth.sceneMastery": "Penguasaan",
  "auth.welcomeBack": "Selamat datang kembali",
  "auth.signUpSubtitle": "Beberapa detik untuk membangun ruang belajar Anda.",
  "auth.signInSubtitle": "Lanjutkan tepat di tempat terakhir Anda berhenti.",
  "auth.showPassword": "Tampilkan kata sandi",
  "auth.hidePassword": "Sembunyikan kata sandi",
  "auth.themeToggle": "Ganti tema",
  "auth.strengthLabel": "Kekuatan kata sandi",
  "auth.strengthWeak": "Lemah",
  "auth.strengthMedium": "Sedang",
  "auth.strengthStrong": "Kuat",
  "auth.emailFieldHint": "cth. anda@contoh.com",
  "auth.retry": "Coba lagi",
  "nav.expand": "Luaskan menu",
  "nav.collapse": "Ciutkan menu",
  "profile.kyc.title": "Profil saya",
  "profile.kyc.complete": "Selesai",
  "profile.kyc.incomplete": "Untuk menyelesaikan",
  "profile.kyc.detail": "Informasi yang mempersonalisasi Profesor AI dan Digital Twin Anda.",
  "profile.kyc.verify": "Tinjau profil saya",
  "profile.kyc.name": "Nama",
  "profile.kyc.path": "Jalur",
  "profile.kyc.languagesRow": "Bahasa",
  "profile.kyc.goalsRow": "Tujuan",
  "profile.kyc.goalsN": "tujuan",
  "profile.footer": "Perubahan Anda langsung memperbarui Profesor AI dan Digital Twin Anda di seluruh aplikasi.",
  "lib.learnWithTeacher": "Belajar dengan pengajar",
  "sub.popular": "Populer",
  "sub.perMonth": "/bln",
  "sub.free": "Gratis",
  "landing.brand": "Second Brain",
  "landing.signature": "Aktifkan Digital Twin Anda",
  "landing.nav.features": "Fitur",
  "landing.nav.how": "Cara kerjanya",
  "landing.nav.professor": "Profesor AI",
  "landing.nav.academic": "Ruang Kerja Akademik",
  "landing.nav.languages": "Bahasa",
  "landing.nav.faq": "FAQ",
  "landing.cta.signin": "Masuk",
  "landing.cta.start": "Mulai gratis",
  "landing.cta.startShort": "Mulai",
  "landing.cta.discover": "Lihat cara kerjanya",
  "landing.hero.title": "Twin Pembelajaran Digital Anda",
  "landing.hero.subtitle": "Profesor AI yang memahami perjalanan Anda, mengingat apa yang Anda pelajari, dan mengajar Anda secara khusus.",
  "landing.hero.promise1": "Belajar",
  "landing.hero.promise2": "Pahami",
  "landing.hero.promise3": "Hafalkan",
  "landing.hero.promise4": "Progres",
  "landing.hero.reassure1": "Profesor AI Adaptif",
  "landing.hero.reassure2": "Memori persisten",
  "landing.hero.reassure3": "34 bahasa",
  "landing.hero.reassure4": "Dokumen cerdas",
  "landing.mock.os": "SECOND BRAIN OS",
  "landing.mock.brain": "Otak Saya",
  "landing.mock.professor": "Profesor AI",
  "landing.mock.msg": "“Jelaskan konsep ini kepada saya…”",
  "landing.mock.memory": "Memori",
  "landing.mock.progress": "Progres",
  "landing.mock.mastery": "Penguasaan",
  "landing.signals.multipdf": "Multi-PDF",
  "landing.signals.fsrs": "FSRS",
  "landing.flow.documents": "Dokumen",
  "landing.flow.intelligence": "Kecerdasan",
  "landing.flow.graph": "Graf Pengetahuan",
  "landing.flow.professor": "Profesor AI",
  "landing.flow.twin": "Kembaran Digital",
  "landing.flow.revision": "Tinjauan & progres",
  "landing.compare.title": "Perubahannya",
  "landing.compare.message": "Second Brain tidak hanya menyimpan pengetahuan Anda. Ia belajar cara Anda belajar.",
  "landing.compare.classicTitle": "Aplikasi klasik",
  "landing.compare.sbTitle": "Second Brain OS",
  "landing.compare.classic1": "Dokumen terisolasi",
  "landing.compare.classic2": "Catatan statis",
  "landing.compare.classic3": "Pencarian dasar",
  "landing.compare.classic4": "Ringkasan",
  "landing.compare.classic5": "Riwayat yang tersebar",
  "landing.compare.sb1": "Memori pribadi",
  "landing.compare.sb2": "Profesor AI",
  "landing.compare.sb3": "Graf Pengetahuan",
  "landing.compare.sb4": "Pembelajaran adaptif",
  "landing.compare.sb5": "Ulasan cerdas",
  "landing.compare.sb6": "Progres berkelanjutan",
  "landing.compare.classicFlow": "Simpan → Cari → Baca",
  "landing.compare.sbFlow": "Tangkap → Pahami → Ajarkan → Hafalkan → Progres",
  "landing.how.title": "Cara kerjanya",
  "landing.how.s1.title": "Tangkap",
  "landing.how.s1.desc": "PDF, foto, pemindaian, catatan, dan konten pembelajaran apa pun.",
  "landing.how.s2.title": "Pahami",
  "landing.how.s2.desc": "Sistem menstrukturkan informasi dan mengidentifikasi konsep-konsepnya.",
  "landing.how.s3.title": "Ajarkan",
  "landing.how.s3.desc": "Profesor AI mengubah pengetahuan menjadi pengalaman mengajar.",
  "landing.how.s4.title": "Hafalkan",
  "landing.how.s4.desc": "Kembaran Digital Anda dan sistem ulasan melacak apa yang Anda serap.",
  "landing.how.s5.title": "Progres",
  "landing.how.s5.desc": "FSRS, asesmen, dan rekomendasi mengonsolidasikan pengetahuan Anda.",
  "landing.exp.title": "Satu konten → sebuah pengalaman belajar",
  "landing.exp.lead": "Tidak ada yang sekadar diimpor lalu dilupakan. Setiap dokumen menjadi sesuatu yang dapat Anda pelajari, latih, dan ingat.",
  "landing.exp.s1": "PDF",
  "landing.exp.s2": "Analisis",
  "landing.exp.s3": "Pahami",
  "landing.exp.s4": "Belajar dengan Profesor",
  "landing.exp.s5": "Pertanyaan",
  "landing.exp.s6": "Latihan",
  "landing.exp.s7": "Ulas",
  "landing.exp.s8": "Memori",
  "landing.exp.actionLearn": "Belajar bersama Profesor",
  "landing.exp.actionSolve": "Selesaikan bersama saya",
  "landing.showcase.title": "Satu produk, satu pengalaman",
  "landing.showcase.brain.tab": "🧠 Otak Saya",
  "landing.showcase.brain.title": "Otak Saya",
  "landing.showcase.brain.desc": "Digital Twin visual Anda: Knowledge Graph, Learning DNA, kekuatan, dan kelemahan dalam satu peta yang hidup.",
  "landing.showcase.professor.tab": "👨‍🏫 Profesor AI",
  "landing.showcase.professor.title": "Profesor AI",
  "landing.showcase.professor.desc": "Percakapan tertulis, pengajaran, dan pedagogi yang disesuaikan dengan tingkat dan tujuan Anda.",
  "landing.showcase.search.tab": "🔎 Pencarian Gratis",
  "landing.showcase.search.title": "Pencarian AI Gratis",
  "landing.showcase.search.desc": "Tanyakan apa saja — pertanyaan spontan, teknis, akademis, atau pengetahuan umum — di dalam pengalaman Belajar.",
  "landing.showcase.documents.tab": "📚 Dokumen Masif",
  "landing.showcase.documents.title": "Dokumen Masif",
  "landing.showcase.documents.desc": "PDF, foto, pindai, dan seluruh subjek dikelompokkan bersama — bekerja dengan satu kursus penuh, bukan hanya satu file.",
  "landing.showcase.voice.tab": "🎙️ Suara & Lisan",
  "landing.showcase.voice.title": "Suara & Lisan",
  "landing.showcase.voice.desc": "Percakapan lisan, latihan lisan, dan ujian lisan untuk berlatih bersuara.",
  "landing.showcase.academic.tab": "🎓 Ruang Kerja Akademik",
  "landing.showcase.academic.title": "Ruang Kerja Akademik",
  "landing.showcase.academic.desc": "Praktikum, PR, laporan, proyek, skripsi, esai, dan topik ujian — dibimbing langkah demi langkah.",
  "landing.showcase.revise.tab": "📅 Ulang",
  "landing.showcase.revise.title": "Ulang",
  "landing.showcase.revise.desc": "FSRS, kartu hafalan, kuis, dan progres yang mengunci apa yang Anda pelajari.",
  "landing.professor.title": "Seorang profesor yang mengenali siapa Anda",
  "landing.professor.lead": "Bukan chatbot generik — guru yang beradaptasi dengan level, tujuan, dan cara Anda belajar.",
  "landing.professor.a1": "Level",
  "landing.professor.a2": "Tujuan",
  "landing.professor.a3": "Kesulitan",
  "landing.professor.a4": "Riwayat belajar",
  "landing.professor.a5": "Bahasa",
  "landing.professor.a6": "Kurikulum",
  "landing.professor.a7": "Tempo",
  "landing.professor.a8": "Progres",
  "landing.professor.modesTitle": "Mode pengajaran",
  "landing.professor.m1": "Ajarkan",
  "landing.professor.m2": "Jelaskan",
  "landing.professor.m3": "Diskusikan",
  "landing.professor.m4": "Sesi terbimbing",
  "landing.professor.m5": "Latihan lisan",
  "landing.professor.m6": "Ujian lisan",
  "landing.professor.flow": "Pahami → berlatih → diuji → koreksi → hafalkan",
  "landing.academic.title": "Ruang Kerja Akademik",
  "landing.academic.badge": "Fitur dari ruang Belajar",
  "landing.academic.lead": "Tujuannya bukan sekadar memberi Anda jawaban — melainkan mengajarkan metodenya.",
  "landing.academic.w1": "Praktikum",
  "landing.academic.w2": "PR",
  "landing.academic.w3": "Laporan",
  "landing.academic.w4": "Proyek",
  "landing.academic.w5": "Skripsi",
  "landing.academic.w6": "Esai",
  "landing.academic.w7": "Studi kasus",
  "landing.academic.w8": "Latihan",
  "landing.academic.w9": "Topik ujian",
  "landing.academic.mode1.title": "Panduan pedagogis",
  "landing.academic.mode1.desc": "AI membimbing Anda langkah demi langkah.",
  "landing.academic.mode2.title": "Penyelesaian berbantuan",
  "landing.academic.mode2.desc": "Anda mengerjakannya bersama AI.",
  "landing.academic.mode3.title": "Solusi lengkap yang dijelaskan",
  "landing.academic.mode3.desc": "Solusi dijelaskan secara pedagogis, bukan sekadar diberikan.",
  "landing.languages.title": "Bahasa & Imersi",
  "landing.languages.lead": "Pelajari suatu bahasa, dan pahami bahasa dari kurikulum Anda sendiri.",
  "landing.languages.l1": "Imersi",
  "landing.languages.l2": "Percakapan",
  "landing.languages.l3": "Lisan",
  "landing.languages.l4": "Shadowing",
  "landing.languages.l5": "Progresi",
  "landing.languages.l6": "Kosakata",
  "landing.languages.l7": "Tata bahasa",
  "landing.languages.mobilityTitle": "Mobilitas akademik",
  "landing.languages.mob1": "Mahasiswa berbahasa Prancis",
  "landing.languages.mob2": "Universitas berbahasa Inggris",
  "landing.languages.mob3": "Terjemahan kontekstual",
  "landing.languages.mob4": "Kosakata akademik",
  "landing.languages.mob5": "Imersi progresif",
  "landing.kyc.title": "Sistem beradaptasi dengan pembelajar",
  "landing.kyc.lead": "Bukan formulir administratif — mesin adaptasi. Sistem ini menyesuaikan level, kosakata, nada, pedagogi, dan tingkat kesulitan untuk Anda.",
  "landing.kyc.p1.title": "Utama",
  "landing.kyc.p1.desc": "Pendekatan pengajaran visual yang sesuai dengan usia.",
  "landing.kyc.p2.title": "SMA / Universitas",
  "landing.kyc.p2.desc": "Metode terstruktur, ujian, dan konsolidasi.",
  "landing.kyc.p3.title": "Bidang khusus",
  "landing.kyc.p3.desc": "Kedokteran, hukum, ilmu komputer, teknik, arsitektur…",
  "landing.kyc.p4.title": "Peneliti",
  "landing.kyc.p4.desc": "Ketelitian ilmiah dan eksplorasi yang lebih mendalam.",
  "landing.kyc.p5.title": "Pembelajar bahasa",
  "landing.kyc.p5.desc": "Imersi dan progresi linguistik.",
  "landing.twin.title": "Pembelajaran Anda menjadi memori yang hidup",
  "landing.twin.lead": "Semakin banyak Anda belajar dengan Second Brain, semakin personal sistem Anda.",
  "landing.twin.i1": "Apa yang Anda pelajari",
  "landing.twin.i2": "Apa yang Anda pahami",
  "landing.twin.i3": "Apa yang Anda lupakan",
  "landing.twin.i4": "Apa yang Anda kuasai",
  "landing.twin.i5": "Tujuan Anda",
  "landing.twin.result": "Digital Twin",
  "landing.graph.title": "Knowledge Graph",
  "landing.graph.lead": "Peta interaktif dari hubungan antara segala hal yang Anda pelajari.",
  "landing.revision.title": "Ulasan cerdas",
  "landing.revision.message": "Jangan mengulang lebih banyak. Ulaslah pada saat yang tepat.",
  "landing.revision.lead": "FSRS adalah lapisan retensi untuk seluruh sistem Anda — bukan sekadar tumpukan flashcard.",
  "landing.revision.c1": "FSRS",
  "landing.revision.c2": "Pengulangan berjarak",
  "landing.revision.c3": "Flashcard",
  "landing.revision.c4": "Kuis",
  "landing.revision.c5": "Penilaian",
  "landing.revision.c6": "Progresi",
  "landing.one.title": "Satu pengalaman tunggal",
  "landing.one.s1": "Tangkap",
  "landing.one.s2": "Pahami",
  "landing.one.s3": "Ajarkan",
  "landing.one.s4": "Latih",
  "landing.one.s5": "Hafalkan",
  "landing.one.s6": "Ulas",
  "landing.one.s7": "Progres",
  "landing.faq.title": "Pertanyaan yang sering diajukan",
  "landing.faq.q1": "Apakah Second Brain hanya sekadar chatbot?",
  "landing.faq.a1": "Bukan. Ini adalah lingkungan pembelajaran pribadi: memahami konten Anda, mengajarkannya, dan mengingat kemajuan Anda seiring waktu.",
  "landing.faq.q2": "Bisakah saya bekerja dengan beberapa PDF dan dokumen?",
  "landing.faq.a2": "Ya. Anda dapat mengelompokkan PDF, foto, hasil pindai, dan catatan ke dalam satu subjek utuh dan belajar dari seluruh kumpulan, bukan hanya satu file.",
  "landing.faq.q3": "Apa yang dapat saya lakukan dengan AI Professor?",
  "landing.faq.a3": "Diajar, minta penjelasan, berdiskusi, jalankan sesi terpandu, dan berlatih dengan latihan — disesuaikan dengan level Anda.",
  "landing.faq.q4": "Bisakah saya berbicara dengan Profesor AI secara langsung?",
  "landing.faq.a4": "Ya. Percakapan lisan, latihan lisan, dan ujian lisan memungkinkan Anda berlatih bersuara.",
  "landing.faq.q5": "Apa itu Kembaran Digital?",
  "landing.faq.a5": "Memori personal tentang pembelajaran Anda — apa yang Anda pahami, kuasai, lupakan, dan tuju.",
  "landing.faq.q6": "Bagaimana cara kerja memori dan ulasan?",
  "landing.faq.a6": "Mesin pengulangan berjarak (FSRS) menjadwalkan ulasan pada saat yang tepat sehingga Anda lebih mengingat dengan sedikit usaha.",
  "landing.faq.q7": "Bisakah saya menggunakan Second Brain untuk pekerjaan akademis saya?",
  "landing.faq.a7": "Ya. Ruang Kerja Akademis memandu lab, pekerjaan rumah, laporan, dan banyak lagi — mengajarkan metode, bukan hanya jawaban.",
  "landing.faq.q8": "Bagaimana cara kerja pembelajaran bahasa?",
  "landing.faq.a8": "Imersi, percakapan, latihan lisan, dan shadowing — serta bantuan memahami bahasa dari kurikulum Anda sendiri.",
  "landing.faq.q9": "Bagaimana data saya dilindungi?",
  "landing.faq.a9": "Data pembelajaran Anda mendukung pengalaman Anda. Anda mengontrol akun Anda dan dapat mengelola data dari profil Anda.",
  "landing.pricing.title": "Pilih level pembelajaran Anda",
  "landing.pricing.subtitle": "Jelajahi → Belajar serius → Totalitas",
  "landing.pricing.billing.monthly": "Bulanan",
  "landing.pricing.billing.annual": "Tahunan",
  "landing.pricing.billing.saving": "Hemat",
  "landing.pricing.free.name": "Gratis",
  "landing.pricing.free.description": "Untuk menjelajahi ekosistem Second Brain.",
  "landing.pricing.free.cta": "Mulai gratis",
  "landing.pricing.pro.name": "Pro",
  "landing.pricing.pro.description": "Untuk pembelajaran serius sehari-hari.",
  "landing.pricing.pro.badge": "Direkomendasikan",
  "landing.pricing.pro.cta": "Beralih ke Pro",
  "landing.pricing.max.name": "Max",
  "landing.pricing.max.description": "Untuk peneliti, pelajar intensif, dan profesional.",
  "landing.pricing.max.cta": "Buka Max",
  "landing.final.title": "Pembelajaran Anda layak mendapatkan lebih dari sekadar perpustakaan",
  "landing.final.subtitle": "Aktifkan Kembaran Digital Anda.",
  "landing.footer.tagline": "Lingkungan pembelajaran pribadi yang didukung AI.",
  "landing.footer.product": "Produk",
  "landing.footer.product1": "Fitur",
  "landing.footer.product2": "Profesor AI",
  "landing.footer.product3": "Perpustakaan",
  "landing.footer.product4": "Otak Saya",
  "landing.footer.product5": "Ulasan",
  "landing.footer.learn": "Belajar",
  "landing.footer.learn1": "Bahasa",
  "landing.footer.learn2": "Ruang Kerja Akademis",
  "landing.footer.learn3": "Percakapan",
  "landing.footer.learn4": "Dokumen",
  "landing.footer.resources": "Sumber Daya",
  "landing.footer.resources1": "FAQ",
  "landing.footer.resources2": "Bantuan",
  "landing.footer.resources3": "Dokumentasi",
  "landing.footer.company": "Perusahaan",
  "landing.footer.company1": "Tentang",
  "landing.footer.company2": "Kontak",
  "landing.footer.legal": "Legal",
  "landing.footer.legal1": "Privasi",
  "landing.footer.legal2": "Ketentuan",
  "landing.footer.legal3": "Keamanan",
  "landing.footer.copy": "© 2026 Second Brain — Lingkungan belajar AI pribadi Anda."
  ,"languageSelector.recent": "Terbaru"
  ,"languageSelector.nativeLabel": "Bahasa ibu"
  ,"voice11.state.ready": "Siap"
  ,"voice11.state.listening": "Mendengarkan"
  ,"voice11.state.transcription": "Mentranskripsikan"
  ,"voice11.state.thinking": "Profesor sedang berpikir"
  ,"voice11.state.response": "Respons siap"
  ,"voice11.state.paused": "Perekaman dijeda"
  ,"voice11.state.error": "Kesalahan suara"
  ,"voice11.transcribe": "Hentikan dan transkripsikan"
  ,"voice11.pause": "Jeda"
  ,"voice11.resume": "Lanjutkan"
  ,"voice11.transcript.edit": "Transkrip siap — tinjau atau edit sebelum dikirim."
  ,"state.processing": "Memproses…"
  ,"state.partial": "Beberapa hasil masih belum tersedia"
  ,"state.success": "Selesai"
  ,"state.stale": "Menampilkan data yang dimuat sebelumnya"
  ,"state.offline": "Anda sedang offline"
  ,"state.quota-limited": "Batas penggunaan tercapai"
  ,"learning.notTracked": "Tidak dilacak"
  ,"profile.kyc.goalsImpact": "Tujuan ini memandu Revisi, Profesor AI, dan Kembaran Digital Anda."
  ,"profile.kyc.languagesEmpty": "Belum ada."
  ,"learn.component.dropTitle": "Letakkan dokumen Anda di sini"
  ,"learn.component.dropDetail": "PDF, foto, pindaian, buku, buku catatan…"
  ,"learn.component.documentQuestion": "Dokumen apakah ini?"
  ,"learn.component.yourTurn": "Giliran Anda."
  ,"ai.professor": "Profesor AI"
  ,"ai.recommendation": "Rekomendasi AI"
  ,"ai.insight": "Wawasan AI"
  ,"ai.explanation": "Penjelasan"
  ,"ai.warning": "Kesulitan terdeteksi"
  ,"ai.progress": "Kemajuan"
  ,"ai.posture.supportive": "Mendukung"
  ,"ai.posture.challenging": "Menantang"
  ,"ai.posture.examiner": "Penguji"
  ,"review.due": "jatuh tempo"
  ,"profile.card.photo": "Foto profil"
  ,"profile.card.editPhoto": "Edit foto profil"
  ,"profile.card.takePhoto": "Ambil foto"
  ,"profile.card.gallery": "Pilih dari galeri"
  ,"profile.card.avatar": "Atau pilih avatar"
  ,"profile.card.removePhoto": "Hapus foto"
  ,"profile.card.identity": "Identitas & perjalanan"
  ,"profile.card.name": "Nama"
  ,"profile.card.namePh": "Nama Anda"
  ,"profile.card.category": "Kategori pelajar"
  ,"profile.card.curriculum": "Kursus/bidang"
  ,"profile.card.level": "Tingkat"
  ,"profile.card.institution": "Institusi"
  ,"profile.card.nativeLanguage": "Bahasa ibu"
  ,"profile.card.studyLanguage": "Bahasa studi"
  ,"profile.card.mobility": "Mobilitas internasional"
  ,"profile.card.mobilityOn": "Anda belajar dalam bahasa yang berbeda dari bahasa ibu: dukungan bahasa otomatis dan imersi kontekstual diaktifkan."
  ,"profile.card.mobilityOff": "Aktifkan ini jika Anda belajar dalam bahasa selain bahasa ibu."
  ,"profile.card.languageSupport": "🌍 Dukungan bahasa diaktifkan"
  ,"profile.card.aiTeacher": "Profesor AI"
  ,"profile.card.posture": "Pendekatan"
  ,"profile.card.toneSupportive": "🟢 Mendukung"
  ,"profile.card.toneBalanced": "🟡 Menantang"
  ,"profile.card.toneDemanding": "🔴 Ketat/penguji"
  ,"profile.card.explanations": "Penjelasan"
  ,"profile.card.explShort": "Singkat"
  ,"profile.card.explBalanced": "Seimbang"
  ,"profile.card.explDetailed": "Terperinci"
  ,"profile.card.cognitive": "Profil kognitif (Kembaran Digital)"
  ,"profile.card.strengths": "Kekuatan Anda"
  ,"profile.card.strengthsEmpty": "Akan muncul seiring Anda belajar."
  ,"profile.card.targetRetention": "Target retensi"
  ,"profile.card.target90": "Target 90%"
  ,"profile.card.retentionCurrent": "saat ini · target 90%"
  ,"profile.card.dailyPace": "Kecepatan harian"
  ,"profile.card.minDay": "mnt/hari"
  ,"profile.card.systemData": "Sistem & data"
  ,"profile.card.theme": "Tema"
  ,"profile.card.light": "☀︎ Terang"
  ,"profile.card.dark": "☾ Gelap"
  ,"profile.card.system": "⚙︎ Sistem"
  ,"profile.card.statistics": "Statistik"
  ,"profile.card.concepts": "konsep"
  ,"profile.card.reviews": "ulasan"
  ,"profile.card.privacyMemory": "Privasi & memori"
  ,"profile.card.privacyData": "🔒 Privasi & data"
  ,"profile.card.vectorMemory": "🧠 Kelola memori vektor"
  ,"profile.card.cat.child": "Anak"
  ,"profile.card.cat.student": "Siswa"
  ,"profile.card.cat.researcher": "Peneliti"
  ,"profile.card.cat.adult": "Dewasa"
  ,"profile.card.cat.language": "Pelajar bahasa"
  ,"brain.panel.overview": "Ringkasan"
  ,"brain.panel.mastered": "dikuasai"
  ,"brain.panel.fragile": "rapuh"
  ,"brain.panel.average": "penguasaan rata-rata"
  ,"brain.panel.cognitive": "Profil kognitif"
  ,"brain.panel.cognitiveEmpty": "Belum cukup data untuk memetakan profil Anda."
  ,"brain.panel.indicators": "Indikator penguasaan internal, bukan nilai sekolah."
  ,"brain.panel.maturity": "kematangan"
  ,"brain.panel.dnaEmpty": "DNA pembelajaran Anda terbentuk saat Anda menyelesaikan sesi."
  ,"brain.panel.dnaNote": "Pengamatan yang terus berkembang, bukan diagnosis."
  ,"brain.panel.studied": "dipelajari"
  ,"brain.panel.toReview": "untuk ditinjau"
  ,"brain.panel.memoryNote": "Second Brain melacak perubahan pengetahuan Anda secara otomatis."
  ,"brain.panel.attention": "Yang memerlukan perhatian Anda"
  ,"brain.panel.reviewNow": "Tinjau sekarang"
  ,"brain8.intro": "Tampilan hidup tentang apa yang Anda ketahui, cara Anda belajar, hal yang mulai rapuh, dan langkah berikutnya."
  ,"brain8.nav.overview": "Ringkasan"
  ,"brain8.nav.knowledge": "Pengetahuan"
  ,"brain8.nav.learning": "Cara saya belajar"
  ,"brain8.nav.memory": "Memori"
  ,"brain8.nav.history": "Riwayat"
  ,"brain8.map.title": "Peta pengetahuan hidup Anda"
  ,"brain8.maturity.sparse": "Mulai terbentuk"
  ,"brain8.maturity.medium": "Terhubung"
  ,"brain8.maturity.dense": "Dapat dijelajahi"
  ,"brain8.maturity.sparse.detail": "Second Brain memulai dari sumber dan aktivitas nyata pertama Anda."
  ,"brain8.maturity.medium.detail": "Konsep, latihan, dan sumber Anda kini menunjukkan pola yang berguna."
  ,"brain8.maturity.dense.detail": "Peta Anda memiliki cukup bukti untuk penjelajahan dan filter terarah."
  ,"brain8.metrics.concepts": "konsep"
  ,"brain8.metrics.connections": "hubungan"
  ,"brain8.metrics.events": "peristiwa pembelajaran"
  ,"brain8.sparse.title": "Otak Anda mulai terbentuk"
  ,"brain8.sparse.detail": "Belajar, impor sumber, atau tetapkan tujuan. Setiap interaksi nyata akan memperkaya tampilan ini."
  ,"brain8.action.learn": "Mulai belajar"
  ,"brain8.action.import": "Impor sumber"
  ,"brain8.action.goal": "Tetapkan tujuan"
  ,"brain8.recent.documents": "Sumber terbaru"
  ,"brain8.recent.knowledge": "Pengetahuan yang baru aktif"
  ,"brain8.openKnowledge": "Jelajahi"
  ,"brain8.knowledge.empty": "Belum ada konsep yang cocok."
  ,"brain8.knowledge.list": "Daftar yang dapat diakses"
  ,"brain8.knowledge.graph": "Peta visual"
  ,"brain8.graph.bounded": "{shown} dari {total} konsep dimuat. Gunakan pencarian atau muat lebih banyak untuk mempersempit peta."
  ,"brain8.loadMore": "Muat lebih banyak"
  ,"brain8.mastery.unknown": "Belum diukur"
  ,"brain8.mastery.unknown.detail": "Penguasaan tidak diukur sampai tersedia cukup bukti ulasan."
  ,"brain8.mastery.value": "Perkiraan penguasaan: {value}%"
  ,"brain8.strength.title": "Kekuatan dan pengetahuan rapuh"
  ,"brain8.strength.note": "Indikator ini berasal dari pengetahuan yang ditinjau, bukan nilai sekolah."
  ,"brain8.nba.badge": "Tindakan terbaik berikutnya"
  ,"brain8.nba.learn.title": "Pahami {concept}"
  ,"brain8.nba.learn.reason": "Konsep ini siap atau sudah berlangsung dalam jalur pengetahuan Anda saat ini."
  ,"brain8.nba.learn.action": "Tanya Profesor"
  ,"brain8.nba.review.title": "Perkuat {concept}"
  ,"brain8.nba.review.reason": "Sinyal ulasan dan memori Anda menunjukkan bahwa konsep ini perlu diperhatikan."
  ,"brain8.nba.review.action": "Tinjau sekarang"
  ,"brain8.nba.why": "Mengapa ini?"
  ,"brain8.nba.hideWhy": "Sembunyikan penjelasan"
  ,"brain8.nba.due": "{count} ulasan terkait jatuh tempo."
  ,"brain8.memory.title": "Memori pembelajaran"
  ,"brain8.memory.reviews": "ulasan selesai"
  ,"brain8.memory.due": "ulasan jatuh tempo"
  ,"brain8.memory.sources": "sumber dipelajari"
  ,"brain8.memory.note": "Hanya pelajaran, sumber, dan ulasan yang disimpan yang dihitung di sini."
  ,"brain8.memory.open": "Buka memori"
  ,"brain8.memory.fragile": "Pengetahuan untuk diperkuat"
  ,"brain8.memory.review": "Buka Revisi"
  ,"brain8.declared.title": "Yang saya sampaikan kepada Second Brain"
  ,"brain8.declared.detail": "Preferensi pembelajaran dan Profesor yang Anda nyatakan."
  ,"brain8.declared.empty": "Belum ada preferensi yang dinyatakan. Anda dapat melengkapinya dari profil."
  ,"brain8.observed.title": "Yang diamati Second Brain"
  ,"brain8.observed.detail": "Pola dari interaksi nyata, ditampilkan hanya jika bukti mencukupi."
  ,"brain8.observed.empty": "Belum cukup aktivitas untuk mengidentifikasi pola yang andal."
  ,"brain8.observed.evidence": "Berdasarkan {count} interaksi yang tercatat."
  ,"brain8.observed.style.voice": "Sering menggunakan suara"
  ,"brain8.observed.style.handsOn": "Belajar melalui praktik"
  ,"brain8.observed.style.reading": "Belajar melalui membaca"
  ,"brain8.observed.depth.simple": "Menyukai penjelasan ringkas"
  ,"brain8.observed.depth.balanced": "Menggunakan penjelasan seimbang"
  ,"brain8.observed.depth.deep": "Bekerja dengan penjelasan terperinci"
  ,"brain8.observed.rhythm.occasional": "Ritme sesekali"
  ,"brain8.observed.rhythm.regular": "Ritme teratur"
  ,"brain8.observed.rhythm.intensive": "Ritme intensif"
  ,"brain8.observed.focus.morning": "Lebih aktif pada pagi hari"
  ,"brain8.observed.focus.afternoon": "Lebih aktif pada siang hari"
  ,"brain8.observed.focus.evening": "Lebih aktif pada sore hari"
  ,"brain8.observed.focus.night": "Lebih aktif pada malam hari"
  ,"brain8.dna.title": "DNA Pembelajaran"
  ,"brain8.dna.note": "Pengamatan yang terus berkembang, bukan diagnosis atau identitas tetap."
  ,"brain8.dna.empty": "DNA Pembelajaran akan muncul saat interaksi berulang memberikan bukti yang cukup."
  ,"brain8.history.title": "Riwayat kognitif"
  ,"brain8.history.empty": "Belum ada peristiwa pembelajaran yang tercatat."
  ,"brain8.history.kind.lesson": "Pelajaran"
  ,"brain8.history.kind.success": "Jawaban benar"
  ,"brain8.history.kind.error": "Kesalahan diperbaiki"
  ,"brain8.history.kind.revision": "Revisi"
  ,"brain8.history.kind.conversation": "Percakapan Profesor"
  ,"brain8.history.kind.homework": "Pekerjaan rumah"
  ,"brain8.history.kind.report": "Sesi selesai"
  ,"brain8.history.kind.document": "Sumber ditambahkan"
  ,"brain8.history.kind.concept": "Konsep ditambahkan"
  ,"brain8.history.kind.connection": "Hubungan dibuat"
  ,"brain8.foresight.title": "Wawasan lintasan"
  ,"brain8.foresight.forecast": "Prakiraan"
  ,"brain8.foresight.note": "Ini perkiraan berdasarkan sinyal saat ini, bukan fakta."
  ,"brain8.foresight.action": "Lihat tindakan yang disarankan"
  ,"brain8.foresight.kind.dropout": "Risiko terhenti"
  ,"brain8.foresight.kind.difficulty": "Risiko kesulitan"
  ,"brain8.foresight.kind.overload": "Risiko beban berlebih"
  ,"brain8.foresight.kind.motivation": "Risiko motivasi"
  ,"brain8.foresight.kind.forgetting": "Risiko lupa"
  ,"brain8.foresight.reason.dropout": "Sinyal kesinambungan terbaru menunjukkan kemungkinan gangguan pada ritme Anda saat ini."
  ,"brain8.foresight.reason.difficulty": "Jalur penguasaan Anda saat ini menunjukkan kemungkinan kesulitan di depan."
  ,"brain8.foresight.reason.overload": "Sinyal beban kerja Anda saat ini menunjukkan kemungkinan beban berlebih."
  ,"brain8.foresight.reason.motivation": "Sinyal aktivitas terbaru menunjukkan kemungkinan kehilangan momentum."
  ,"brain8.foresight.reason.forgetting": "Prakiraan ulasan menunjukkan bahwa beberapa pengetahuan mungkin semakin sulit diingat."
  ,"brain8.search.label": "Cari di otak Anda"
  ,"brain8.search.placeholder": "Konsep, sumber, atau tujuan…"
  ,"brain8.search.action": "Cari"
  ,"brain8.search.kind.concept": "Konsep"
  ,"brain8.search.kind.document": "Sumber"
  ,"brain8.search.kind.goal": "Tujuan"
  ,"brain8.ask.title": "Tanya otak Anda…"
  ,"brain8.ask.detail": "Second Brain menjawab hanya dari konsep dan sumber Anda."
  ,"brain8.ask.placeholder": "Apa yang saya ketahui tentang jaringan?"
  ,"brain8.ask.action": "Tanya"
  ,"brain8.ask.answer.weakest": "Ditemukan {count} konsep rapuh dari sinyal penguasaan Anda."
  ,"brain8.ask.answer.neglected": "Ditemukan {count} konsep dengan ulasan jatuh tempo."
  ,"brain8.ask.answer.documents": "Ditemukan {count} sumber atau konsep yang cocok."
  ,"brain8.ask.answer.knowledge": "Ditemukan {count} elemen yang cocok di otak Anda."
  ,"brain8.ask.answer.no-results": "Data Anda saat ini tidak mendukung jawaban untuk pertanyaan ini."
  ,"brain8.ask.grounded": "Jawaban dibatasi pada data Second Brain Anda yang tersimpan."
  ,"brain8.concept.pick": "Pilih konsep untuk memeriksa bukti dan hubungannya."
  ,"brain8.concept.cards": "{count} kartu"
  ,"brain8.concept.due": "{count} jatuh tempo"
  ,"brain8.concept.stability": "Stabilitas memori selama {days} hari"
  ,"brain8.concept.nextReview": "Ulasan terjadwal berikutnya: {date}"
  ,"brain8.concept.tutor": "Tanya Profesor"
  ,"brain8.concept.practice": "Berlatih"
  ,"brain8.concept.review": "Tinjau"
  ,"brain8.concept.sources": "Sumber"
  ,"brain8.concept.relations": "Hubungan"
  ,"brain8.concept.activity": "Interaksi terbaru"
  ,"brain8.concept.truncated": "Hanya sumber pertama yang tersedia yang ditampilkan."
  ,"brain8.relation.prerequisite": "prasyarat"
  ,"brain8.relation.related": "terkait"
  ,"brain8.context.document": "Dokumen aktif"
  ,"brain8.context.session": "Sesi Profesor"
  ,"brain8.context.goal": "Tujuan pembelajaran"
  ,"brain8.partial": "Beberapa bagian sementara tidak tersedia; data yang tersedia tetap dapat digunakan."
  ,"brain8.error.load": "Otak Anda tidak dapat dimuat saat ini."
  ,"tutor6.result.brain": "Lihat dampaknya pada Otak Saya"
  ,"voice.error.playback": "Suara guru Anda tidak dapat diputar."
  ,"voice.error.blocked": "Pemutaran audio diblokir."
  ,"voice.error.recordUnsupported": "Perekaman audio tidak tersedia di perangkat ini."
  ,"voice.error.micDenied": "Akses mikrofon ditolak. Izinkan akses mikrofon dan coba lagi."
  ,"voice.error.notRecording": "Tidak ada perekaman yang sedang berlangsung."
  ,"voice.error.empty": "Tidak ada yang direkam. Periksa mikrofon dan coba lagi."
  ,"error.timeout": "Permintaan memerlukan waktu terlalu lama. Coba lagi."
  ,"error.unauthorized": "Sesi Anda telah berakhir atau kredensial tidak valid."
  ,"error.forbidden": "Tindakan ini tidak tersedia untuk akun ini."
  ,"error.notFound": "Item yang diminta tidak lagi tersedia."
  ,"error.conflict": "Perubahan ini bertentangan dengan keadaan saat ini. Segarkan dan coba lagi."
  ,"error.rateLimit": "Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi."
  ,"error.validation": "Beberapa informasi tidak valid. Periksa bidang dan coba lagi."
  ,"error.upload": "Unggahan gagal. Pekerjaan Anda yang ada tetap dipertahankan."
  ,"error.download": "Berkas tidak dapat dimuat. Coba lagi."
  ,"onb.languages.explanation": "Bahasa penjelasan"
  ,"onb.languages.explanationWhy": "Profesor AI menggunakan bahasa ini untuk penjelasan dan panduan umum."
  ,"mfa.title": "Verifikasi dua langkah"
  ,"mfa.intro": "Lindungi akun dengan kode dari aplikasi autentikator Anda."
  ,"mfa.profileTitle": "Keamanan akun"
  ,"mfa.profileDetail": "Konfigurasikan verifikasi dua langkah dari layar pendaftaran Web yang aman."
  ,"mfa.open": "Konfigurasikan verifikasi dua langkah"
  ,"mfa.idleTitle": "Tambahkan aplikasi autentikator"
  ,"mfa.idleDetail": "Mulai hanya saat aplikasi autentikator Anda siap. Kunci penyiapan pribadi baru akan dibuat."
  ,"mfa.start": "Mulai penyiapan aman"
  ,"mfa.setupTitle": "Hubungkan autentikator Anda"
  ,"mfa.setupDetail": "Tambahkan akun secara manual dengan kunci di bawah, atau impor URI otpauth ke autentikator yang kompatibel."
  ,"mfa.secretLabel": "Kunci Base32 manual"
  ,"mfa.secretWarning": "Perlakukan kunci ini seperti kata sandi. Jangan bagikan atau simpan dalam catatan yang tidak terlindungi."
  ,"mfa.uriLabel": "URI autentikator"
  ,"mfa.uriDetail": "Gunakan ini hanya di aplikasi autentikator yang Anda percayai."
  ,"mfa.codeLabel": "Kode autentikasi 6 digit"
  ,"mfa.codeHint": "Masukkan kode 6 digit saat ini yang ditampilkan aplikasi autentikator Anda."
  ,"mfa.enable": "Verifikasi dan aktifkan"
  ,"mfa.alreadyEnabled": "Verifikasi dua langkah mungkin sudah aktif. Keluar lalu masuk lagi untuk memverifikasinya."
  ,"mfa.setupError": "Penyiapan aman tidak dapat dimulai. Tidak ada yang diaktifkan. Coba lagi."
  ,"mfa.enableError": "Kode tidak dapat diverifikasi. Periksa kode saat ini dan coba lagi."
  ,"mfa.recoveryTitle": "Simpan kode pemulihan Anda sekarang"
  ,"mfa.recoveryWarning": "Kode ini hanya ditampilkan sekali."
  ,"mfa.recoveryDetail": "Simpan di pengelola kata sandi tepercaya atau tempat aman lain sebelum meninggalkan layar ini."
  ,"mfa.saved": "Saya telah menyimpan kode pemulihan"
  ,"mfa.doneTitle": "Verifikasi dua langkah diaktifkan"
  ,"mfa.doneDetail": "Masuk berikutnya akan memerlukan autentikator atau satu kode pemulihan yang belum digunakan."
  ,"mfa.backProfile": "Kembali ke Profil"
  ,"nav.back": "Kembali"
  ,"shell.backToApp": "Kembali ke aplikasi"
  ,"shell.adminArea": "Administrasi"
  ,"shell.technicalArea": "Area teknis"
  ,"shell.demoArea": "Area demo"
  ,"shell.legacyArea": "Pengalaman lama"
  ,"shell.designSystem": "Sistem desain"
  ,"learn.backToLearn": "Kembali ke Belajar"
  ,"learn.free.kicker": "Pencarian Bebas"
  ,"learn.free.title": "Tanyakan apa saja"
  ,"learn.free.subtitle": "Pertanyaan spontan — akademis, teknis, atau umum. Berbeda dari Profesor AI pedagogis Anda."
  ,"learn.free.placeholder": "Ketik pertanyaan Anda…"
  ,"learn.free.submit": "Tanya"
  ,"learn.deep.kicker": "Riset Mendalam"
  ,"learn.deep.title": "Jelajahi topik secara mendalam"
  ,"learn.deep.subtitle": "Profesor menyelidiki topik secara menyeluruh dan mengembalikan analisis terstruktur."
  ,"learn.deep.placeholder": "Apa yang ingin Anda jelajahi secara mendalam?"
  ,"learn.deep.submit": "Riset"
  ,"learn.deep.frame": "Berikan analisis menyeluruh dan terstruktur (konteks, poin utama, nuansa, kesimpulan) tentang:"
  ,"learn.deep.note": "Sumber langsung dan rencana riset langkah demi langkah akan hadir seiring perkembangan backend."
  ,"learn.oral.kicker": "Latihan Lisan"
  ,"learn.oral.title": "Jawab dengan lantang"
  ,"learn.oral.subtitle": "Profesor mengajukan pertanyaan; jawab dengan suara dan Anda akan dinilai."
  ,"learn.oral.frame": "Jalankan latihan lisan singkat yang sesuai profil saya. Ajukan satu pertanyaan setiap kali; saya akan menjawab dengan suara."
  ,"learn.oral.record": "Jawab dengan suara"
  ,"learn.oral.stop": "Hentikan"
  ,"learn.oral.ready": "Siap"
  ,"learn.oral.recording": "Mendengarkan…"
  ,"learn.oral.analyzing": "Menganalisis…"
  ,"learn.oral.you": "Anda"
  ,"learn.oral.teacher": "Profesor"
  ,"learn.oral.noVoice": "Perekaman suara tidak tersedia di perangkat ini."
  ,"learn.oral.starting": "Menyiapkan latihan…"
  ,"learn.explain.kicker": "Jelaskan"
  ,"learn.explain.title": "Dapatkan penjelasan konsep"
  ,"learn.explain.subtitle": "Penjelasan jelas dengan contoh dan analogi, pada tingkat yang Anda pilih."
  ,"learn.explain.levelLabel": "Tingkat"
  ,"learn.explain.lvlBeginner": "Pemula"
  ,"learn.explain.lvlIntermediate": "Menengah"
  ,"learn.explain.lvlAdvanced": "Lanjutan"
  ,"learn.explain.placeholder": "Konsep mana yang ingin Anda pahami?"
  ,"learn.explain.submit": "Jelaskan"
  ,"learn.explain.frame": "Jelaskan konsep ini dengan jelas, disertai contoh dan analogi. Tingkat:"
  ,"learn.discuss.kicker": "Percakapan"
  ,"learn.discuss.title": "Berbicara dengan profesor"
  ,"learn.discuss.subtitle": "Percakapan pedagogis bebas — profesor mengenal tingkat dan tujuan Anda."
  ,"learn.discuss.placeholder": "Apa yang ingin Anda bicarakan?"
  ,"learn.discuss.submit": "Mulai"
  ,"learn.exam.kicker": "Ujian Lisan"
  ,"learn.exam.title": "Simulasi ujian lisan"
  ,"learn.exam.subtitle": "Profesor menjadi penguji: mengajukan pertanyaan, Anda menjawab dengan lantang, lalu Anda dinilai."
  ,"learn.exam.consignes": "Jawab dengan lantang, satu pertanyaan setiap kali. Luangkan waktu Anda."
  ,"learn.exam.start": "Mulai ujian"
  ,"learn.exam.starting": "Memulai ujian…"
  ,"learn.exam.elapsed": "Waktu"
  ,"learn.exam.examiner": "Penguji"
  ,"learn.exam.end": "Akhiri ujian"
  ,"learn.exam.evaluating": "Menilai…"
  ,"learn.exam.startFrame": "Beri saya ujian lisan. Umumkan cakupannya secara singkat, lalu ajukan pertanyaan pertama. Satu pertanyaan setiap kali; saya akan menjawab dengan lantang."
  ,"learn.exam.endFrame": "Akhiri ujian sekarang. Berikan penilaian Anda: kekuatan, hal yang perlu ditingkatkan, dan rekomendasi. Bersikaplah pedagogis."
  ,"teach.kicker": "Ajarkan"
  ,"teach.title": "Apa yang harus saya ajarkan kepada Anda?"
  ,"teach.subtitle": "Sebutkan subjek dan profesor akan membuat pelajaran langkah demi langkah untuk Anda."
  ,"teach.placeholder": "Mis. Fotosintesis, Revolusi Prancis, turunan…"
  ,"teach.submit": "Buat pelajaran"
  ,"learn.mode.errTitle": "Pengalaman tidak dikenal"
  ,"learn.mode.errDetail": "Mode pembelajaran ini tidak ada atau belum tersedia."
  ,"home4.loading": "Menyiapkan tindakan berguna berikutnya…"
  ,"home4.context.new": "Mari bangun Second Brain Anda."
  ,"home4.context.active": "Berikut langkah paling berguna dari kemajuan Anda saat ini."
  ,"home4.context.exam": "Ujian {focus} Anda semakin dekat."
  ,"home4.context.revision": "Memori Anda memiliki pekerjaan yang benar-benar jatuh tempo."
  ,"home4.context.resume": "Anda dapat melanjutkan {focus} tanpa kehilangan konteks."
  ,"home4.context.caught-up": "Anda sudah mengikuti semuanya. Tidak ada urgensi buatan."
  ,"home4.recommended": "Direkomendasikan sekarang"
  ,"home4.whyClose": "Sembunyikan alasan"
  ,"home4.whyIntro": "Berdasarkan sinyal yang dapat diverifikasi ini:"
  ,"home4.confidence": "Perkiraan keyakinan: {value}%"
  ,"home4.resume": "Lanjutkan dari tempat Anda berhenti"
  ,"home4.resumeDetail": "Sesi terbaru mempertahankan konteks dan pekerjaan Anda."
  ,"home4.resumeAction": "Lanjutkan"
  ,"home4.session.type.learning": "Pembelajaran"
  ,"home4.session.type.tutor": "Tutor"
  ,"home4.session.type.research": "Riset"
  ,"home4.session.type.review": "Revisi"
  ,"home4.session.type.language": "Bahasa"
  ,"home4.session.type.workspace": "Ruang kerja"
  ,"home4.session.type.document-processing": "Dokumen"
  ,"home4.lastActivity": "Aktivitas terakhir"
  ,"home4.artifact": "Pekerjaan terbaru"
  ,"home4.upcoming": "Akan datang"
  ,"home4.upcomingDetail": "Peristiwa pembelajaran berikutnya yang memerlukan perhatian Anda."
  ,"home4.upcomingEmpty": "Tidak ada yang dijadwalkan dalam waktu dekat."
  ,"home4.planning": "Kalender pembelajaran"
  ,"home4.upcoming.kind.exam": "Ujian"
  ,"home4.upcoming.kind.homework": "Pekerjaan rumah"
  ,"home4.upcoming.kind.practical": "Praktik"
  ,"home4.upcoming.kind.language": "Latihan bahasa"
  ,"home4.upcoming.kind.aiSession": "Sesi AI"
  ,"home4.upcoming.kind.revision": "Revisi"
  ,"home4.upcoming.kind.quiz": "Kuis"
  ,"home4.upcoming.kind.objective": "Tujuan"
  ,"home4.upcoming.kind.deadline": "Tenggat"
  ,"home4.mainGoal": "Tujuan utama"
  ,"home4.goal.period.daily": "Tujuan harian"
  ,"home4.goal.period.weekly": "Tujuan mingguan"
  ,"home4.goal.period.monthly": "Tujuan bulanan"
  ,"home4.goal.open": "Buka tujuan"
  ,"home4.progress.title": "Kemajuan Anda"
  ,"home4.progress.detail": "Tampilan ringkas tentang hal yang berubah dalam pembelajaran Anda."
  ,"home4.progress.due": "ulasan jatuh tempo"
  ,"home4.progress.mastered": "konsep dikuasai"
  ,"home4.progress.streak": "rentetan hari"
  ,"home4.progress.open": "Buka Otak Saya"
  ,"home4.other": "Cara lain untuk memulai"
  ,"home4.otherDetail": "Tangkap atau ungkapkan sesuatu ketika rekomendasi bukan yang Anda perlukan."
  ,"home4.date.today": "Hari ini"
  ,"home4.date.tomorrow": "Besok"
  ,"home4.date.yesterday": "Kemarin"
  ,"home4.date.unknown": "Tanggal tidak diketahui"
  ,"home4.partial": "Beberapa sumber sementara tidak tersedia. Prioritas yang tersedia tetap menggunakan data terverifikasi."
  ,"home4.stale": "Menampilkan Beranda terakhir yang tersedia selagi penyegaran mencoba lagi."
  ,"home4.unavailable": "Tidak ada prioritas terverifikasi yang dapat dimuat saat ini."
  ,"learn5.eyebrow": "Belajar"
  ,"learn5.title": "Mulai dari yang ingin Anda capai"
  ,"learn5.subtitle": "Bertanya, berbicara, menangkap, atau mengimpor. Second Brain memilih pengalaman yang sesuai niat Anda dan mempertahankan konteks."
  ,"learn5.question": "Apa yang ingin Anda pelajari atau lakukan?"
  ,"learn5.composer.badge": "Satu titik masuk cerdas"
  ,"learn5.composer.detail": "Jelaskan hasilnya dengan kata-kata Anda sendiri. Memilih niat bersifat opsional."
  ,"learn5.composer.placeholder": "Contoh: jelaskan fotosintesis, bantu saya berlatih bahasa Spanyol, atau buat kuis dari catatan saya…"
  ,"learn5.composer.inputLabel": "Yang ingin Anda pelajari atau capai"
  ,"learn5.composer.submit": "Lanjutkan"
  ,"learn5.examples.label": "Coba salah satu ini"
  ,"learn5.examples.understand": "Pahami suatu subjek"
  ,"learn5.examples.understandPrompt": "Jelaskan subjek ini kepada saya: "
  ,"learn5.examples.practice": "Berlatih bahasa"
  ,"learn5.examples.practicePrompt": "Bantu saya berlatih percakapan bahasa Inggris"
  ,"learn5.examples.scan": "Pindai halaman"
  ,"learn5.examples.import": "Impor kursus"
  ,"learn5.intent.label": "Niat (opsional)"
  ,"learn5.intent.understand": "Pahami"
  ,"learn5.intent.learn": "Belajar"
  ,"learn5.intent.practice": "Berlatih"
  ,"learn5.intent.research": "Riset"
  ,"learn5.intent.create": "Buat"
  ,"learn5.intent.suggested": "disarankan"
  ,"learn5.depth.label": "Kedalaman riset"
  ,"learn5.depth.quick": "Jawaban cepat"
  ,"learn5.depth.standard": "Riset"
  ,"learn5.depth.deep": "Riset mendalam"
  ,"learn5.modality.write": "Tulis"
  ,"learn5.modality.speak": "Bicara"
  ,"learn5.modality.capture": "Tangkap"
  ,"learn5.modality.import": "Impor"
  ,"learn5.modality.export": "Ekspor"
  ,"learn5.modality.exportData": "Buka ekspor data Anda"
  ,"learn5.route.prefix": "Berikutnya:"
  ,"learn5.route.capture": "buka pemindai, pratinjau halaman, lalu konfirmasi."
  ,"learn5.route.import": "impor berkas ini ke Perpustakaan dan alur pemahamannya."
  ,"learn5.route.voice": "mulai giliran berbicara dengan Profesor AI Anda."
  ,"learn5.route.free-question": "tanya Profesor AI secara langsung."
  ,"learn5.route.document-understanding": "tanyakan dokumen aktif dengan jawaban berbasis sumber."
  ,"learn5.route.concept-explanation": "buka penjelasan terarah untuk konsep aktif."
  ,"learn5.route.explanation": "minta penjelasan terstruktur dari Profesor AI."
  ,"learn5.route.lesson": "buat pelajaran terpandu tentang topik ini."
  ,"learn5.route.guided-session": "mulai pengalaman sesi terpandu yang ada."
  ,"learn5.route.learning-path": "buka jalur pembelajaran adaptif Anda."
  ,"learn5.route.document-learning": "belajar dari dokumen aktif."
  ,"learn5.route.practice": "siapkan latihan."
  ,"learn5.route.document-practice": "buat format latihan dari dokumen aktif."
  ,"learn5.route.oral-practice": "buka latihan lisan dengan Profesor."
  ,"learn5.route.language-practice": "lanjutkan di ruang bahasa khusus."
  ,"learn5.route.research-quick": "dapatkan jawaban ringkas dari Profesor."
  ,"learn5.route.research-library": "selidiki seluruh Perpustakaan dan sumber yang terlihat."
  ,"learn5.route.research-deep": "buka pengalaman riset mendalam lanjutan."
  ,"learn5.route.create-quiz": "siapkan kuis di ruang kerja penilaian."
  ,"learn5.route.create-course": "buat kursus terpandu."
  ,"learn5.route.create-work": "buka Ruang Kerja Akademis dengan instruksi ini."
  ,"learn5.route.create-from-document": "buat dari dokumen aktif."
  ,"learn5.clarify.question": "Apa yang ingin Anda lakukan dengan topik ini?"
  ,"learn5.deep.confirmTitle": "Riset mendalam menggunakan alur kerja lanjutan"
  ,"learn5.deep.confirmDetail": "Proses ini mungkin lebih lama dan menggunakan lebih banyak jatah. Permintaan Anda tetap tersimpan jika layanan tidak tersedia."
  ,"learn5.deep.confirm": "Konfirmasi riset mendalam"
  ,"learn5.attachment.ready": "siap diimpor"
  ,"learn5.attachment.remove": "Hapus"
  ,"learn5.attachment.import": "Impor dan lanjutkan"
  ,"learn5.attachment.error": "Berkas ini tidak dapat dipilih."
  ,"learn5.attachment.missing": "Pilih kembali berkas sebelum mengimpornya."
  ,"learn5.capture.title": "Tangkap atau impor"
  ,"learn5.capture.detail": "Pindaian dipratinjau sebelum diunggah. Berkas bergabung ke alur pemahaman dokumen yang sama."
  ,"learn5.capture.scan": "Foto atau pindai halaman"
  ,"learn5.capture.file": "Pilih berkas"
  ,"learn5.voice.stop": "Hentikan dan kirim"
  ,"learn5.voice.error": "Perekaman tidak dapat diselesaikan."
  ,"learn5.voice.missing": "Tidak ada rekaman yang siap dikirim."
  ,"learn5.voice.unavailable": "Mikrofon tidak tersedia di perangkat ini"
  ,"learn5.error.generic": "Tindakan ini tidak dapat dimulai."
  ,"learn5.error.preserved": "Teks, konteks, dan lampiran Anda dipertahankan. Anda dapat mencoba lagi atau menggunakan fitur non-AI lain."
  ,"learn5.draft.restored": "Draf dipulihkan"
  ,"learn5.draft.restoredDetail": "Permintaan sebelumnya dan konteksnya masih ada."
  ,"learn5.draft.clear": "Bersihkan"
  ,"learn5.cancel": "Batal"
  ,"learn5.context.user-profile": "Profil"
  ,"learn5.context.brain": "Otak Saya"
  ,"learn5.context.document": "Dokumen"
  ,"learn5.context.document-collection": "Koleksi dokumen"
  ,"learn5.context.concept": "Konsep"
  ,"learn5.context.lesson": "Pelajaran"
  ,"learn5.context.goal": "Tujuan"
  ,"learn5.context.exam": "Ujian"
  ,"learn5.context.language": "Bahasa yang dipelajari"
  ,"learn5.context.workspace": "Ruang kerja"
  ,"learn5.context.tutor-session": "Sesi tutor"
  ,"learn5.context.research": "Riset"
  ,"learn5.context.revision": "Revisi"
  ,"learn5.context.learning-path": "Jalur pembelajaran"
  ,"learn5.resume.unavailable": "Sesi sementara tidak tersedia"
  ,"learn5.resume.unavailableDetail": "Kolom penulisan tetap tersedia dan draf Anda akan disimpan."
  ,"learn5.spaces.title": "Ruang khusus"
  ,"learn5.spaces.detail": "Buka lingkungan khusus ketika tugas akan lebih baik dengannya."
  ,"learn5.spaces.languages": "Bahasa"
  ,"learn5.spaces.languagesDetail": "Imersi, pelafalan, dan percakapan."
  ,"learn5.spaces.library": "Perpustakaan"
  ,"learn5.spaces.libraryDetail": "Dokumen dan sumber Anda di satu tempat."
  ,"learn5.spaces.workspace": "Ruang Kerja Akademis"
  ,"learn5.spaces.workspaceDetail": "Buat dan tingkatkan karya akademis terstruktur."
  ,"learn5.advanced.title": "Mode lanjutan"
  ,"learn5.advanced.detail": "Pengalaman khusus yang ada, tersedia saat Anda menginginkan kendali langsung."
  ,"learn5.advanced.explain": "Jelaskan"
  ,"learn5.advanced.teach": "Ajari saya"
  ,"learn5.advanced.guided": "Sesi terpandu"
  ,"learn5.advanced.oral": "Latihan lisan"
  ,"learn5.advanced.exam": "Ujian lisan"
  ,"learn5.advanced.deep": "Riset mendalam"
  ,"teacher.mode.lesson": "Pelajaran"
  ,"teacher.mode.exercise": "Latihan"
  ,"teacher.mode.training": "Pelatihan"
  ,"teacher.mode.assessed": "Dinilai"
  ,"teacher.mode.exam": "Ujian"
  ,"teacher.exam.rulesTitle": "Aturan ujian"
  ,"teacher.exam.mode": "Mode ujian"
  ,"teacher.exam.grading": "Pemberian nilai"
  ,"teacher.exam.rubric": "Rubrik evaluasi"
  ,"teacher.exam.help": "Bantuan yang diizinkan"
  ,"teacher.exam.helpLimited": "Bantuan terbatas"
  ,"teacher.exam.helpNone": "Tanpa bantuan"
  ,"teacher.exam.feedbackAfter": "Umpan balik setelah pengumpulan"
  ,"profile.intro": "Kelola identitas, preferensi Second Brain, bahasa, paket, dan data Anda."
  ,"profile.section.myProfile": "Profil saya"
  ,"profile.section.myProfileDetail": "Identitas dan konteks pembelajaran Anda yang digunakan di seluruh produk."
  ,"profile.section.personalization": "Personalisasi Second Brain"
  ,"profile.section.personalizationDetail": "Pilih cara Profesor AI mengajar. DNA Pembelajaran terperinci Anda tetap berada di Otak Saya."
  ,"profile.section.languages": "Bahasa & pengalaman"
  ,"profile.section.languagesDetail": "Atur bahasa antarmuka secara terpisah dari bahasa yang Anda pelajari."
  ,"profile.section.billing": "Langganan & penggunaan"
  ,"profile.section.billingDetail": "Lihat paket saat ini, batas nyata, sisa penggunaan, dan tanggal pengaturan ulang."
  ,"profile.section.privacy": "Data & privasi"
  ,"profile.section.privacyDetail": "Kontrol tampilan, memori AI, dokumen, persetujuan, dan data pribadi Anda."
  ,"profile.billing.current": "Paket saat ini"
  ,"profile.billing.unavailable": "Paket tidak tersedia"
  ,"profile.billing.usageUnavailable": "Rincian penggunaan sementara tidak tersedia."
  ,"profile.billing.viewUsage": "Lihat penggunaan dan kuota"
  ,"profile.brainPreview.title": "Profil pembelajaran"
  ,"profile.brainPreview.detail": "Pratinjau singkat. DNA Pembelajaran, memori, dan penguasaan Anda berada di Otak Saya."
  ,"profile.brainPreview.empty": "Profil pembelajaran Anda akan muncul saat Anda menyelesaikan sesi."
  ,"profile.brainPreview.open": "Buka Otak Saya"
  ,"profile.languages.specialized": "Bahasa antarmuka terpisah dari bahasa yang Anda pelajari."
  ,"profile.languages.open": "Buka Bahasa & Imersi"
  ,"profile.privacy.detail": "Kontrol privasi dan memori terperinci Anda tetap tersedia kapan saja."
  ,"profile.privacy.memory": "Memori AI"
  ,"profile.privacy.documents": "Dokumen saya"
  ,"profile.partial": "Beberapa informasi profil tidak dapat disegarkan. Pengaturan yang tersedia tetap dapat digunakan."
  ,"profile.teacher.title": "Profesor AI saya"
  ,"profile.teacher.detail": "Kurang menuntut memberi lebih banyak petunjuk dan percobaan ulang; Normal tetap hidup, mendorong, dan terstruktur; Menuntut meminta penalaran lebih dalam dan koreksi tepat."
  ,"profile.teacher.auto": "Adaptasi otomatis"
  ,"profile.teacher.autoDetail": "Second Brain terus menyesuaikan panduan, kecepatan, dan kesulitan dari kemajuan nyata Anda. Normal adalah bawaan di luar penilaian yang diumumkan."
  ,"profile.teacher.learning": "Tingkat pengajaran"
  ,"profile.teacher.learning.guided": "Kurang menuntut"
  ,"profile.teacher.learning.balanced": "Normal"
  ,"profile.teacher.learning.demanding": "Menuntut"
  ,"profile.teacher.conversation": "Mode percakapan"
  ,"profile.teacher.conversation.training": "Pelatihan"
  ,"profile.teacher.conversation.assessed": "Dinilai"
  ,"profile.teacher.conversation.trainingDetail": "Berlatih bebas dengan petunjuk dan koreksi."
  ,"profile.teacher.conversation.assessedDetail": "Selesaikan percakapan evaluatif yang diumumkan dengan bantuan terbatas dan umpan balik berbasis bukti."
  ,"profile.teacher.exam": "Mode ujian"
  ,"profile.teacher.exam.standard": "Standar"
  ,"profile.teacher.exam.strict": "Ketat"
  ,"profile.teacher.examDetail": "Aturan ujian mengontrol bantuan, penilaian, dan waktu umpan balik."
  ,"profile.teacher.advancedOpen": "Tampilkan pengaturan lanjutan"
  ,"profile.teacher.advancedClose": "Sembunyikan pengaturan lanjutan"
  ,"profile.teacher.correction": "Waktu koreksi"
  ,"profile.teacher.correction.immediate": "Koreksi segera"
  ,"profile.teacher.correction.let_me_finish": "Biarkan saya selesai"
  ,"profile.teacher.correction.adaptive": "Sesuaikan dengan situasi"
  ,"profile.teacher.summary": "Ringkasan sesi"
  ,"profile.teacher.encouragement": "Dorongan"
  ,"profile.teacher.encouragement.measured": "Terukur"
  ,"profile.teacher.encouragement.supportive": "Mendukung"
  ,"profile.teacher.reset": "Atur ulang ke bawaan"
  ,"profile.settings.saveError": "Pengaturan ini tidak dapat disimpan."
  ,"profile.settings.preserved": "Pengaturan sebelumnya dipertahankan."
  ,"tutor.fasterMsg": "Saya mengerti — bisakah Anda sedikit lebih cepat?"
  ,"tutor.loadFailed": "Ruang kelas tidak dapat dibuka."
  ,"tutor6.lobby.loading": "Membuka sesi pembelajaran Anda…"
  ,"tutor6.lobby.eyebrow": "Profesor AI"
  ,"tutor6.lobby.title": "Apa yang ingin Anda kerjakan?"
  ,"tutor6.lobby.subtitle": "Lanjutkan tepat dari alur pembelajaran yang ditinggalkan, atau mulai permintaan terarah."
  ,"tutor6.lobby.continueTitle": "Lanjutkan dari tempat Anda berhenti"
  ,"tutor6.lobby.resumeDetail": "Tujuan, konteks, dan riwayat Anda dipertahankan."
  ,"tutor6.lobby.resume": "Lanjutkan sesi"
  ,"tutor6.lobby.newTitle": "Permintaan baru"
  ,"tutor6.lobby.placeholder": "Jelaskan gagasan, tanya saya, bantu saya berlatih…"
  ,"tutor6.lobby.start": "Tanya Profesor"
  ,"tutor6.lobby.openSaved": "Buka sesi tersimpan"
  ,"tutor6.lobby.recent": "Sesi terbaru"
  ,"tutor6.lobby.completed": "Sesi selesai"
  ,"tutor6.lobby.modes": "Cara lain untuk bekerja"
  ,"tutor6.lobby.mode.explain": "Jelaskan"
  ,"tutor6.lobby.mode.discuss": "Diskusikan"
  ,"tutor6.lobby.mode.oral": "Latihan lisan"
  ,"tutor6.lobby.mode.deep": "Riset mendalam"
  ,"tutor6.objective": "Tujuan pembelajaran"
  ,"tutor6.strategy": "Pendekatan pengajaran"
  ,"tutor6.empty": "Ajukan pertanyaan pertama. Tujuan dan konteks aktif Anda akan tetap terhubung ke sesi ini."
  ,"tutor6.loading.detail": "Memulihkan tujuan, konteks, dan percakapan terbaru."
  ,"tutor6.backTutor": "Kembali ke Profesor"
  ,"tutor6.pause": "Jeda dan keluar"
  ,"tutor6.complete": "Selesaikan sesi"
  ,"tutor6.options": "Opsi sesi"
  ,"tutor6.state.ready": "Siap"
  ,"tutor6.state.listening": "Mendengarkan"
  ,"tutor6.state.transcription": "Mentranskripsikan suara Anda…"
  ,"tutor6.state.thinking": "Profesor sedang menyiapkan respons…"
  ,"tutor6.state.response": "Respons siap"
  ,"tutor6.state.error": "Tindakan diperlukan"
  ,"tutor6.voice.heard": "Transkrip dipertahankan: “{text}”"
  ,"tutor6.voice.saved": "Giliran lisan dan pelajaran tertulis “{topic}” Anda dipertahankan."
  ,"tutor6.error.provider": "Profesor sementara tidak tersedia"
  ,"tutor6.error.preserved": "Draf dan sesi Anda dipertahankan."
  ,"tutor6.error.retry": "Coba lagi permintaan ini"
  ,"tutor6.quota.title": "Batas penggunaan AI tercapai"
  ,"tutor6.quota.detail": "Tindakan AI ini dijeda. Anda tetap dapat membaca dokumen dan menggunakan area non-AI."
  ,"tutor6.quota.reset": "Tindakan AI akan tersedia lagi setelah {date}. Sesi Anda tetap tersimpan."
  ,"tutor6.quota.usage": "Lihat penggunaan"
  ,"tutor6.quota.library": "Buka Perpustakaan"
  ,"tutor6.block.text": "Respons"
  ,"tutor6.block.teaching": "Penjelasan"
  ,"tutor6.block.example": "Contoh"
  ,"tutor6.block.question": "Periksa pemahaman Anda"
  ,"tutor6.block.exercise": "Latihan"
  ,"tutor6.block.quiz": "Kuis"
  ,"tutor6.block.summary": "Ringkasan"
  ,"tutor6.block.source": "Sumber"
  ,"tutor6.block.action": "Langkah berikutnya"
  ,"tutor6.block.progress": "Kemajuan"
  ,"tutor6.progress.title": "Yang berubah dalam sesi ini"
  ,"tutor6.progress.count": "{done} dari {total} langkah nyata selesai"
  ,"tutor6.progress.completed": "{done} langkah selesai"
  ,"tutor6.impact.concept-added": "Sebuah konsep ditambahkan ke Otak Anda"
  ,"tutor6.impact.connection-added": "Sebuah hubungan pengetahuan ditambahkan"
  ,"tutor6.impact.mastery": "Penguasaan konsep berubah"
  ,"tutor6.impact.memory": "Jadwal memori Anda berubah"
  ,"tutor6.impact.progress": "Kemajuan pembelajaran Anda berubah"
  ,"tutor6.result.title": "Pilih langkah berikutnya"
  ,"tutor6.result.detail": "Lanjutkan, perkuat, atau kembali ke konteks asal."
  ,"tutor6.result.continue": "Lanjutkan belajar"
  ,"tutor6.result.consolidate": "Perkuat dengan latihan"
  ,"tutor6.result.origin": "Kembali ke konteks awal"
  ,"strategy.reason.socratic": "Pertanyaan pemandu membantu Anda membangun penalaran sendiri sebelum Profesor mengonfirmasinya."
  ,"strategy.reason.project_based": "Hasil konkret memberi setiap gagasan kegunaan langsung."
  ,"strategy.reason.problem_solving": "Subjek ini menjadi lebih jelas dengan menyelesaikan satu langkah bermakna setiap kali."
  ,"strategy.reason.case_study": "Kasus realistis membuat prinsip yang mendasarinya lebih mudah diperiksa."
  ,"strategy.reason.task_based": "Menggunakan keterampilan dalam tugas nyata mendukung pembelajaran aktif."
  ,"strategy.reason.guided_demonstration": "Contoh yang dikerjakan memberi dukungan sebelum Anda mengambil alih secara bertahap."
  ,"strategy.reason.active_learning": "Aktivitas singkat dan sering membuat Anda tetap terlibat aktif."
  ,"strategy.reason.experiential": "Menerapkan gagasan dan merefleksikan hasilnya membantu memperdalam penguasaan."
  ,"library7.owned": "Yang saya miliki"
  ,"library7.mission": "Semua yang Anda berikan kepada Second Brain — tertata, dipahami, dan siap dipelajari."
  ,"library7.offline": "Perpustakaan sedang offline."
  ,"library7.stale.title": "Tampilan offline"
  ,"library7.stale.detail": "Ini data Perpustakaan terakhir yang tersimpan. Tindakan yang memerlukan Second Brain tersedia setelah tersambung kembali."
  ,"library7.import": "Impor"
  ,"library7.scan": "Pindai"
  ,"library7.batch": "Beberapa dokumen"
  ,"library7.ask": "Tanya sumber saya"
  ,"library7.search": "Cari berkas, subjek, atau ringkasan…"
  ,"library7.sort.newest": "Terbaru"
  ,"library7.sort.oldest": "Terlama"
  ,"library7.sort.title": "Judul"
  ,"library7.more": "Muat lebih banyak"
  ,"library7.favorite": "Tambahkan ke atau hapus dari favorit"
  ,"library7.conceptsCount": "{n} konsep terdeteksi"
  ,"library7.documentsCount": "{n} dokumen"
  ,"library7.collection.create": "Koleksi baru"
  ,"library7.collection.name": "Nama koleksi"
  ,"library7.collection.none": "Tanpa koleksi"
  ,"library7.empty.title": "Perpustakaan Anda masih kosong"
  ,"library7.empty.detail": "Tambahkan kursus, buku, artikel, atau catatan Anda. Second Brain dapat memahaminya, menghubungkannya ke otak Anda, dan membantu Anda mempelajarinya."
  ,"library7.empty.pipeline": "Yang terjadi setelah impor"
  ,"library7.empty.import": "Impor"
  ,"library7.empty.read": "Baca"
  ,"library7.empty.understand": "Pahami"
  ,"library7.empty.connect": "Hubungkan"
  ,"library7.empty.ready": "Siap"
  ,"library7.import.title": "Tambahkan sumber"
  ,"library7.import.file": "Berkas"
  ,"library7.import.text": "Catatan"
  ,"library7.import.url": "Halaman web"
  ,"library7.import.formats": "PDF, teks, Markdown, dan gambar menggunakan alur dokumen yang sama."
  ,"library7.import.choose": "Pilih berkas"
  ,"library7.quota.title": "Batas penggunaan tercapai"
  ,"library7.quota.reset": "Tersedia lagi: {date}."
  ,"library7.quota.usage": "Lihat penggunaan"
  ,"library7.quota.alternatives": "Masih tersedia"
  ,"document.pipeline.queued": "Menunggu untuk dibaca"
  ,"document.pipeline.reading": "Membaca dokumen"
  ,"document.pipeline.extracting": "Mengekstrak konten berguna"
  ,"document.pipeline.indexing": "Menyiapkan pencarian dokumen"
  ,"document.pipeline.connecting": "Menghubungkan konsep"
  ,"document.pipeline.completed": "Dokumen siap"
  ,"document.pipeline.failed": "Pemrosesan berhenti"
  ,"document.pipeline.noEstimate": "Langkah saat ini — tanpa perkiraan waktu yang andal"
  ,"document.pipeline.retry": "Coba lagi dokumen ini"
  ,"document.pipeline.retryOcr": "Baca kembali pindaian tersimpan"
  ,"document.pipeline.ocrFailed": "Pengenalan teks gagal. Halaman yang ditangkap masih tersimpan."
  ,"document.pipeline.ocrRetryHelp": "Halaman yang ditangkap dipertahankan. Tindakan ini mencoba lagi pengenalan teks; tidak mengindeks ulang dokumen kosong."
  ,"document.batch.title": "Impor beberapa dokumen"
  ,"document.batch.detail": "Setiap berkas diproses secara mandiri. Kegagalan tidak pernah membatalkan dokumen yang berhasil."
  ,"document.batch.choose": "Pilih dokumen"
  ,"document.batch.start": "Mulai impor"
  ,"document.batch.cancel": "Hentikan impor tertunda"
  ,"document.batch.summary": "{total} total · {done} siap · {processing} diproses · {failed} gagal"
  ,"document.batch.waiting": "Menunggu"
  ,"document.batch.uploading": "Mengunggah…"
  ,"document.batch.result": "Ringkasan kelompok"
  ,"document.batch.resultDetail": "{documents} dokumen siap · {concepts} konsep terdeteksi"
  ,"document.batch.subjects": "Subjek terdeteksi"
  ,"source.passage": "Bagian {n}"
  ,"source.close": "Tutup pratinjau sumber"
  ,"source.openDocument": "Buka dokumen"
  ,"library7.document.loading": "Membuka Kecerdasan Dokumen…"
  ,"library7.document.intelligence": "Kecerdasan Dokumen"
  ,"library7.document.processingHelp": "Anda dapat meninggalkan layar ini. Pemrosesan berlanjut tanpa kehilangan dokumen yang diimpor."
  ,"library7.document.previewLimited": "Pratinjau terbatas"
  ,"library7.document.previewLimitedDetail": "Hanya bagian pertama dimuat agar layar ini tetap responsif."
  ,"library7.backLibrary": "Kembali ke Perpustakaan"
  ,"library7.action.ask": "Tanya dokumen ini"
  ,"library7.action.learn": "Pelajari dokumen ini"
  ,"library7.action.more": "Tindakan lainnya"
  ,"library7.action.less": "Lebih sedikit tindakan"
  ,"library7.action.advanced": "Ubah atau atur"
  ,"library7.action.quiz": "Buat kuis"
  ,"library7.action.flashcards": "Buat kartu kilat"
  ,"library7.action.workspace": "Tambahkan ke karya"
  ,"library7.tab.document": "Dokumen"
  ,"library7.tab.understand": "Pahami"
  ,"library7.tab.ask": "Tanya"
  ,"library7.understood": "Yang dipahami Second Brain"
  ,"library7.summaryUnavailable": "Belum ada ringkasan. Dokumen asli tetap dapat diakses."
  ,"library7.concepts": "{n} konsep terdeteksi"
  ,"library7.noConcepts": "Mesin dokumen tidak mengembalikan konsep."
  ,"library7.brainImpact": "{known} sudah dikenal · {new} baru · {links} hubungan dibuat"
  ,"library7.brain.open": "Lihat di Otak Saya"
  ,"library7.resources": "Transformasi"
  ,"library7.resources.trace": "Dibuat dari {title}"
  ,"library7.compare.with": "Bandingkan dengan…"
  ,"library7.nba.title": "Langkah berikutnya yang disarankan"
  ,"library7.nba.learn": "Pelajari {n} konsep baru"
  ,"library7.nba.ask": "Tanya dokumen ini"
  ,"library7.nba.flashcards": "Buat kartu kilat"
  ,"library7.nba.brain": "Lihat hubungan Otak"
  ,"library7.ask.documentTitle": "Tanya dokumen ini"
  ,"library7.ask.noAnswer": "Sumber yang dipilih tidak memuat jawaban"
  ,"library7.ask.ownedSources": "Hanya sumber saya"
  ,"library7.ask.title": "Tanya sumber saya"
  ,"library7.ask.detail": "Pilih cakupan tepat. Second Brain menjawab hanya dari bagian yang ditemukan dan menampilkan sumbernya."
  ,"library7.ask.scope.all": "Semua"
  ,"library7.ask.scope.collection": "Koleksi"
  ,"library7.ask.scope.selected": "Dipilih"
  ,"library7.ask.noCollections": "Buat koleksi di Perpustakaan terlebih dahulu."
  ,"library7.ask.selectedCount": "{n} dipilih"
  ,"library7.ask.chooseScope": "Pilih sumber"
  ,"library7.ask.chooseScopeDetail": "Pilih koleksi atau setidaknya satu dokumen sebelum bertanya."
  ,"research10.eyebrow": "Riset"
  ,"research10.title": "Riset berbasis bukti"
  ,"research10.subtitle": "Temukan, periksa silang, analisis, dan sintesis apa yang benar-benar didukung oleh sumber Anda."
  ,"research10.question": "Pertanyaan riset"
  ,"research10.placeholder": "mis. Bandingkan TCP dan UDP menggunakan dokumen kursus saya."
  ,"research10.depth": "Kedalaman"
  ,"research10.depth.quick": "Pertanyaan cepat"
  ,"research10.depth.sourced": "Riset bersumber"
  ,"research10.depth.deep": "Riset mendalam"
  ,"research10.depth.quick.detail": "Jawaban ringkas dari sumber yang tersedia."
  ,"research10.depth.sourced.detail": "Analisis dengan sumber dan kutipan eksplisit."
  ,"research10.depth.deep.detail": "Rencana, koleksi, perbandingan, dan sintesis terstruktur."
  ,"research10.scope": "Sumber untuk dicari"
  ,"research10.scope.edit": "Pilih sumber · {count} dipilih"
  ,"research10.scope.apply": "Terapkan sumber"
  ,"research10.scope.brain": "Otak Saya"
  ,"research10.scope.library": "Perpustakaan Saya"
  ,"research10.scope.documents": "Dokumen dipilih"
  ,"research10.scope.collection": "Koleksi"
  ,"research10.scope.external": "Sumber eksternal"
  ,"research10.scope.web": "Web"
  ,"research10.webUnavailable": "Riset web tidak tersedia"
  ,"research10.webUnavailableDetail": "Tidak ada penyedia riset eksternal yang dikonfigurasi. Otak dan Perpustakaan Anda tetap tersedia."
  ,"research10.documents": "Pilih dokumen"
  ,"research10.documents.empty": "Tidak ada dokumen siap yang tersedia."
  ,"research10.collections": "Pilih koleksi"
  ,"research10.collections.empty": "Tidak ada koleksi yang tersedia."
  ,"research10.deep.costTitle": "Riset dengan penggunaan lebih tinggi"
  ,"research10.deep.costDetail": "Riset mendalam membaca lebih banyak sumber. Tinjau rencana sebelum memulai; tidak ada proses mahal yang dimulai diam-diam."
  ,"research10.reviewPlan": "Tinjau rencana riset"
  ,"research10.launch": "Mulai riset"
  ,"research10.cancel": "Batal"
  ,"research10.cancelled": "Riset dibatalkan. Sesi tersimpan tetap tersedia."
  ,"research10.plan.title": "Rencana riset yang diusulkan"
  ,"research10.plan.find": "Identifikasi sumber relevan dalam cakupan yang dipilih."
  ,"research10.plan.compare": "Bandingkan posisi yang didukung sumber tersebut."
  ,"research10.plan.verify": "Tampilkan kontradiksi dan celah bukti."
  ,"research10.plan.synthesize": "Hasilkan sintesis terstruktur dengan kutipan."
  ,"research10.running": "Riset sedang berlangsung"
  ,"research10.runningDetail": "Second Brain menanyakan sumber yang dipilih. Tidak ada perkiraan persentase penyelesaian."
  ,"research10.running.collect": "Mengumpulkan sumber terpilih"
  ,"research10.noSources": "Tidak ditemukan sumber pendukung"
  ,"research10.noSourcesDetail": "Second Brain tidak membuat jawaban karena sumber terpilih tidak mendukungnya. Ubah cakupan atau pertanyaan."
  ,"research10.partial": "Riset sebagian"
  ,"research10.partialDetail": "Beberapa sumber terpilih tidak tersedia. Hasil di bawah hanya menggunakan sumber yang benar-benar dibaca."
  ,"research10.synthesis": "Sintesis"
  ,"research10.keyPoints": "Poin utama"
  ,"research10.comparison": "Perbandingan sumber"
  ,"research10.agreements": "Kesepakatan"
  ,"research10.divergences": "Perbedaan"
  ,"research10.specificities": "Kekhususan"
  ,"research10.sources": "Sumber yang digunakan"
  ,"research10.stage.sources-found": "Sumber ditemukan"
  ,"research10.stage.sources-read": "Sumber dibaca"
  ,"research10.stage.compared": "Sumber dibandingkan"
  ,"research10.stage.synthesized": "Sintesis selesai"
  ,"research10.next": "Lanjutkan dari riset ini"
  ,"research10.next.reason": "Sintesis bersumber siap diubah menjadi pembelajaran aktif."
  ,"research10.action.learn": "Pelajari topik ini"
  ,"research10.action.workspace": "Tambahkan ke Ruang Kerja"
  ,"research10.action.deepen": "Perdalam"
  ,"research10.quota": "Batas riset tercapai"
  ,"research10.quotaDetail": "Riset tidak dimulai lagi. Anda tetap dapat menggunakan area non-AI atau meninjau penggunaan."
  ,"research10.openUsage": "Lihat penggunaan"
  ,"workspace10.eyebrow": "Ruang Kerja Akademis"
  ,"workspace10.title": "Bangun karya Anda"
  ,"workspace10.subtitle": "Atur rencana, tulis, cantumkan sumber, dan minta bantuan kontekstual tanpa melepaskan kepengarangan."
  ,"workspace10.create": "Buat ruang kerja"
  ,"workspace10.createAction": "Buat ruang kerja"
  ,"workspace10.template.memoire": "Tesis"
  ,"workspace10.template.tfc": "Proyek tahun akhir"
  ,"workspace10.template.dissertation": "Disertasi"
  ,"workspace10.template.report": "Laporan"
  ,"workspace10.template.article": "Artikel"
  ,"workspace10.template.assignment": "Tugas"
  ,"workspace10.template.academic-research": "Riset akademis"
  ,"workspace10.template.other": "Lainnya"
  ,"workspace10.field.title": "Judul"
  ,"workspace10.field.titlePlaceholder": "Beri nama karya ini"
  ,"workspace10.field.objective": "Tujuan"
  ,"workspace10.field.objectivePlaceholder": "Apa yang ingin Anda buktikan atau hasilkan?"
  ,"workspace10.field.due": "Tanggal jatuh tempo opsional"
  ,"workspace10.sources": "Sumber"
  ,"workspace10.sourceCount": "{n} dipilih"
  ,"workspace10.sourceMode.documents": "Dokumen"
  ,"workspace10.sourceMode.collections": "Koleksi"
  ,"workspace10.structure": "Struktur awal"
  ,"workspace10.defaultPlan.0": "Pendahuluan"
  ,"workspace10.defaultPlan.1": "Pengembangan"
  ,"workspace10.defaultPlan.2": "Kesimpulan"
  ,"workspace10.integrity": "Penalaran Anda tetap menjadi pusat"
  ,"workspace10.integrityDetail": "Second Brain membantu Anda memahami, mencantumkan, dan memverifikasi. Sistem tidak diam-diam menulis karya akademis lengkap untuk Anda."
  ,"workspace10.resume": "Lanjutkan ruang kerja"
  ,"workspace10.resumeDetail": "Rencana, konten, sumber, dan riwayat asisten Anda disimpan bersama."
  ,"workspace10.loading": "Memuat ruang kerja Anda…"
  ,"workspace10.empty": "Belum ada ruang kerja"
  ,"workspace10.emptyDetail": "Buat satu untuk mengatur karya nyata dan melanjutkannya nanti."
  ,"workspace10.open": "Lanjutkan"
  ,"workspace10.sourcesN": "{n} sumber"
  ,"workspace10.steps": "{done} dari {total} langkah nyata selesai"
  ,"workspace10.status.active": "Aktif"
  ,"workspace10.status.paused": "Dijeda"
  ,"workspace10.status.completed": "Selesai"
  ,"workspace10.status.archived": "Diarsipkan"
  ,"workspace10.opening": "Membuka ruang kerja Anda…"
  ,"workspace10.openingDetail": "Memuat rencana, draf, sumber, dan riwayat asisten yang tersimpan."
  ,"workspace10.unavailable": "Ruang kerja tidak tersedia"
  ,"workspace10.noObjective": "Belum ada tujuan yang ditambahkan."
  ,"workspace10.area.plan": "Rencana"
  ,"workspace10.area.work": "Karya"
  ,"workspace10.area.sources": "Sumber"
  ,"workspace10.area.assistant": "Asisten"
  ,"workspace10.plan": "Rencana"
  ,"workspace10.plan.new": "Bagian baru"
  ,"workspace10.plan.rename": "Ganti nama bagian"
  ,"workspace10.plan.remove": "Hapus"
  ,"workspace10.plan.add": "Tambahkan bagian"
  ,"workspace10.editor.heading": "Judul bagian"
  ,"workspace10.editor.list": "Daftar"
  ,"workspace10.editor.quote": "Kutipan"
  ,"workspace10.editor.reference": "Referensi"
  ,"workspace10.editor.placeholder": "Mulai menulis di sini…"
  ,"workspace10.editor.label": "Konten ruang kerja"
  ,"workspace10.save.idle": "Tidak berubah"
  ,"workspace10.save.dirty": "Perubahan belum disimpan"
  ,"workspace10.save.saving": "Menyimpan…"
  ,"workspace10.save.saved": "Tersimpan"
  ,"workspace10.save.error": "Kesalahan penyimpanan"
  ,"workspace10.save.offline": "Offline — perubahan tetap ada di layar"
  ,"workspace10.saveNow": "Simpan sekarang"
  ,"workspace10.conflict": "Ruang kerja ini berubah di tempat lain. Muat ulang sebelum menyimpan agar tidak ada pekerjaan yang tertimpa."
  ,"workspace10.sourcesEmpty": "Belum ada sumber yang dilampirkan."
  ,"workspace10.addSource": "Tambahkan sumber"
  ,"workspace10.assistant": "Asisten Second Brain"
  ,"workspace10.assistantDetail": "Bantuan kontekstual untuk karya ini. Draf Anda tetap menjadi area utama."
  ,"workspace10.assist.explain": "Jelaskan"
  ,"workspace10.assist.challenge": "Tantang"
  ,"workspace10.assist.suggest": "Sarankan"
  ,"workspace10.assist.structure": "Strukturkan"
  ,"workspace10.assist.compare-sources": "Bandingkan sumber"
  ,"workspace10.assist.check-coherence": "Periksa koherensi"
  ,"workspace10.assist.rephrase": "Ungkapkan ulang"
  ,"workspace10.selection": "Bagian yang dipilih"
  ,"workspace10.assistantQuestion": "Permintaan"
  ,"workspace10.assistantPlaceholder": "Tanyakan tentang karya saat ini atau bagian yang dipilih…"
  ,"workspace10.assistantSend": "Tanya asisten"
  ,"workspace10.next": "Tindakan terbaik berikutnya"
  ,"workspace10.nextSection": "Lanjutkan: {section}"
  ,"workspace10.nextSources": "Tambahkan sumber sebelum mengembangkan argumen."
  ,"workspace10.continue": "Lanjutkan menulis"
  ,"workspace10.askTutor": "Tanya Profesor"
  ,"workspace10.research": "Mulai riset"
  ,"languages11.eyebrow": "Bahasa & imersi"
  ,"languages11.title": "Latihan bahasa Anda"
  ,"languages11.description": "Satu ruang terarah untuk percakapan, kosakata, pemahaman, menulis, dan latihan lisan."
  ,"languages11.preferences": "Bahasa"
  ,"languages11.goal.empty": "Tambahkan tujuan agar latihan lebih tepat."
  ,"languages11.goal.label": "Tujuan pembelajaran"
  ,"languages11.goal.placeholder": "Perjalanan, ujian, pekerjaan, percakapan…"
  ,"languages11.level.title": "Tingkat Anda"
  ,"languages11.level.declared": "tingkat yang dinyatakan"
  ,"languages11.level.notEvaluated": "Tingkat ini Anda nyatakan sendiri. Belum ada penilaian yang mengevaluasinya."
  ,"languages11.metric.words": "kata"
  ,"languages11.metric.due": "jatuh tempo"
  ,"languages11.metric.sessions": "sesi"
  ,"languages11.metric.lessons": "pelajaran"
  ,"languages11.lastActivity": "Aktivitas terakhir: {date}"
  ,"languages11.lastActivity.none": "Belum ada aktivitas."
  ,"languages11.nba.badge": "LATIHAN BERIKUTNYA"
  ,"languages11.nba.start": "Mulai"
  ,"languages11.nba.review": "Tinjau {count} item kosakata"
  ,"languages11.nba.reasonDue": "Item ini jatuh tempo sekarang menurut jadwal memori FSRS Anda."
  ,"languages11.nba.firstConversation": "Mulai percakapan terpandu pertama"
  ,"languages11.nba.reasonStart": "Percakapan singkat membentuk konteks latihan aktif pertama Anda."
  ,"languages11.nba.lesson": "Bangun pelajaran terarah pertama"
  ,"languages11.nba.reasonLesson": "Anda sudah berlatih, tetapi belum ada pelajaran bahasa yang dibuat."
  ,"languages11.nba.conversation": "Lanjutkan dengan percakapan singkat"
  ,"languages11.nba.reasonPractice": "Produksi teratur menjaga bahasa tetap aktif."
  ,"languages11.resume.title": "Lanjutkan sesi bahasa"
  ,"languages11.resume.action": "Lanjutkan"
  ,"languages11.resume.empty": "Tidak ada sesi terputus"
  ,"languages11.resume.emptyDetail": "Latihan bermakna berikutnya akan muncul di sini setelah Anda mulai."
  ,"languages11.openSpace": "Buka ruang bahasa ini"
  ,"languages11.empty.title": "Pilih bahasa untuk memulai"
  ,"languages11.empty.detail": "Second Brain akan menghubungkan pelajaran, percakapan, dan ulasan kosakata FSRS nyata."
  ,"languages11.create.title": "Mulai belajar {language}"
  ,"languages11.create.action": "Buat ruang bahasa"
  ,"languages11.other.title": "Bahasa lain"
  ,"languages11.space.eyebrow": "Ruang bahasa terarah"
  ,"languages11.formats.title": "Format latihan"
  ,"languages11.formats.detail": "Pilih satu aktivitas; ruang kerja tetap berfokus padanya."
  ,"languages11.practice.focused": "Satu aktivitas setiap kali, dengan tingkat dan tujuan Anda dipertahankan."
  ,"languages11.practice.conversation": "Percakapan"
  ,"languages11.practice.vocabulary": "Kosakata"
  ,"languages11.practice.grammar": "Tata bahasa"
  ,"languages11.practice.conjugation": "Konjugasi"
  ,"languages11.practice.comprehension": "Pemahaman"
  ,"languages11.practice.reading": "Membaca"
  ,"languages11.practice.writing": "Menulis"
  ,"languages11.practice.pronunciation": "Pelafalan"
  ,"languages11.practice.oral": "Lisan"
  ,"languages11.practice.quiz": "Kuis"
  ,"languages11.conversation.detail": "Profesor AI yang sama menyesuaikan porsi bahasa target dan koreksi untuk sesi ini."
  ,"languages11.conversation.start": "Mulai percakapan"
  ,"languages11.oral.detail": "Berbicara dengan Profesor yang sama. Transkrip tetap terlihat dan dapat diedit sebelum dikirim."
  ,"languages11.oral.start": "Mulai latihan lisan"
  ,"languages11.scenario.label": "Skenario"
  ,"languages11.scenario.placeholder": "Di apotek, wawancara kerja, kehidupan sehari-hari…"
  ,"languages11.immersion.title": "Imersi"
  ,"languages11.immersion.guided": "Terpandu"
  ,"languages11.immersion.mixed": "Campuran"
  ,"languages11.immersion.full": "Penuh"
  ,"languages11.correction.title": "Koreksi"
  ,"languages11.correction.light": "Ringan"
  ,"languages11.correction.balanced": "Seimbang"
  ,"languages11.correction.detailed": "Terperinci"
  ,"languages11.generate": "Buat latihan"
  ,"languages11.quiz.detail": "Tinjau kosakata jatuh tempo dengan mesin memori FSRS yang ada."
  ,"languages11.quiz.action": "Buka ulasan bahasa"
  ,"languages11.review.return": "Kembali ke bahasa"
  ,"languages11.reading.history": "Buka riwayat Membaca"
  ,"languages11.writing.workspace": "Buka ruang kerja Menulis lengkap"
  ,"languages11.writing.instruction": "Tulis dalam {language}."
  ,"languages11.offline.title": "Suara dan AI tidak tersedia saat offline"
  ,"languages11.offline.detail": "Draf lokal Anda dipertahankan. Sambungkan kembali sebelum mentranskripsikan atau bertanya kepada Profesor."
  ,"rlle.ui.hub.learn": "Pelajari {language}"
  ,"rlle.ui.hub.resume": "Lanjutkan kursus {language} saya"
  ,"rlle.ui.hub.courseDetail": "Kursus CEFR terstruktur dan adaptif yang dibangun di sekitar kebutuhan nyata Anda."
  ,"rlle.ui.hub.openCourse": "Buka kursus saya"
  ,"rlle.ui.hub.courseUnavailable": "Layanan kursus belum tersedia. Alat latihan Anda tetap dapat diakses."
  ,"rlle.ui.course.eyebrow": "MESIN BAHASA KEHIDUPAN NYATA"
  ,"rlle.ui.course.title": "Kursus {language}"
  ,"rlle.ui.course.subtitle": "Belajar secara bertahap, lalu buktikan kemampuan Anda dalam situasi nyata."
  ,"rlle.ui.course.loading": "Memuat kursus Anda…"
  ,"rlle.ui.course.notStarted": "Bangun kursus saya"
  ,"rlle.ui.course.notStartedDetail": "Pilih titik awal dan tujuan nyata Anda. Fondasi inti tidak pernah dihapus."
  ,"rlle.ui.course.startZero": "Mulai dari nol"
  ,"rlle.ui.course.startDeclared": "Mulai pada tingkat yang saya nyatakan"
  ,"rlle.ui.course.declaredWarning": "{level} adalah tingkat yang dinyatakan, bukan hasil evaluasi."
  ,"rlle.ui.course.targetLevel": "Tingkat target"
  ,"rlle.ui.course.goalDomain": "Prioritas kehidupan nyata"
  ,"rlle.ui.course.goal.general": "Umum"
  ,"rlle.ui.course.goal.travel": "Perjalanan"
  ,"rlle.ui.course.goal.work": "Pekerjaan"
  ,"rlle.ui.course.goal.studies": "Studi"
  ,"rlle.ui.course.goal.social": "Kehidupan sosial"
  ,"rlle.ui.course.start": "Mulai kursus saya"
  ,"rlle.ui.course.resume": "Lanjutkan kursus saya"
  ,"rlle.ui.course.pause": "Jeda kursus"
  ,"rlle.ui.course.current": "Lanjutkan pelajaran saat ini"
  ,"rlle.ui.course.curriculum": "Jalur pembelajaran CEFR"
  ,"rlle.ui.course.curriculumDetail": "Unit tujuan diprioritaskan, sementara keseluruhan kerangka pembelajaran dipertahankan."
  ,"rlle.ui.course.goalPriority": "Tujuan Anda"
  ,"rlle.ui.course.core": "Fondasi"
  ,"rlle.ui.course.unit.open": "Buka unit"
  ,"rlle.ui.course.status.locked": "Terkunci"
  ,"rlle.ui.course.status.available": "Tersedia"
  ,"rlle.ui.course.status.in-progress": "Sedang berlangsung"
  ,"rlle.ui.course.status.completed": "Selesai"
  ,"rlle.ui.course.status.untracked": "Belum dimulai"
  ,"rlle.ui.course.progress": "Kemajuan terukur"
  ,"rlle.ui.course.progressUnits": "{done} dari {total} unit selesai"
  ,"rlle.ui.course.progressUnknown": "Belum ada kemajuan kursus yang terukur."
  ,"rlle.ui.course.lastActivity": "Aktivitas terakhir: {date}"
  ,"rlle.ui.course.noActivity": "Belum ada aktivitas kursus"
  ,"rlle.ui.course.levels": "Tingkat CEFR"
  ,"rlle.ui.course.level.declared": "Dinyatakan"
  ,"rlle.ui.course.level.estimated": "Diperkirakan"
  ,"rlle.ui.course.level.evaluated": "Dievaluasi"
  ,"rlle.ui.course.level.target": "Target"
  ,"rlle.ui.course.notEvaluated": "Belum dievaluasi"
  ,"rlle.ui.course.dimensions": "Keterampilan yang diukur dengan bukti"
  ,"rlle.ui.course.evidenceCount": "{count} item bukti"
  ,"rlle.ui.course.review": "Tinjau bahasa ini"
  ,"rlle.ui.course.brain": "Lihat pengetahuan bahasa di Otak Saya"
  ,"rlle.ui.course.professor": "Tanya Profesor"
  ,"rlle.ui.course.offline": "Keadaan kursus terbaru tidak dapat disegarkan."
  ,"rlle.ui.course.preferences.title": "Preferensi kursus"
  ,"rlle.ui.course.preferences.detail": "Sesuaikan imersi dan intensitas koreksi tanpa kehilangan kemajuan."
  ,"rlle.ui.course.preferences.save": "Simpan preferensi"
  ,"rlle.ui.course.preferences.saved": "Preferensi kursus disimpan."
  ,"rlle.ui.course.preferences.error": "Preferensi tidak dapat disimpan."
  ,"rlle.ui.review.returnCourse": "Kembali ke kursus saya"
  ,"rlle.ui.brain.evidenceTitle": "Kemampuan bahasa terukur"
  ,"rlle.ui.brain.evidenceDetail": "Hanya bukti teramati dari kursus bahasa ini yang ditampilkan."
  ,"rlle.ui.brain.backCourse": "Buka kursus bahasa"
  ,"rlle.ui.lesson.eyebrow": "PELAJARAN TERSTRUKTUR"
  ,"rlle.ui.lesson.title": "Pelajaran"
  ,"rlle.ui.lesson.intro": "Tujuan komunikatif"
  ,"rlle.ui.lesson.start": "Mulai pelajaran ini"
  ,"rlle.ui.lesson.resume": "Lanjutkan pelajaran ini"
  ,"rlle.ui.lesson.complete": "Selesaikan pelajaran"
  ,"rlle.ui.lesson.completeStage": "Selesaikan langkah ini"
  ,"rlle.ui.lesson.completed": "Pelajaran selesai. Kemampuan fungsional masih memerlukan bukti nyata."
  ,"rlle.ui.lesson.openGenerated": "Buka konten pelajaran"
  ,"rlle.ui.lesson.path": "Urutan pelajaran"
  ,"rlle.ui.lesson.stageAction": "Latih langkah ini"
  ,"rlle.ui.lesson.noActive": "Unit ini belum memiliki pelajaran aktif."
  ,"rlle.ui.lesson.proofNote": "Menyelesaikan pelajaran tidak pernah memvalidasi kemampuan Dapat-Dilakukan dengan sendirinya."
  ,"rlle.ui.mission.eyebrow": "MISI DUNIA"
  ,"rlle.ui.mission.title": "Misi kehidupan nyata"
  ,"rlle.ui.mission.subtitle": "Selesaikan tugas komunikatif dengan Profesor. Keberhasilan memerlukan bukti teramati, bukan skor kuis."
  ,"rlle.ui.mission.start": "Mulai misi"
  ,"rlle.ui.mission.resume": "Lanjutkan misi"
  ,"rlle.ui.mission.minimum": "Mulai {level}"
  ,"rlle.ui.mission.survival": "Keterampilan bertahan dalam komunikasi"
  ,"rlle.ui.mission.notAvailable": "Pelacakan misi belum tersedia dari server."
  ,"rlle.ui.mission.dynamic": "Profesor bereaksi terhadap jawaban nyata Anda dan memeriksa apakah tugas telah diselesaikan."
  ,"rlle.ui.mission.all": "Semua"
  ,"rlle.ui.cando.eyebrow": "PETA DAPAT-DILAKUKAN"
  ,"rlle.ui.cando.title": "Yang benar-benar dapat saya lakukan"
  ,"rlle.ui.cando.subtitle": "Kemampuan divalidasi hanya oleh misi yang berhasil, penilaian, atau aktivitas terkontrol."
  ,"rlle.ui.cando.open": "Buka peta Dapat-Dilakukan saya"
  ,"rlle.ui.cando.status.not-evaluated": "Belum dievaluasi"
  ,"rlle.ui.cando.status.in-progress": "Bukti sedang dikumpulkan"
  ,"rlle.ui.cando.status.validated": "Terbukti"
  ,"rlle.ui.cando.evidence": "Bukti"
  ,"rlle.ui.cando.noEvidence": "Belum ada bukti teramati."
  ,"rlle.ui.cando.source.mission": "Misi Dunia"
  ,"rlle.ui.cando.source.assessment": "Penilaian"
  ,"rlle.ui.cando.source.controlled-activity": "Aktivitas terkontrol"
  ,"rlle.ui.recovery.title": "Pemulihan terarah"
  ,"rlle.ui.recovery.subtitle": "Hanya kesulitan yang benar-benar diamati selama aktivitas yang muncul di sini."
  ,"rlle.ui.recovery.empty": "Tidak ada kesulitan terkonfirmasi untuk diperbaiki."
  ,"rlle.ui.recovery.gaps": "Celah fungsional"
  ,"rlle.ui.recovery.mistakes": "Memori Kesalahan"
  ,"rlle.ui.recovery.repair": "Siklus Perbaikan"
  ,"rlle.ui.recovery.occurrences": "{count} kejadian teramati"
  ,"rlle.ui.recovery.next": "Langkah perbaikan saat ini: {stage}"
  ,"rlle.ui.common.retry": "Coba lagi"
  ,"rlle.ui.common.backCourse": "Kembali ke kursus"
  ,"rlle.ui.common.error": "Kursus tidak dapat dimuat."
  ,"rlle.ui.category.travel": "Perjalanan"
  ,"rlle.ui.category.work": "Pekerjaan"
  ,"rlle.ui.category.studies": "Studi"
  ,"rlle.ui.category.social": "Kehidupan sosial"
  ,"rlle.ui.dimension.vocabulary": "Kosakata"
  ,"rlle.ui.dimension.grammar": "Tata bahasa"
  ,"rlle.ui.dimension.conversation": "Percakapan"
  ,"rlle.ui.dimension.listening": "Mendengarkan"
  ,"rlle.ui.dimension.reading": "Membaca"
  ,"rlle.ui.dimension.writing": "Menulis"
  ,"rlle.ui.dimension.interaction": "Interaksi"
  ,"rlle.ui.dimension.pronunciation": "Pelafalan"
  ,"rlle.ui.dimension.mediation": "Mediasi"
  ,"rlle.ui.dimension.status.not-evaluated": "Belum dievaluasi"
  ,"rlle.ui.dimension.status.emerging": "Mulai berkembang"
  ,"rlle.ui.dimension.status.demonstrated": "Terbukti"
  ,"rlle.ui.dimension.status.consistent": "Konsisten"
  ,"rlle.ui.strand.vocabulary": "Kosakata"
  ,"rlle.ui.strand.verbs": "Kata kerja"
  ,"rlle.ui.strand.conjugation": "Konjugasi"
  ,"rlle.ui.strand.grammar": "Tata bahasa"
  ,"rlle.ui.strand.listening": "Mendengarkan"
  ,"rlle.ui.strand.reading": "Membaca"
  ,"rlle.ui.strand.conversation": "Percakapan"
  ,"rlle.ui.strand.interaction": "Interaksi"
  ,"rlle.ui.strand.pronunciation": "Pelafalan"
  ,"rlle.ui.strand.writing": "Menulis"
  ,"rlle.ui.strand.mediation": "Mediasi"
  ,"rlle.ui.stage.communicative-objective": "Tujuan komunikatif"
  ,"rlle.ui.stage.vocabulary": "Kosakata dalam konteks"
  ,"rlle.ui.stage.grammar-verbs": "Tata bahasa dan kata kerja"
  ,"rlle.ui.stage.example": "Contoh model"
  ,"rlle.ui.stage.comprehension": "Pemahaman"
  ,"rlle.ui.stage.practice": "Latihan terpandu"
  ,"rlle.ui.stage.oral": "Berbicara dahulu"
  ,"rlle.ui.stage.writing": "Menulis"
  ,"rlle.ui.stage.verification": "Periksa"
  ,"rlle.ui.stage.review": "Ulasan memori"
  ,"rlle.ui.stage.status.pending": "Untuk dikerjakan"
  ,"rlle.ui.stage.status.active": "Sekarang"
  ,"rlle.ui.stage.status.completed": "Selesai"
  ,"rlle.ui.stage.status.skipped": "Tidak diperlukan"
  ,"rlle.ui.repair.explain": "Penjelasan"
  ,"rlle.ui.repair.guided-practice": "Latihan terpandu"
  ,"rlle.ui.repair.retry-now": "Coba lagi sekarang"
  ,"rlle.ui.repair.reuse-later": "Gunakan kembali nanti"
  ,"rlle.ui.repair.consolidate": "Perkuat dalam Revisi"
  ,"rlle.ui.survival.ask-repeat": "Minta seseorang mengulangi"
  ,"rlle.ui.survival.ask-slow-down": "Minta seseorang memperlambat bicara"
  ,"rlle.ui.survival.ask-definition": "Minta definisi"
  ,"rlle.ui.survival.rephrase": "Ungkapkan ulang"
  ,"rlle.ui.survival.check-understanding": "Periksa pemahaman"
  ,"rlle.ui.survival.explain-unknown-word": "Jelaskan kata yang tidak dikenal"
  ,"rlle.ui.survival.buy-thinking-time": "Dapatkan waktu untuk menjawab"
  ,"rlle.unit.a1FirstContact": "Kontak pertama"
  ,"rlle.objective.a1FirstContact": "Perkenalkan diri dan tukarkan informasi pribadi penting."
  ,"rlle.unit.a1DailyNeeds": "Kebutuhan sehari-hari"
  ,"rlle.objective.a1DailyNeeds": "Tangani kebutuhan harian sederhana dengan kata berguna dan bentuk dasar."
  ,"rlle.unit.a1Survival": "Perlengkapan bertahan dalam komunikasi"
  ,"rlle.objective.a1Survival": "Pertahankan percakapan meski Anda tidak memahami semuanya."
  ,"rlle.unit.a2Routines": "Rutinitas dan rencana"
  ,"rlle.objective.a2Routines": "Jelaskan kebiasaan, aktivitas, dan rencana masa depan sederhana."
  ,"rlle.unit.a2PastPlans": "Pengalaman masa lalu"
  ,"rlle.objective.a2PastPlans": "Ceritakan kisah sederhana dan hubungkan peristiwa masa lalu."
  ,"rlle.unit.a2TravelStudy": "Dasar perjalanan dan studi"
  ,"rlle.objective.a2TravelStudy": "Temukan informasi dan selesaikan tugas umum dalam perjalanan atau studi."
  ,"rlle.unit.b1Experiences": "Ceritakan kisah Anda"
  ,"rlle.objective.b1Experiences": "Jelaskan pengalaman dengan kronologi jelas dan detail berguna."
  ,"rlle.unit.b1WorkTravel": "Bertindak mandiri"
  ,"rlle.objective.b1WorkTravel": "Tangani situasi kerja dan perjalanan umum tanpa naskah."
  ,"rlle.unit.b1Opinions": "Jelaskan pendapat"
  ,"rlle.objective.b1Opinions": "Pahami sudut pandang dan pertahankan pendapat Anda dengan alasan."
  ,"rlle.unit.b2Collaboration": "Berkolaborasi dengan lancar"
  ,"rlle.objective.b2Collaboration": "Berpartisipasi aktif dalam rapat, diskusi, dan presentasi."
  ,"rlle.unit.b2Argument": "Bangun argumen"
  ,"rlle.objective.b2Argument": "Bandingkan posisi, beri nuansa pada klaim, dan susun respons persuasif."
  ,"rlle.unit.b2Professional": "Produksi profesional"
  ,"rlle.objective.b2Professional": "Tulis dan berbicara dengan ragam yang diharapkan dalam lingkungan profesional."
  ,"rlle.unit.c1ComplexInput": "Pahami masukan kompleks"
  ,"rlle.objective.c1ComplexInput": "Ekstrak, hubungkan, dan rumuskan ulang gagasan dari materi yang menantang."
  ,"rlle.unit.c1Influence": "Memengaruhi dan bernegosiasi"
  ,"rlle.objective.c1Influence": "Sesuaikan bahasa secara tepat untuk membujuk, berkolaborasi, dan menyelesaikan perselisihan."
  ,"rlle.unit.c1Production": "Hasilkan dengan presisi"
  ,"rlle.objective.c1Production": "Buat karya jelas dan bernuansa untuk audiens akademis dan profesional."
  ,"rlle.unit.c2Nuance": "Nuansa dan makna tersirat"
  ,"rlle.objective.c2Nuance": "Pahami perbedaan halus, ragam, dan makna tersirat."
  ,"rlle.unit.c2Adaptation": "Beradaptasi secara langsung"
  ,"rlle.objective.c2Adaptation": "Mediasi dan rumuskan ulang secara alami untuk audiens dan situasi berbeda."
  ,"rlle.unit.c2Mastery": "Penguasaan terpadu"
  ,"rlle.objective.c2Mastery": "Gabungkan setiap keterampilan dengan presisi, fleksibilitas, dan kendali komunikatif."
  ,"rlle.mission.travelAirport": "Menavigasi bandara"
  ,"rlle.missionObjective.travelAirport": "Pahami petunjuk dan capai gerbang yang benar."
  ,"rlle.mission.travelHotel": "Selesaikan masalah hotel"
  ,"rlle.missionObjective.travelHotel": "Jelaskan masalah dan sepakati solusi praktis."
  ,"rlle.mission.travelRestaurant": "Pesan di restoran"
  ,"rlle.missionObjective.travelRestaurant": "Tanyakan menu dan buat pesanan yang sesuai."
  ,"rlle.mission.travelTransport": "Gunakan transportasi lokal"
  ,"rlle.missionObjective.travelTransport": "Tanyakan rute, pahami opsi, dan konfirmasikan tujuan Anda."
  ,"rlle.mission.travelDirections": "Tanyakan arah"
  ,"rlle.missionObjective.travelDirections": "Tanyakan ke mana harus pergi dan pastikan bahwa Anda memahaminya."
  ,"rlle.mission.travelEmergency": "Tangani keadaan darurat"
  ,"rlle.missionObjective.travelEmergency": "Jelaskan masalah mendesak dan pahami petunjuk berikutnya."
  ,"rlle.mission.workInterview": "Ikuti wawancara kerja"
  ,"rlle.missionObjective.workInterview": "Presentasikan pengalaman Anda dan jawab pertanyaan lanjutan secara alami."
  ,"rlle.mission.workMeeting": "Berpartisipasi dalam rapat"
  ,"rlle.missionObjective.workMeeting": "Ikuti diskusi, sumbangkan gagasan, dan perjelas tindakan."
  ,"rlle.mission.workPresentation": "Presentasikan proyek"
  ,"rlle.missionObjective.workPresentation": "Jelaskan proyek dengan jelas dan tanggapi pertanyaan."
  ,"rlle.mission.workEmail": "Tulis surel profesional"
  ,"rlle.missionObjective.workEmail": "Tulis pesan ringkas dengan nada dan permintaan yang sesuai."
  ,"rlle.mission.workNegotiation": "Negosiasikan kesepakatan"
  ,"rlle.missionObjective.workNegotiation": "Nyatakan prioritas, tanggapi keberatan, dan capai kompromi."
  ,"rlle.mission.studiesLecture": "Ikuti kuliah"
  ,"rlle.missionObjective.studiesLecture": "Identifikasi gagasan utama dan jelaskan dengan lebih sederhana."
  ,"rlle.mission.studiesSynthesis": "Sintesis sumber kompleks"
  ,"rlle.missionObjective.studiesSynthesis": "Hubungkan masukan lisan dan tertulis yang menantang, lalu mediasikan secara akurat."
  ,"rlle.mission.studiesPresentation": "Berikan presentasi akademis"
  ,"rlle.missionObjective.studiesPresentation": "Susun penjelasan dan jawab audiens."
  ,"rlle.mission.studiesDiscussion": "Ikuti diskusi kelas"
  ,"rlle.missionObjective.studiesDiscussion": "Kembangkan gagasan lain dan benarkan kontribusi Anda."
  ,"rlle.mission.studiesTeacher": "Berbicara dengan pengajar"
  ,"rlle.missionObjective.studiesTeacher": "Minta klarifikasi dan pastikan yang diharapkan."
  ,"rlle.mission.studiesAdministration": "Tangani administrasi"
  ,"rlle.missionObjective.studiesAdministration": "Pahami prosedur dan minta informasi yang Anda perlukan."
  ,"rlle.mission.socialIntroduction": "Perkenalkan diri"
  ,"rlle.missionObjective.socialIntroduction": "Mulai percakapan ramah dan bagikan informasi dasar."
  ,"rlle.mission.socialChat": "Pertahankan percakapan"
  ,"rlle.missionObjective.socialChat": "Tanggapi, ajukan pertanyaan lanjutan, dan perbaiki kesalahpahaman."
  ,"rlle.mission.socialStory": "Ceritakan kisah"
  ,"rlle.missionObjective.socialStory": "Ceritakan peristiwa dengan urutan jelas dan pertahankan perhatian pendengar."
  ,"rlle.mission.socialInvitation": "Undang seseorang"
  ,"rlle.missionObjective.socialInvitation": "Usulkan rencana, bahas detail, dan tanggapi dengan sopan."
  ,"rlle.mission.socialDebate": "Debatkan gagasan"
  ,"rlle.missionObjective.socialDebate": "Pertahankan posisi sambil menanggapi sudut pandang lain."
  ,"rlle.canDo.travelOrder": "Memesan di restoran"
  ,"rlle.canDo.travelDirections": "Menanyakan dan memahami arah"
  ,"rlle.canDo.travelHotelProblem": "Menjelaskan masalah di hotel"
  ,"rlle.canDo.travelTransport": "Mengatur perjalanan dengan transportasi lokal"
  ,"rlle.canDo.travelEmergency": "Menjelaskan masalah mendesak"
  ,"rlle.canDo.workInterview": "Memperkenalkan diri dalam wawancara kerja"
  ,"rlle.canDo.workMeeting": "Berpartisipasi dalam rapat"
  ,"rlle.canDo.workPresent": "Mempresentasikan proyek"
  ,"rlle.canDo.workEmail": "Menulis surel profesional"
  ,"rlle.canDo.workNegotiate": "Menegosiasikan kesepakatan"
  ,"rlle.canDo.studiesRequest": "Meminta bantuan akademis atau administratif"
  ,"rlle.canDo.studiesFollowLecture": "Mengikuti kuliah dan mengidentifikasi gagasan utamanya"
  ,"rlle.canDo.studiesDiscuss": "Berpartisipasi dalam diskusi kelas"
  ,"rlle.canDo.studiesPresent": "Memberikan presentasi akademis"
  ,"rlle.canDo.studiesSynthesise": "Merangkum dan menjelaskan informasi kompleks"
  ,"rlle.canDo.socialIntroduce": "Memperkenalkan diri secara alami"
  ,"rlle.canDo.socialClarify": "Memperbaiki kesalahpahaman"
  ,"rlle.canDo.socialInvite": "Mengundang seseorang dan mengatur rencana"
  ,"rlle.canDo.socialTellStory": "Menceritakan pengalaman masa lalu"
  ,"rlle.canDo.socialDefendOpinion": "Mempertahankan pendapat dengan alasan"
  ,"rlle.demo.objectiveInternationalWork": "Bekerja secara internasional"
  ,"rlle.ui.badge": "KURSUS TERSTRUKTUR"
  ,"rlle.ui.cefr": "CEFR"
  ,"rlle.ui.nba.badge": "TINDAKAN BAHASA BERIKUTNYA"
  ,"rlle.ui.nba.review": "Tinjau {count} item bahasa jatuh tempo"
  ,"rlle.ui.nba.reviewReason": "{count} item FSRS nyata jatuh tempo sekarang."
  ,"rlle.ui.nba.reviewAction": "Tinjau sekarang"
  ,"rlle.ui.nba.retryMission": "Coba lagi tugas kehidupan nyata"
  ,"rlle.ui.nba.retryMissionReason": "Kesulitan yang diamati memiliki mikropelajaran dan siap dicoba lagi."
  ,"rlle.ui.nba.resumeMission": "Lanjutkan Misi Dunia"
  ,"rlle.ui.nba.resumeMissionReason": "Misi kehidupan nyata ini masih aktif."
  ,"rlle.ui.nba.resumeLesson": "Lanjutkan pelajaran bahasa"
  ,"rlle.ui.nba.resumeLessonReason": "Satu langkah pelajaran terstruktur masih aktif."
  ,"rlle.ui.nba.nextLesson": "Lanjutkan kursus terstruktur"
  ,"rlle.ui.nba.nextLessonReason": "Ini unit berikutnya yang belum selesai dalam kurikulum CEFR."
  ,"rlle.ui.nba.nextLessonAction": "Mulai pelajaran berikutnya"
  ,"rlle.ui.course.status.paused": "Dijeda"
  ,"rlle.ui.course.status.not-started": "Belum dimulai"
  ,"rlle.ui.mission.category": "Kategori misi"
  ,"rlle.ui.mission.modality": "Mode latihan"
  ,"rlle.ui.mission.current": "Misi sedang berlangsung"
  ,"rlle.ui.mission.starting": "Memulai misi…"
  ,"rlle.ui.mission.status.active": "Sedang berlangsung"
  ,"rlle.ui.mission.status.paused": "Dijeda"
  ,"rlle.ui.mission.status.succeeded": "Berhasil"
  ,"rlle.ui.mission.status.needs-retry": "Coba lagi"
  ,"rlle.ui.mission.feedback.succeeded": "Misi diselesaikan dengan bukti teramati."
  ,"rlle.ui.mission.feedback.repair": "Kesulitan tertentu terdeteksi. Gunakan mikropelajaran, lalu coba lagi."
  ,"rlle.ui.mission.feedback.proof": "BUKTI KOMUNIKATIF"
  ,"rlle.ui.mission.feedback.microLesson": "MIKROPELAJARAN"
  ,"rlle.ui.mission.feedback.example": "Contoh"
  ,"rlle.ui.modality.text": "Tulis"
  ,"rlle.ui.modality.voice": "Bicara"
  ,"rlle.ui.modality.mixed": "Tulis dan bicara"
  ,"rlle.ui.cando.notAvailable": "Peta Dapat-Dilakukan belum tersedia dari server."
  ,"rlle.ui.cando.all": "Semua kemampuan"
  ,"rlle.ui.cando.summary": "Hanya bukti teramati yang dapat memvalidasi kemampuan."
  ,"rlle.ui.cando.validatedCount": "{count} terbukti"
  ,"rlle.ui.cando.measuredCount": "{count} dinilai"
  ,"rlle.ui.gap.status.observed": "Diamati sekali"
  ,"rlle.ui.gap.status.repeated": "Diamati lagi"
  ,"rlle.ui.gap.status.confirmed": "Dikonfirmasi"
  ,"rlle.ui.gap.status.repairing": "Sedang diperbaiki"
  ,"rlle.ui.gap.status.consolidated": "Diperkuat"
  ,"rlle.ui.dimension.conjugation": "Konjugasi"
  ,"rlle.ui.dimension.fluency": "Kelancaran"
  ,"rlle.ui.dimension.formulation": "Perumusan"
  ,"tutor6.state.paused": "Perekaman dijeda"
  ,"scan.openDocument": "Buka Kecerdasan Dokumen"
  ,"scan.captured": "Halaman disimpan dengan aman"
  ,"scan.capturedDetail": "Hasil tangkapan dipertahankan. Analisis teks tersedia saat penyedia Vision resmi aktif."
  ,"sub.usageAction": "Lihat penggunaan dan kuota"
  ,"sub.availablePlans": "Paket individu"
  ,"sub.availablePlansDetail": "Bandingkan batas yang saat ini dikonfigurasi untuk setiap penawaran."
  ,"sub.notAvailable": "Saat ini tidak tersedia"
  ,"sub.periodEnd": "Periode saat ini berakhir"
  ,"sub.trialEnds": "Uji coba berakhir"
  ,"sub.openInvoice": "Buka faktur"
  ,"sub.upgrade": "Tingkatkan ke"
  ,"sub.partial": "Beberapa informasi penagihan sementara tidak tersedia. Tidak ada langganan yang diubah."
  ,"usage.loading": "Memuat penggunaan Anda…"
  ,"usage.remaining": "Tersisa"
  ,"usage.reset": "Direset"
  ,"usage.mb": "MB"
  ,"usage.kb": "KB"
  ,"usage.managePlan": "Kelola langganan"
  ,"usage.currentPlan": "Paket saat ini"
  ,"usage.planUnavailable": "Informasi paket sementara tidak tersedia."
  ,"usage.limitReached": "Batas paket telah tercapai"
  ,"usage.limitResetKnown": "Penghitung ini tersedia lagi pada {date}."
  ,"usage.limitNoReset": "Batas ini mencerminkan penggunaan saat ini. Kosongkan kapasitas atau ubah paket untuk melanjutkan tindakan."
  ,"usage.nonAiAvailable": "Bagian lain Second Brain tetap tersedia, termasuk fitur yang tidak memakai kuota ini."
  ,"usage.partial": "Beberapa informasi paket atau penggunaan tidak dapat disegarkan. Nilai yang ditampilkan adalah yang terbaru."
  ,"priv.controls": "Kontrol terkait"
  ,"priv.memory": "Memori AI"
  ,"priv.memoryHelp": "Tinjau yang diingat Second Brain dan kontrol yang terkait dengan memori tersebut."
  ,"priv.documents": "Dokumen dan sumber"
  ,"priv.documentsHelp": "Tinjau sumber yang Anda impor ke perpustakaan."
  ,"landing.nav.menu": "Menu"
  ,"landing12.seo.title": "Second Brain — sistem pembelajaran cerdas pribadi Anda"
  ,"landing12.seo.description": "Belajar, memahami, berlatih, mengingat, dan menghasilkan dengan satu sistem terhubung: dokumen, Profesor AI, kembaran kognitif, revisi, riset, bahasa, dan ruang kerja Anda."
  ,"landing12.brand": "Second Brain"
  ,"landing12.signature": "Satu produk. Satu pengalaman."
  ,"landing12.nav.product": "Produk"
  ,"landing12.nav.how": "Cara kerja"
  ,"landing12.nav.languages": "Bahasa"
  ,"landing12.nav.pricing": "Harga"
  ,"landing12.nav.download": "Unduh"
  ,"landing12.nav.faq": "FAQ"
  ,"landing12.nav.contact": "Kontak"
  ,"landing12.nav.menu": "Buka navigasi"
  ,"landing12.nav.close": "Tutup navigasi"
  ,"landing12.cta.signin": "Masuk"
  ,"landing12.cta.start": "Mulai gratis"
  ,"landing12.cta.startShort": "Mulai"
  ,"landing12.cta.how": "Lihat cara kerjanya"
  ,"landing12.cta.download": "Unduh Second Brain"
  ,"landing12.cta.language": "Pelajari bahasa"
  ,"landing12.cta.next": "Langkah berikutnya"
  ,"landing12.cta.restart": "Putar ulang perjalanan"
  ,"landing12.demo.label": "Demonstrasi produk"
  ,"landing12.demo.disclaimer": "Contoh publik statis. Tanpa data pengguna nyata dan tanpa pemrosesan simulasi."
  ,"landing12.hero.eyebrow": "Sistem pembelajaran cerdas pribadi"
  ,"landing12.hero.title": "Belajar. Pahami. Berlatih. Ingat. Maju."
  ,"landing12.hero.subtitle": "Berikan pertanyaan, dokumen, atau tujuan kepada Second Brain. Sistem membangun konteks, mengajar, membantu berlatih, memperkuat yang penting, dan menyarankan langkah berikutnya."
  ,"landing12.hero.availability": "Tersedia di Web · aplikasi seluler dan desktop sedang disiapkan"
  ,"landing12.hero.scene.product": "SECOND BRAIN · SATU KONTEKS"
  ,"landing12.hero.scene.tabsLabel": "Tahap demonstrasi produk"
  ,"landing12.hero.scene.question.tab": "Niat"
  ,"landing12.hero.scene.context.tab": "Konteks"
  ,"landing12.hero.scene.teaching.tab": "Pengalaman"
  ,"landing12.hero.scene.next.tab": "Tindakan berikutnya"
  ,"landing12.hero.scene.question.title": "Apa yang ingin Anda pahami?"
  ,"landing12.hero.scene.question.message": "Bantu saya memahami respirasi seluler untuk ujian."
  ,"landing12.hero.scene.question.intent": "Pahami"
  ,"landing12.hero.scene.question.source": "Kursus biologi.pdf"
  ,"landing12.hero.scene.context.title": "Second Brain menyatukan konteks yang berguna"
  ,"landing12.hero.scene.context.brain": "Otak Saya"
  ,"landing12.hero.scene.context.document": "Kursus biologi.pdf"
  ,"landing12.hero.scene.context.goal": "Tujuan ujian"
  ,"landing12.hero.scene.context.concept": "Respirasi seluler"
  ,"landing12.hero.scene.context.fragile": "Konsep untuk diperkuat"
  ,"landing12.hero.scene.teaching.title": "Profesor AI"
  ,"landing12.hero.scene.teaching.message": "Mari hubungkan glukosa, oksigen, dan ATP, lalu periksa gagasan dengan satu pertanyaan."
  ,"landing12.hero.scene.teaching.explain": "Penjelasan"
  ,"landing12.hero.scene.teaching.practice": "Latihan"
  ,"landing12.hero.scene.teaching.voice": "Suara"
  ,"landing12.hero.scene.next.title": "Tindakan Terbaik Berikutnya"
  ,"landing12.hero.scene.next.action": "Perkuat respirasi seluler"
  ,"landing12.hero.scene.next.reason": "Disarankan karena konsep ini terkait dengan tujuan ujian dan masih perlu latihan."
  ,"landing12.hero.scene.next.context": "Alasan terlihat · tujuan dipertahankan"
  ,"landing12.story.kicker": "Satu produk, satu pengalaman"
  ,"landing12.story.title": "Lihat pengetahuan bergerak melalui seluruh sistem"
  ,"landing12.story.lead": "Sumber tidak berhenti pada penyimpanan. Demonstrasi ini mengikuti konteks yang sama dari dokumen ke pemahaman, latihan, revisi, dan produksi akademis."
  ,"landing12.story.documents.title": "Dokumen menjadi pengetahuan yang dapat digunakan"
  ,"landing12.story.documents.short": "Dokumen"
  ,"landing12.story.documents.desc": "Perpustakaan menerima sumber. Kecerdasan Dokumen membacanya, mengekstrak konsep, dan menyiapkan pertanyaan berbasis sumber tanpa mengarang kemajuan."
  ,"landing12.story.brain.title": "Konsep bergabung ke peta kognitif terhubung"
  ,"landing12.story.brain.short": "Otak Saya"
  ,"landing12.story.brain.desc": "Kembaran kognitif menampilkan konsep, hubungan, kekuatan, dan kerapuhan. Contoh publik ini bersifat ilustratif, bukan skor pelajar nyata."
  ,"landing12.story.professor.title": "Profesor mengajar dari konteks yang sama"
  ,"landing12.story.professor.short": "Profesor AI"
  ,"landing12.story.professor.desc": "Dokumen, konsep target, dan tujuan pembelajaran mengikuti sesi. Pengalaman dapat menjadi penjelasan, pelajaran, pertanyaan, atau latihan terpandu."
  ,"landing12.story.oral.title": "Pemahaman menjadi latihan lisan"
  ,"landing12.story.oral.short": "Lisan & Suara"
  ,"landing12.story.oral.desc": "Mendengarkan, transkripsi, dan respons adalah keadaan yang berbeda dan terbaca. Transkrip tetap terlihat; gelombang dekoratif tidak berpura-pura mengukur ucapan."
  ,"landing12.story.review.title": "Gagasan rapuh menjadi revisi"
  ,"landing12.story.review.short": "Revisi"
  ,"landing12.story.review.desc": "Mesin revisi memperkuat pengetahuan pada waktu yang tepat. Tanggal di sini adalah demonstrasi, bukan jadwal nyata."
  ,"landing12.story.workspace.title": "Pengetahuan menjadi karya"
  ,"landing12.story.workspace.short": "Ruang kerja"
  ,"landing12.story.workspace.desc": "Ruang Kerja Akademis menyatukan rencana, teks, sumber, dan kutipan sementara asisten kontekstual mendukung karya pelajar sendiri."
  ,"landing12.story.sharedContext": "Konteks bersama"
  ,"landing12.story.traceability": "Ketertelusuran sumber"
  ,"landing12.story.outcome": "Saya memberikan informasi → Second Brain memahaminya → mengajar saya → membantu saya berlatih → membantu saya mengingat → membantu saya menggunakannya."
  ,"landing12.story.nba": "Kemudian sistem mengusulkan tindakan berikutnya yang jelas dan dapat dijelaskan, bukan meninggalkan saya di dasbor."
  ,"landing12.story.file": "Kursus biologi.pdf"
  ,"landing12.story.fileType": "Dokumen demonstrasi · PDF"
  ,"landing12.story.readyDemo": "Contoh siap"
  ,"landing12.story.pipeline.import": "Sumber diimpor"
  ,"landing12.story.pipeline.read": "Konten terbaca diidentifikasi"
  ,"landing12.story.pipeline.concepts": "Konsep diekstrak"
  ,"landing12.story.pipeline.connect": "Hubungan disiapkan"
  ,"landing12.story.concept.respiration": "Respirasi seluler"
  ,"landing12.story.concept.toConsolidate": "Untuk diperkuat"
  ,"landing12.story.concept.photosynthesis": "Fotosintesis"
  ,"landing12.story.concept.chlorophyll": "Klorofil"
  ,"landing12.story.concept.atp": "ATP"
  ,"landing12.story.brain.note": "Peta menampilkan hubungan dan keadaan pembelajaran hanya saat produk memiliki bukti nyata."
  ,"landing12.story.context.brain": "Otak Saya"
  ,"landing12.story.context.document": "Kursus biologi.pdf"
  ,"landing12.story.context.goal": "Tujuan ujian"
  ,"landing12.story.professor.question": "Mengapa konsep ini masih terasa sulit?"
  ,"landing12.story.professor.answer": "Mari bangun kembali dari ATP: pertama tujuan, lalu langkahnya, kemudian pemeriksaan singkat dengan kata-kata Anda sendiri."
  ,"landing12.story.professor.session": "Sesi Pengalaman menyatukan sumber, niat, riwayat, dan tindakan berikutnya."
  ,"landing12.story.oral.listen": "Mendengarkan"
  ,"landing12.story.oral.transcript": "Transkripsi"
  ,"landing12.story.oral.answer": "Respons"
  ,"landing12.story.oral.visibleTranscript": "Transkrip terlihat"
  ,"landing12.story.oral.transcriptText": "“Respirasi seluler mengubah energi dalam glukosa menjadi ATP yang dapat digunakan sel.”"
  ,"landing12.story.oral.note": "Suara melengkapi pengalaman tertulis. Kegagalan layanan audio tidak pernah menghapus konten terbaca."
  ,"landing12.story.review.cardLabel": "Revisi konsep"
  ,"landing12.story.review.question": "Jelaskan peran ATP tanpa melihat sumber."
  ,"landing12.story.review.tomorrow": "Contoh: revisi besok"
  ,"landing12.story.review.note": "Aplikasi nyata menjadwalkan dari riwayat revisi sebenarnya; halaman Landing ini tidak membuat jadwal."
  ,"landing12.story.review.fsrs": "Pengulangan berjarak"
  ,"landing12.story.workspace.plan": "Rencana"
  ,"landing12.story.workspace.context": "Konteks"
  ,"landing12.story.workspace.analysis": "Analisis"
  ,"landing12.story.workspace.conclusion": "Kesimpulan"
  ,"landing12.story.workspace.documentTitle": "Cara sel mengubah energi"
  ,"landing12.story.workspace.copy": "Sumber dan konsep tetap dapat ditelusuri saat pelajar menyusun argumen dan menulis teks akhir."
  ,"landing12.story.workspace.source": "Kursus biologi.pdf"
  ,"landing12.story.workspace.citation": "Kutipan sumber"
  ,"landing12.features.kicker": "Kemampuan terhubung"
  ,"landing12.features.title": "Bukan kumpulan alat AI"
  ,"landing12.features.lead": "Setiap kemampuan memiliki peran jelas, tetapi berbagi sumber, sesi, dan konteks pembelajaran yang sama."
  ,"landing12.features.group.personal": "Kecerdasan pribadi"
  ,"landing12.features.group.personal.desc": "Mengenal pelajar"
  ,"landing12.features.group.understand": "Pahami"
  ,"landing12.features.group.understand.desc": "Pertanyaan dan sumber"
  ,"landing12.features.group.practice": "Berlatih dan mempertahankan"
  ,"landing12.features.group.practice.desc": "Pembelajaran aktif"
  ,"landing12.features.group.produce": "Gunakan dan lanjutkan"
  ,"landing12.features.group.produce.desc": "Karya dan tindakan berikutnya"
  ,"landing12.feature.brain.title": "Otak Saya"
  ,"landing12.feature.brain.desc": "Kembaran kognitif yang terlihat untuk konsep, hubungan, penguasaan, memori, dan riwayat pembelajaran."
  ,"landing12.feature.professor.title": "Profesor AI"
  ,"landing12.feature.professor.desc": "Identitas pedagogis yang mengajar, menjelaskan, bertanya, menilai, dan menyesuaikan diri dengan konteks aktif."
  ,"landing12.feature.learn.title": "Belajar"
  ,"landing12.feature.learn.desc": "Satu kolom untuk memahami, belajar, berlatih, meneliti, atau membuat dengan teks, suara, dan sumber."
  ,"landing12.feature.documents.title": "Kecerdasan Dokumen"
  ,"landing12.feature.documents.desc": "Impor, pahami, tanyakan, dan ubah satu dokumen atau kelompok terbatas dengan ketertelusuran sumber."
  ,"landing12.feature.review.title": "Revisi"
  ,"landing12.feature.review.desc": "Memperkuat hal yang berisiko terlupakan melalui riwayat revisi nyata dan pengulangan berjarak."
  ,"landing12.feature.research.title": "Riset"
  ,"landing12.feature.research.desc": "Penyelidikan cepat, bersumber, atau mendalam di Otak Saya dan Perpustakaan; kutipan tetap dapat diperiksa."
  ,"landing12.feature.workspace.title": "Ruang Kerja Akademis"
  ,"landing12.feature.workspace.desc": "Ruang kerja persisten untuk rencana, draf, sumber, kutipan, dan bantuan kontekstual."
  ,"landing12.feature.languages.title": "Bahasa & Imersi"
  ,"landing12.feature.languages.desc": "Kursus CEFR terstruktur yang terhubung ke misi nyata, umpan balik, revisi, dan bukti kemampuan fungsional."
  ,"landing12.feature.voice.title": "Lisan & Suara"
  ,"landing12.feature.voice.desc": "Bicara, tinjau transkrip, dan terima respons tertulis yang tetap tersedia jika audio gagal."
  ,"landing12.feature.next.title": "Tindakan Terbaik Berikutnya"
  ,"landing12.feature.next.desc": "Rekomendasi yang dapat dijelaskan, menggabungkan tujuan, sesi, revisi, dan konteks saat ini."
  ,"landing12.features.researchScope": "Riset dalam sumber Anda sendiri"
  ,"landing12.features.noWebClaim": "Penyedia Web eksternal belum dikonfigurasi"
  ,"landing12.features.sameContext": "Satu konteks bersama"
  ,"landing12.brain.kicker": "Otak Saya"
  ,"landing12.brain.title": "Kembaran kognitif Anda yang terlihat"
  ,"landing12.brain.lead": "Menjawab apa yang Anda ketahui, apa yang rapuh, bagaimana pengetahuan terhubung, dan apa yang perlu diperhatikan berikutnya."
  ,"landing12.brain.center": "Konteks pembelajaran Anda"
  ,"landing12.brain.knowledge": "Pengetahuan"
  ,"landing12.brain.connections": "Hubungan"
  ,"landing12.brain.strengths": "Kekuatan"
  ,"landing12.brain.fragilities": "Kerapuhan"
  ,"landing12.brain.memory": "Memori"
  ,"landing12.brain.noScores": "Second Brain hanya menampilkan penguasaan dan dampak jika ada bukti; halaman Landing tidak mengarang skor."
  ,"landing12.professor.kicker": "Profesor AI"
  ,"landing12.professor.title": "Seorang guru, bukan chatbot umum lainnya"
  ,"landing12.professor.lead": "Dapat mengubah format pengalaman sambil mempertahankan konteks dan sesi pelajar."
  ,"landing12.professor.level": "Tingkat"
  ,"landing12.professor.goals": "Tujuan"
  ,"landing12.professor.documents": "Dokumen"
  ,"landing12.professor.progress": "Kemajuan"
  ,"landing12.professor.identity": "Identitas pedagogis"
  ,"landing12.professor.example": "“Saya dapat menjelaskannya dengan cara lain, mengajukan pertanyaan, beralih ke latihan lisan, atau mengubah kesulitan ini menjadi bahan ulasan.”"
  ,"landing12.professor.mode.explain": "Menjelaskan"
  ,"landing12.professor.mode.teach": "Mengajar"
  ,"landing12.professor.mode.question": "Bertanya"
  ,"landing12.professor.mode.assess": "Menilai"
  ,"landing12.professor.mode.voice": "Suara"
  ,"landing12.personal.kicker": "Kecerdasan personal"
  ,"landing12.personal.title": "Sistem yang berkembang bersama proses belajar Anda"
  ,"landing12.personal.lead": "Semakin banyak Anda belajar, berlatih, dan mengulas, semakin baik Second Brain menata konteks Anda dan menjadikan tindakan berikutnya bermanfaat."
  ,"landing12.personal.learn": "Yang Anda pelajari"
  ,"landing12.personal.understand": "Yang Anda pahami"
  ,"landing12.personal.forget": "Yang berisiko terlupakan"
  ,"landing12.personal.master": "Yang Anda kuasai"
  ,"landing12.personal.goals": "Yang ingin Anda capai"
  ,"landing12.personal.twin": "Peta kognitif yang hidup"
  ,"landing12.personal.note": "Linimasa ditampilkan lebih dahulu saat data masih sedikit; grafik eksploratif digunakan saat bukti telah matang."
  ,"landing12.personal.nbaLabel": "Contoh Tindakan Terbaik Berikutnya"
  ,"landing12.personal.nbaAction": "Lanjutkan misi rapat bahasa Inggris Anda"
  ,"landing12.personal.nbaReason": "Karena misi itu terkait dengan tujuan kerja internasional Anda dan sesi terakhir siap dilanjutkan."
  ,"landing12.languages.kicker": "Bahasa & Imersi"
  ,"landing12.languages.title": "Pelajari bahasa bersama Profesor AI Anda"
  ,"landing12.languages.lead": "Pilih kemampuan yang ingin Anda capai. Second Brain memadukan kursus lengkap, misi kehidupan nyata, latihan lisan, perbaikan terarah, dan ulasan."
  ,"landing12.languages.demoDisclaimer": "Skenario dari cetak biru Lot 11 bis. Hanya demonstrasi; tidak ada klaim sertifikasi atau skor pelajar."
  ,"landing12.languages.objective": "Tujuan"
  ,"landing12.languages.objectiveValue": "Saya ingin bekerja secara internasional"
  ,"landing12.languages.missionMeeting": "Berpartisipasi dalam rapat"
  ,"landing12.languages.rlle": "Mesin Bahasa Kehidupan Nyata"
  ,"landing12.languages.stage.goal": "Tujuan"
  ,"landing12.languages.stage.course": "Kursus"
  ,"landing12.languages.stage.mission": "Misi"
  ,"landing12.languages.stage.conversation": "Percakapan dengan Profesor"
  ,"landing12.languages.stage.gap": "Kesulitan terdeteksi"
  ,"landing12.languages.stage.micro-lesson": "Pelajaran mikro"
  ,"landing12.languages.stage.retry": "Percobaan baru"
  ,"landing12.languages.stage.vocabulary": "Bahasa yang berguna"
  ,"landing12.languages.stage.review": "Ulasan"
  ,"landing12.languages.stage.functional-progress": "Kemajuan kemampuan praktis"
  ,"landing12.languages.stage.goal.note": "Tujuan nyata pelajar menentukan urutan prioritas kursus."
  ,"landing12.languages.stage.course.note": "CEFR menata jalur belajar; CEFR tidak disajikan sebagai sertifikasi eksternal."
  ,"landing12.languages.stage.mission.note": "Misi Dunia mengubah pengetahuan menjadi tugas komunikasi yang konkret."
  ,"landing12.languages.stage.conversation.note": "Bahasa yang dipelajari tetap terpisah dari bahasa antarmuka."
  ,"landing12.languages.stage.gap.note": "Kesenjangan berasal dari bukti yang diamati, bukan dari skor dekoratif."
  ,"landing12.languages.stage.micro-lesson.note": "Perbaikan berfokus pada hambatan yang tepat sebelum percobaan berikutnya."
  ,"landing12.languages.stage.retry.note": "Percobaan ulang memberi pelajar kesempatan untuk segera menerapkan koreksi."
  ,"landing12.languages.stage.vocabulary.note": "Bahasa yang dipilih tetap menyimpan asal-usul misi dan sesinya."
  ,"landing12.languages.stage.review.note": "Kosakata dapat masuk ke alur ulasan dan FSRS yang sudah ada."
  ,"landing12.languages.stage.functional-progress.note": "Kemampuan praktis hanya divalidasi berdasarkan bukti yang diterima dalam produk nyata."
  ,"landing12.languages.path.goal": "Tujuan fungsional, bukan topik samar"
  ,"landing12.languages.path.goal.desc": "Kursus dimulai dari situasi yang ingin ditangani pelajar dalam kehidupan nyata."
  ,"landing12.languages.path.course": "Jalur B1 yang terstruktur"
  ,"landing12.languages.path.course.desc": "Kurikulum, untaian materi, dan misi tetap saling terhubung, bukan menjadi aplikasi mini yang terpisah."
  ,"landing12.languages.path.mission": "Rapat sebagai tugas nyata"
  ,"landing12.languages.path.mission.desc": "Profesor menciptakan percakapan kontekstual, mengamati hambatan, dan memandu siklus perbaikan."
  ,"landing12.languages.professorLabel": "Profesor AI · Bahasa Inggris B1"
  ,"landing12.languages.transcriptVisible": "Status suara dan transkrip tetap jelas serta dapat diedit di aplikasi."
  ,"landing12.languages.gapDetected": "Kesenjangan fungsional yang diamati"
  ,"landing12.languages.gapExplanation": "Maksudnya sudah jelas, tetapi bentuk adverbia menghambat kalimat profesional yang alami. Dalam produk nyata, kesulitan yang diamati ini dapat masuk ke Memori Kesalahan agar Siklus Perbaikan dapat menargetkannya kelak."
  ,"landing12.languages.gapGrammar": "Tata bahasa"
  ,"landing12.languages.gapFluency": "Kelancaran"
  ,"landing12.languages.microLesson": "Perbaikan terarah"
  ,"landing12.languages.microRule": "Gunakan adverbia untuk menjelaskan cara tim bekerja."
  ,"landing12.languages.microHint": "Profesor menghubungkan aturan dengan kalimat alih-alih membuka pelajaran yang tidak terkait."
  ,"landing12.languages.retryLabel": "Coba lagi tugas yang sama"
  ,"landing12.languages.retryObserved": "Struktur yang telah diperbaiki muncul dalam percobaan baru"
  ,"landing12.languages.vocabularyTitle": "Bahasa yang dipilih dari misi ini"
  ,"landing12.languages.vocabularyTrace": "Dalam produk, setiap item tersimpan mempertahankan bahasa, sumber, dan asal sesi."
  ,"landing12.languages.reviewLabel": "Terhubung ke Ulasan"
  ,"landing12.languages.reviewAction": "Kukuhkan struktur yang berguna pada waktu yang tepat"
  ,"landing12.languages.reviewTrace": "Jadwal nyata dibuat dari bukti ulasan yang sebenarnya; demonstrasi ini tidak membuat bukti apa pun."
  ,"landing12.languages.canDoTitle": "Yang sudah dapat saya lakukan"
  ,"landing12.languages.canDo.introduce": "Memperkenalkan diri"
  ,"landing12.languages.canDo.restaurant": "Memesan di restoran"
  ,"landing12.languages.canDo.meeting": "Berpartisipasi dalam rapat"
  ,"landing12.languages.canDo.opinion": "Mempertahankan pendapat"
  ,"landing12.languages.canDoDisclaimer": "Daftar ilustratif. Hanya bukti yang dapat memvalidasi kemampuan dalam aplikasi."
  ,"landing12.languages.courseTitle": "Kursus bahasa yang lengkap"
  ,"landing12.languages.courseLead": "Percakapan adalah salah satu bagian kursus, bersama pembelajaran bahasa eksplisit dan pemahaman."
  ,"landing12.languages.strand.vocabulary": "Kosakata"
  ,"landing12.languages.strand.grammar": "Tata bahasa"
  ,"landing12.languages.strand.verbs": "Kata kerja"
  ,"landing12.languages.strand.conjugation": "Konjugasi"
  ,"landing12.languages.strand.reading": "Membaca"
  ,"landing12.languages.strand.writing": "Menulis"
  ,"landing12.languages.strand.listening": "Menyimak"
  ,"landing12.languages.strand.oral": "Lisan"
  ,"landing12.languages.strand.pronunciation": "Pelafalan"
  ,"landing12.languages.strand.mediation": "Mediasi"
  ,"landing12.languages.missionsTitle": "Misi Dunia"
  ,"landing12.languages.missionsLead": "Katalog situasi terbatas untuk menggunakan bahasa, dengan tujuan dan tingkat minimum."
  ,"landing12.languages.mission.travel": "Perjalanan"
  ,"landing12.languages.mission.work": "Pekerjaan"
  ,"landing12.languages.mission.studies": "Studi"
  ,"landing12.languages.mission.social": "Kehidupan sosial"
  ,"landing12.languages.registryTitle": "34 bahasa pembelajaran didukung"
  ,"landing12.languages.registryLead": "Nama asli dan nama dalam bahasa antarmuka menyampaikan makna. Simbol netral menggantikan bendera negara jika satu negara akan menimbulkan ambiguitas."
  ,"landing12.how.kicker": "Cara kerjanya"
  ,"landing12.how.title": "Perjalanan sederhana, bahkan ketika kecerdasannya mendalam"
  ,"landing12.how.lead": "Anda membawa sebuah niat. Second Brain menyembunyikan kerumitan teknis di balik satu pengalaman berkelanjutan."
  ,"landing12.how.goal.title": "Sampaikan tujuan Anda"
  ,"landing12.how.goal.desc": "Sebutkan apa yang ingin Anda pahami atau capai."
  ,"landing12.how.act.title": "Belajar, impor, atau bertanya"
  ,"landing12.how.act.desc": "Gunakan teks, suara, pemindaian, atau berkas."
  ,"landing12.how.context.title": "Bangun konteks"
  ,"landing12.how.context.desc": "Satukan sesi, sumber, dan tujuan yang relevan."
  ,"landing12.how.practice.title": "Berlatih"
  ,"landing12.how.practice.desc": "Beranjak dari penjelasan menuju pengalaman aktif."
  ,"landing12.how.consolidate.title": "Mengukuhkan"
  ,"landing12.how.consolidate.desc": "Ulas hal-hal yang menurut bukti masih rapuh."
  ,"landing12.how.continue.title": "Melanjutkan"
  ,"landing12.how.continue.desc": "Ikuti satu tindakan berikutnya yang dapat dijelaskan."
  ,"landing12.nba.kicker": "Tindakan Terbaik Berikutnya"
  ,"landing12.nba.title": "Ketahui apa yang perlu diperhatikan sekarang"
  ,"landing12.nba.lead": "Rekomendasi menggabungkan konteks nyata dan menjelaskan kegunaannya. Rekomendasi adalah saran, bukan perintah tersembunyi."
  ,"landing12.nba.english": "Lanjutkan kursus bahasa Inggris Anda"
  ,"landing12.nba.review": "Ulas 5 konsep yang telah jatuh tempo"
  ,"landing12.nba.workspace": "Lanjutkan kerangka tesis Anda"
  ,"landing12.nba.professor": "Lanjutkan sesi Profesor Anda"
  ,"landing12.nba.why": "Mengapa rekomendasi ini? · Tujuan dan sesi yang dapat dilanjutkan"
  ,"landing12.platform.web": "Web"
  ,"landing12.platform.android": "Android"
  ,"landing12.platform.ios": "iOS"
  ,"landing12.platform.windows": "Windows"
  ,"landing12.platform.macos": "macOS"
  ,"landing12.platform.status.available": "Tersedia"
  ,"landing12.platform.status.prepared": "Aplikasi siap secara teknis; belum ada tautan toko publik"
  ,"landing12.platform.status.coming-soon": "Segera hadir; belum ada tautan unduhan publik"
  ,"landing12.download.kicker": "Kontinuitas lintas platform"
  ,"landing12.download.title": "Second Brain, di mana pun Anda belajar"
  ,"landing12.download.lead": "Mulailah dengan pengalaman Web hari ini. Distribusi seluler dan desktop ditampilkan secara jujur saat tersedia."
  ,"landing12.download.continuity": "Model sesi dirancang agar Anda dapat memulai di satu perangkat dan melanjutkan di perangkat lain."
  ,"landing12.download.webAction": "Gunakan di Web"
  ,"landing12.download.sameSession": "Sesi yang sama"
  ,"landing12.download.synced": "Konteks siap dilanjutkan"
  ,"landing12.privacy.kicker": "Privasi dan kendali"
  ,"landing12.privacy.title": "Data Anda tetap berada dalam kendali Anda"
  ,"landing12.privacy.lead": "Second Brain menyediakan kendali tingkat akun untuk memori, dokumen, portabilitas, dan penghapusan."
  ,"landing12.privacy.scope": "Ini adalah kendali produk, bukan janji hukum atau keamanan tambahan."
  ,"landing12.privacy.memory": "Kelola memori AI"
  ,"landing12.privacy.export": "Ekspor data Anda"
  ,"landing12.privacy.documents": "Kelola dokumen Anda"
  ,"landing12.privacy.delete": "Minta penghapusan akun dengan konfirmasi"
  ,"landing12.pricing.kicker": "Gratis · Pro · Max"
  ,"landing12.pricing.title": "Tiga penawaran individual, tanpa rincian rekaan"
  ,"landing12.pricing.lead": "Harga, kuota, dan manfaat final akan diputuskan setelah beta publik. Halaman Landing hanya menyajikan katalog nyata saat ini."
  ,"landing12.pricing.free.name": "Gratis"
  ,"landing12.pricing.free.desc": "Penawaran individual bawaan untuk mengenal pengalaman Second Brain."
  ,"landing12.pricing.pro.name": "Pro"
  ,"landing12.pricing.pro.desc": "Penawaran individual tingkat lanjut yang harga, kuota, dan manfaat finalnya masih harus dikonfigurasi."
  ,"landing12.pricing.max.name": "Max"
  ,"landing12.pricing.max.desc": "Penawaran individual terlengkap; rincian komersial finalnya masih harus dikonfigurasi."
  ,"landing12.pricing.freeStatus": "Penawaran gratis tersedia"
  ,"landing12.pricing.pending": "Rincian setelah beta publik"
  ,"landing12.pricing.sourceNote": "Layar langganan terautentikasi tetap didorong oleh data dari backend. Tidak ada harga, diskon, kuota, atau manfaat eksklusif yang dikodekan langsung di sini."
  ,"landing12.faq.kicker": "Jawaban berguna"
  ,"landing12.faq.title": "Ada pertanyaan? Kami menjawabnya."
  ,"landing12.faq.lead": "Jawaban singkat tentang apa yang benar-benar dilakukan produk saat ini."
  ,"landing12.faq.q1": "Apa itu Second Brain?"
  ,"landing12.faq.a1": "Sistem pembelajaran cerdas personal yang menghubungkan pertanyaan, sumber, pengajaran, latihan, memori, dan pekerjaan akademis dalam satu konteks."
  ,"landing12.faq.q2": "Apakah ini sekadar chatbot?"
  ,"landing12.faq.a2": "Tidak. Percakapan hanyalah salah satu antarmuka. Sesi yang sama dapat menjadi pelajaran, latihan lisan, pertanyaan bersumber dari dokumen, ulasan, atau tindakan Workspace."
  ,"landing12.faq.q3": "Bagaimana cara kerja Otak Saya?"
  ,"landing12.faq.a3": "Fitur ini menampilkan konsep, hubungan, bukti penguasaan, memori, dan riwayat belajar Anda. Tampilannya menyesuaikan dengan kematangan data yang tersedia."
  ,"landing12.faq.q4": "Dapatkah saya menggunakan dokumen sendiri?"
  ,"landing12.faq.a4": "Ya. Perpustakaan menerima berkas dan hasil pindai yang didukung, menampilkan status pemrosesan nyata, mengekstrak konsep, serta mendukung pertanyaan dan transformasi yang berpijak pada sumber."
  ,"landing12.faq.q5": "Dapatkah saya mempelajari sebuah bahasa?"
  ,"landing12.faq.a5": "Ya. Mesin Bahasa Kehidupan Nyata memadukan kurikulum CEFR, pembelajaran bahasa eksplisit, Misi Dunia, latihan lisan, perbaikan terarah, ulasan, dan bukti kemampuan praktis."
  ,"landing12.faq.q6": "Bagaimana cara kerja Profesor AI?"
  ,"landing12.faq.a6": "Profesor menggunakan konteks aktif pelajar dan dapat menjelaskan, mengajar, bertanya, menilai, atau melatih sambil mempertahankan Sesi Pengalaman."
  ,"landing12.faq.q7": "Bagaimana cara kerja ulasan?"
  ,"landing12.faq.a7": "Ulasan menggunakan riwayat nyata dan pengulangan bersela untuk memprioritaskan pengetahuan yang berisiko terlupakan. Ulasan non-AI tetap tersedia secara mandiri dari kuota AI."
  ,"landing12.faq.q8": "Bahasa apa saja yang tersedia?"
  ,"landing12.faq.a8": "Registri bersama saat ini memuat 34 bahasa pembelajaran. Bahasa antarmuka dan bahasa pembelajaran selalu merupakan pilihan terpisah."
  ,"landing12.faq.q9": "Apakah Riset mencari di Web?"
  ,"landing12.faq.a9": "Riset dapat bekerja di Otak Saya dan Perpustakaan Anda saat ini. Penyedia Web eksternal belum dikonfigurasi dalam deployment saat ini, sehingga halaman Landing tidak mengklaim sebaliknya."
  ,"landing12.faq.q10": "Apakah data saya bersifat privat?"
  ,"landing12.faq.a10": "Kendali terautentikasi mencakup memori AI, dokumen, persetujuan, ekspor, dan penghapusan akun. Halaman ini tidak menambahkan janji hukum atau infrastruktur di luar kendali tersebut."
  ,"landing12.faq.q11": "Apa perbedaan antara Gratis, Pro, dan Max?"
  ,"landing12.faq.a11": "Ketiganya adalah tingkat paket individual dalam katalog backend. Harga, kuota, dan manfaat paket final akan dikonfigurasi setelah beta publik."
  ,"landing12.faq.q12": "Di mana saya dapat menggunakan Second Brain?"
  ,"landing12.faq.a12": "Pengalaman Web tersedia dalam aplikasi ini. Android dan iOS siap secara teknis tanpa tautan toko publik; distribusi Windows dan macOS masih akan hadir."
  ,"landing12.contact.kicker": "Kontak dan dukungan"
  ,"landing12.contact.title": "Sampaikan kebutuhan Anda kepada kami"
  ,"landing12.contact.lead": "Pintu masuk kontak publik tetap jujur: saluran email hanya dibuka jika alamat dukungan publik telah dikonfigurasi."
  ,"landing12.contact.write": "Tulis kepada dukungan"
  ,"landing12.contact.account": "Masuk ke akun Anda"
  ,"landing12.contact.notConfigured": "Alamat dukungan publik belum dikonfigurasi. Masuklah untuk mengakses kendali akun dan data; tidak ada pesan yang akan disimulasikan."
  ,"landing12.contact.subject": "Permintaan dukungan Second Brain"
  ,"landing12.contact.general": "Pertanyaan umum"
  ,"landing12.contact.general.desc": "Pahami produk atau ketersediaannya."
  ,"landing12.contact.technical": "Dukungan teknis"
  ,"landing12.contact.technical.desc": "Laporkan masalah saat menggunakan aplikasi."
  ,"landing12.contact.billing": "Langganan dan penagihan"
  ,"landing12.contact.billing.desc": "Pertanyaan tentang penawaran, faktur, atau pembayaran."
  ,"landing12.contact.privacy": "Privasi dan data"
  ,"landing12.contact.privacy.desc": "Pertanyaan tentang memori, ekspor, atau penghapusan."
  ,"landing12.contact.problem": "Laporkan masalah"
  ,"landing12.contact.problem.desc": "Jelaskan masalah produk yang dapat direproduksi."
  ,"landing12.contact.feedback": "Saran dan umpan balik"
  ,"landing12.contact.feedback.desc": "Bagikan gagasan untuk meningkatkan pengalaman."
  ,"report.title": "Laporkan masalah"
  ,"report.intro": "Beri tahu kami apa yang terjadi. Laporan Anda ditinjau oleh manusia; laporan bukan instruksi untuk sistem dan tidak memicu perbaikan otomatis."
  ,"report.category": "Apa yang terdampak?"
  ,"report.category.app_not_working": "Aplikasi tidak berfungsi"
  ,"report.category.ai_teacher_problem": "Guru AI"
  ,"report.category.document_pdf_problem": "Dokumen atau PDF"
  ,"report.category.voice_problem": "Suara"
  ,"report.category.language_learning_problem": "Pembelajaran bahasa"
  ,"report.category.revision_problem": "Ulasan"
  ,"report.category.brain_digital_twin_problem": "Otak Saya atau Kembaran Digital"
  ,"report.category.subscription_payment_problem": "Langganan atau pembayaran"
  ,"report.category.account_login_problem": "Akun atau proses masuk"
  ,"report.category.other": "Lainnya"
  ,"report.description": "Jelaskan masalahnya"
  ,"report.placeholder": "Apa yang sedang Anda coba lakukan, dan apa yang justru terjadi?"
  ,"report.counter": "{count}/{max} karakter"
  ,"report.minimum": "Masukkan setidaknya {min} karakter."
  ,"report.privacyTitle": "Jaga agar laporan tetap aman"
  ,"report.privacyDetail": "Jangan sertakan kata sandi, kode akses, detail pembayaran, dokumen privat, isi percakapan, atau data pribadi. Nilai yang tampak sensitif disamarkan sebelum dikirim."
  ,"report.consent": "Saya mengizinkan diagnostik tambahan terbatas jika diperlukan. Ini opsional; laporan dapat dikirim tanpanya."
  ,"report.contextTitle": "Konteks diagnostik terbatas"
  ,"report.contextDetail": "Aplikasi hanya mengirim kategori laporan, deskripsi terbatas, nama rute aman, versi aplikasi/build, platform, dan ID permintaan buram. Aplikasi tidak mengirim tangkapan layar, dokumen, percakapan, atau audio."
  ,"report.attachments": "Lampiran"
  ,"report.attachmentsDetail": "TIDAK DIINSTRUMENTASI — lampiran sengaja tidak tersedia untuk laporan masalah."
  ,"report.submit": "Kirim laporan"
  ,"report.successTitle": "Laporan terkirim"
  ,"report.successDetail": "Terima kasih. Peninjauan oleh manusia dapat menghubungkannya dengan telemetri aman; hal ini tidak mengonfirmasi penyebab ataupun membuat perubahan otomatis."
  ,"report.error": "Laporan tidak dapat dikirim. Tidak ada percobaan ulang otomatis."
  ,"report.profileTitle": "Bantuan dan laporan masalah"
  ,"report.profileDetail": "Laporkan masalah produk tanpa melampirkan konten pembelajaran privat."
  ,"report.open": "Laporkan masalah"
  ,"landing12.final.kicker": "Satu produk. Satu pengalaman."
  ,"landing12.final.title": "Bangun sistem yang belajar bersama Anda"
  ,"landing12.final.lead": "Mulailah dengan satu niat. Pertahankan konteksnya. Lanjutkan dengan tindakan berikutnya yang tepat."
  ,"landing12.footer.tagline": "Sistem pembelajaran cerdas personal Anda: memahami, berlatih, mengingat, dan menghasilkan karya dalam satu konteks berkelanjutan."
  ,"landing12.footer.beta": "Beta publik · kemampuan dan konfigurasi komersial terus berkembang."
  ,"landing12.footer.product": "Produk"
  ,"landing12.footer.resources": "Sumber daya"
  ,"landing12.footer.features": "Fitur"
  ,"landing12.footer.brain": "Otak Saya"
  ,"landing12.footer.languages": "Bahasa"
  ,"landing12.footer.pricing": "Harga"
  ,"landing12.footer.download": "Unduh"
  ,"landing12.footer.how": "Cara kerjanya"
  ,"landing12.footer.faq": "Tanya Jawab"
  ,"landing12.footer.contact": "Kontak"
  ,"landing12.footer.account": "Akun"
  ,"landing12.footer.privacy": "Kendali privasi dan data"
  ,"landing12.footer.copy": "© 2026 Second Brain. Semua demonstrasi produk adalah contoh publik."
  ,"landing12.footer.noTracking": "Tanpa mitra, testimoni, atau metrik fiktif."
  ,"capture.permission.pending": "Menyiapkan kamera…"
  ,"capture.permission.title": "Izin kamera diperlukan"
  ,"capture.permission.detail": "Second Brain hanya membuka kamera setelah tindakan Anda. Anda tetap dapat mengimpor gambar yang sudah ada."
  ,"capture.permission.allow": "Izinkan kamera"
  ,"capture.importFallback": "Impor gambar"
  ,"capture.error.capture": "Foto tidak dapat diambil."
  ,"capture.error.fallback": "Tutup aplikasi lain yang menggunakan kamera, periksa izinnya, atau impor gambar."
  ,"capture.error.unavailable": "Tidak ditemukan kamera yang tersedia."
  ,"capture.error.paused": "Kamera dijeda."
  ,"capture.error.denied": "Izin kamera ditolak."
  ,"capture.error.secureContext": "Kamera memerlukan koneksi HTTPS yang aman."
  ,"capture.error.busy": "Kamera tidak tersedia atau sedang digunakan."
  ,"capture.retake": "Ambil ulang"
  ,"capture.confirm": "Gunakan foto ini"
  ,"capture.take": "Ambil foto"
  ,"capture.switch": "Ganti kamera"
  ,"capture.preview": "Pratinjau kamera langsung"
  ,"capture.cameraChoice": "Pilih kamera"
  ,"capture.camera": "Kamera"
  ,"qr.title": "Baca kode QR"
  ,"qr.detail": "Arahkan ke kode QR. Isinya tetap tidak aktif sampai Anda memeriksanya."
  ,"qr.aim": "Pertahankan kode QR di dalam bingkai."
  ,"qr.unsupported": "Pembacaan QR tidak tersedia di peramban ini"
  ,"qr.unsupportedDetail": "Gunakan peramban HTTPS yang kompatibel atau perangkat lain. Tidak ada konten yang dibuka."
  ,"qr.detected": "Tujuan QR terdeteksi"
  ,"qr.confirmDetail": "Periksa tujuan lengkap sebelum membukanya."
  ,"qr.open": "Buka tujuan ini"
  ,"qr.openError": "Tujuan ini tidak dapat dibuka. Tujuan tidak dijalankan atau diimpor."
  ,"qr.noneFound": "Tidak ada kode QR yang ditemukan. Sesuaikan bingkai dan coba lagi."
  ,"qr.scanAgain": "Pindai kode QR lain"
  ,"qr.textDetected": "Teks QR terdeteksi"
  ,"qr.textInert": "Teks ini hanya ditampilkan. Teks tidak dijalankan atau dikirim ke guru AI."
  ,"qr.done": "Selesai"
  ,"qr.blocked": "Tujuan QR yang tidak aman diblokir"
  ,"qr.blockedDetail": "Hanya tautan HTTP dan HTTPS eksplisit yang dapat dibuka. Skema khusus, berkas, data, dan skrip ditolak."
  ,"scan.importError": "Gambar yang dipilih tidak dapat diimpor."
  ,"scan.editError": "Halaman ini tidak dapat diedit. Halaman lainnya tetap dipertahankan."
  ,"scan.uploadError": "Hasil pindai tidak dapat disimpan."
  ,"scan.inProgress": "Pemindaian ini masih diproses. Coba lagi sebentar lagi."
  ,"scan.retryNewAttempt": "Percobaan sebelumnya telah berakhir dengan aman. Tekan simpan lagi untuk memulai percobaan pemindaian baru."
  ,"scan.returnToLearn": "Kembali ke Belajar dengan dokumen ini"
  ,"scan.captureFirst": "Tinjau sebelum menyimpan"
  ,"scan.captureFirstDetail": "Ambil atau impor halaman, sesuaikan urutan, pemotongan, dan rotasinya, lalu konfirmasikan. Tidak ada yang diunggah sebelum tindakan akhir."
  ,"scan.retryPreserved": "Halaman Anda tetap di sini agar Anda dapat mencoba lagi tanpa mengambil ulang."
  ,"scan.pagePosition": "Halaman {current} dari {total}"
  ,"scan.moveBefore": "Geser ke kiri"
  ,"scan.moveAfter": "Geser ke kanan"
  ,"scan.rotate": "Putar"
  ,"scan.crop": "Sesuaikan potongan"
  ,"scan.perspectiveLimit": "Seret keempat sudut ke tepi halaman. Perspektif dan keterbacaan diperbaiki saat Anda menyimpan."
  ,"learn5.capture.photo": "Foto"
  ,"learn5.capture.document": "Pindai dokumen"
  ,"learn5.capture.qr": "Baca kode QR"
  ,"profile.card.webcam": "Gunakan kamera web"
  ,"profile.card.importImage": "Impor gambar"
  ,"profile.email.verified": "Email terverifikasi"
  ,"profile.email.unverified": "Email belum terverifikasi"
  ,"profile.edit": "Edit profil saya"
  ,"profile.avatar.loadError": "Foto profil tersimpan tidak dapat dimuat."
  ,"profile.avatar.saveError": "Foto profil baru tidak dapat disimpan."
  ,"profile.avatar.removeError": "Foto profil tidak dapat dihapus."
  ,"profile.avatar.denied": "Akses foto ditolak."
  ,"profile.avatar.error": "Pemilih gambar tidak dapat dibuka."
  ,"profile.avatar.preserved": "Foto tersimpan sebelumnya dipertahankan. Anda dapat mencoba lagi dengan aman."
  ,"profile.avatar.editorTitle": "Sesuaikan foto profil"
  ,"profile.avatar.editorDetail": "Pratinjau hasil lingkaran. Rotasi dan perbesaran hanya diterapkan setelah konfirmasi."
  ,"profile.avatar.rotate": "Putar"
  ,"profile.avatar.zoomOut": "Perkecil"
  ,"profile.avatar.zoomIn": "Perbesar"
  ,"profile.avatar.confirm": "Simpan foto ini"
};

registerLocale('id', "Bahasa Indonesia", id);
