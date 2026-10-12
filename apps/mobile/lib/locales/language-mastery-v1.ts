import { extendLocale, extendLocaleAliases } from '../i18n';

/**
 * Bounded copy for the autonomous language-mastery gate.
 *
 * English and French carry the precise product wording in the source catalog.
 * The other complete catalogs reuse already-reviewed copy from their own
 * locale so the new flow never falls back to English. Those aliases guarantee
 * technical coverage; they do not claim a new human linguistic review.
 */
export const languageMasteryKeys = [
  'rlle.ui.autonomy.notice',
  'rlle.ui.autonomy.verdict.mastered',
  'rlle.ui.autonomy.verdict.not-mastered',
  'rlle.ui.autonomy.verdict.not-evaluable',
  'rlle.ui.autonomy.leaveForHelp',
  'rlle.ui.autonomy.start',
  'rlle.ui.autonomy.resume',
  'rlle.ui.remediation.start',
  'rlle.ui.remediation.ready',
  'rlle.ui.training.format.recognition-mcq',
  'rlle.ui.training.format.contextual-discrimination',
  'rlle.ui.training.format.fill-blank-no-hint',
  'rlle.ui.training.format.sentence-reconstruction',
  'rlle.ui.training.format.register-matching',
  'rlle.ui.training.format.error-correction',
  'rlle.ui.training.format.listening-discrimination',
  'rlle.ui.training.format.guided-writing',
  'rlle.ui.training.format.voice-pronunciation',
  'rlle.ui.training.format.mini-dialogue',
  'rlle.ui.training.tokenBank',
  'rlle.ui.training.voice',
  'rlle.ui.training.answer',
  'rlle.ui.capabilities.title',
  'rlle.ui.capabilities.detail',
  'rlle.ui.capabilities.audioCapture',
  'rlle.ui.capabilities.transcription',
  'rlle.ui.capabilities.spokenContent',
  'rlle.ui.capabilities.listening',
  'rlle.ui.capabilities.graphy',
  'rlle.ui.capabilities.pronunciation',
  'rlle.ui.capabilities.available',
  'rlle.ui.capabilities.runtimeRequired',
  'rlle.ui.capabilities.notEvaluable',
  'rlle.ui.capabilities.providerReady',
  'rlle.ui.capabilities.blocked',
  'rlle.ui.capabilities.blockedDetail',
  'rlle.ui.capabilities.checkMicrophone',
  'rlle.ui.capabilities.strictDisabled',
  'rlle.ui.course.generationFailed',
  'rlle.ui.course.generationFailedDetail',
  'rlle.ui.bulletin.title',
  'rlle.ui.bulletin.detail',
  'rlle.ui.bulletin.mastered',
  'rlle.ui.bulletin.reinforce',
  'rlle.ui.bulletin.thresholdReached',
  'rlle.ui.bulletin.thresholdPending',
  'rlle.ui.bulletin.pillar.communication',
  'rlle.ui.bulletin.pillar.grammar',
  'rlle.ui.bulletin.pillar.verbal',
  'rlle.ui.bulletin.pillar.vocabulary',
  'rlle.ui.bulletin.pillar.graphy',
  'rlle.ui.bulletin.status.mastered',
  'rlle.ui.bulletin.status.notMastered',
  'rlle.ui.bulletin.status.inProgress',
  'rlle.ui.bulletin.status.notEvaluable',
] as const;

export const languageMasteryLocaleCodes = [
  'es', 'de', 'it', 'pt', 'hi', 'tr', 'pl', 'ru', 'zh', 'vi', 'ja', 'sv',
  'th', 'ar', 'ko', 'nl', 'el', 'cs', 'ro', 'hu', 'da', 'fi', 'id', 'nb',
  'uk', 'ln', 'sw', 'wo', 'ha', 'he', 'zh-Hant', 'bn',
] as const;

export const languageBulletinKeys = [
  'rlle.ui.course.generationFailed',
  'rlle.ui.course.generationFailedDetail',
  'rlle.ui.bulletin.title',
  'rlle.ui.bulletin.detail',
  'rlle.ui.bulletin.mastered',
  'rlle.ui.bulletin.reinforce',
  'rlle.ui.bulletin.thresholdReached',
  'rlle.ui.bulletin.thresholdPending',
  'rlle.ui.bulletin.pillar.communication',
  'rlle.ui.bulletin.pillar.grammar',
  'rlle.ui.bulletin.pillar.verbal',
  'rlle.ui.bulletin.pillar.vocabulary',
  'rlle.ui.bulletin.pillar.graphy',
  'rlle.ui.bulletin.status.mastered',
  'rlle.ui.bulletin.status.notMastered',
  'rlle.ui.bulletin.status.inProgress',
  'rlle.ui.bulletin.status.notEvaluable',
] as const;

type LanguageBulletinKey = (typeof languageBulletinKeys)[number];
type LanguageMasteryLocaleCode = (typeof languageMasteryLocaleCodes)[number];

/** Direct, locale-specific copy for the new course-generation and bulletin
 * surface. These are deliberately not semantic aliases: every status and
 * threshold keeps its exact product meaning in all selectable UI languages. */
export const languageBulletinTranslations: Record<LanguageMasteryLocaleCode, readonly string[]> = {
  es: ["Tu espacio de idioma se guardó, pero no se creó el curso.", "No se perdió nada. Revisa las opciones y vuelve a intentar crear el curso.", "Informe de dominio de conceptos", "Este informe refleja solo pruebas verificadas. Una evaluación no disponible no cuenta ni como fallo ni como dominio.", "Dominados", "Por reforzar", "Umbral del 90 % de conceptos alcanzado", "Umbral de conceptos en progreso", "Comunicación y situaciones", "Gramática y estructuras", "Sistema verbal y conjugación", "Vocabulario y léxico objetivo", "Ortografía, grafía y fonética", "Dominado", "No dominado", "En progreso", "No evaluable"],
  de: ["Dein Sprachbereich wurde gespeichert, aber der Kurs wurde nicht erstellt.", "Nichts ging verloren. Prüfe die Auswahl und starte die Kurserstellung erneut.", "Bericht zur Begriffsbeherrschung", "Dieser Bericht beruht nur auf verifizierten Nachweisen. Eine nicht verfügbare Bewertung zählt weder als Misserfolg noch als Beherrschung.", "Beherrscht", "Zu festigen", "90%-Schwelle der Begriffe erreicht", "Begriffsschwelle in Bearbeitung", "Kommunikation und Situationen", "Grammatik und Strukturen", "Verbalsystem und Konjugation", "Wortschatz und Ziellexik", "Rechtschreibung, Schrift und Phonetik", "Beherrscht", "Nicht beherrscht", "In Bearbeitung", "Nicht bewertbar"],
  it: ["Il tuo spazio linguistico è stato salvato, ma il corso non è stato creato.", "Non è andato perso nulla. Controlla le scelte e riprova a creare il corso.", "Bollettino di padronanza delle nozioni", "Il bollettino riflette solo prove verificate. Una valutazione non disponibile non conta né come insuccesso né come padronanza.", "Padroneggiate", "Da rafforzare", "Soglia del 90% delle nozioni raggiunta", "Soglia delle nozioni in corso", "Comunicazione e situazioni", "Grammatica e strutture", "Sistema verbale e coniugazione", "Vocabolario e lessico obiettivo", "Ortografia, grafia e fonetica", "Padroneggiata", "Non padroneggiata", "In corso", "Non valutabile"],
  pt: ["O teu espaço de idioma foi guardado, mas o curso não foi criado.", "Nada se perdeu. Revê as opções e tenta criar o curso novamente.", "Relatório de domínio das noções", "Este relatório reflete apenas provas verificadas. Uma avaliação indisponível não conta como falha nem como domínio.", "Dominadas", "A reforçar", "Limiar de 90% das noções atingido", "Limiar das noções em progresso", "Comunicação e situações", "Gramática e estruturas", "Sistema verbal e conjugação", "Vocabulário e léxico-alvo", "Ortografia, grafia e fonética", "Dominada", "Não dominada", "Em progresso", "Não avaliável"],
  hi: ["आपका भाषा क्षेत्र सहेजा गया, लेकिन पाठ्यक्रम नहीं बना।", "कुछ भी नहीं खोया। विकल्प जाँचें और पाठ्यक्रम फिर से बनाने का प्रयास करें।", "अवधारणा दक्षता रिपोर्ट", "यह रिपोर्ट केवल सत्यापित प्रमाण दिखाती है। अनुपलब्ध मूल्यांकन न असफलता माना जाता है, न दक्षता।", "दक्ष", "मज़बूत करना है", "अवधारणाओं की 90% सीमा पूरी हुई", "अवधारणा सीमा प्रगति पर है", "संचार और परिस्थितियाँ", "व्याकरण और संरचनाएँ", "क्रिया-तंत्र और रूप-संयोजन", "शब्दावली और लक्षित शब्द-संग्रह", "वर्तनी, लिपि और ध्वनिविज्ञान", "दक्ष", "अभी दक्ष नहीं", "प्रगति पर", "मूल्यांकन योग्य नहीं"],
  tr: ["Dil alanın kaydedildi ancak kurs oluşturulamadı.", "Hiçbir şey kaybolmadı. Seçimleri kontrol edip kursu yeniden oluşturmayı dene.", "Kavram hâkimiyeti raporu", "Bu rapor yalnızca doğrulanmış kanıtlara dayanır. Yapılamayan bir değerlendirme ne başarısızlık ne de hâkimiyet sayılır.", "Öğrenilen", "Güçlendirilecek", "Kavramlarda %90 eşiğine ulaşıldı", "Kavram eşiği ilerliyor", "İletişim ve durumlar", "Dil bilgisi ve yapılar", "Fiil sistemi ve çekim", "Söz varlığı ve hedef kelimeler", "Yazım, grafik biçim ve fonetik", "Öğrenildi", "Henüz öğrenilmedi", "Devam ediyor", "Değerlendirilemez"],
  pl: ["Twoja przestrzeń językowa została zapisana, ale kurs nie został utworzony.", "Nic nie zginęło. Sprawdź wybory i ponów tworzenie kursu.", "Raport opanowania pojęć", "Raport odzwierciedla wyłącznie zweryfikowane dowody. Niedostępna ocena nie oznacza ani porażki, ani opanowania.", "Opanowane", "Do wzmocnienia", "Osiągnięto próg 90% pojęć", "Próg pojęć w trakcie", "Komunikacja i sytuacje", "Gramatyka i struktury", "System czasownikowy i koniugacja", "Słownictwo i leksyka docelowa", "Ortografia, zapis i fonetyka", "Opanowane", "Nieopanowane", "W trakcie", "Nie można ocenić"],
  ru: ["Языковое пространство сохранено, но курс не создан.", "Ничего не потеряно. Проверьте настройки и повторите создание курса.", "Отчёт об освоении понятий", "Отчёт основан только на подтверждённых данных. Недоступная оценка не считается ни неудачей, ни освоением.", "Освоено", "Нужно укрепить", "Достигнут порог 90% понятий", "Освоение порога продолжается", "Общение и ситуации", "Грамматика и структуры", "Глагольная система и спряжение", "Словарный запас и целевая лексика", "Орфография, письмо и фонетика", "Освоено", "Не освоено", "В процессе", "Нельзя оценить"],
  zh: ["你的语言空间已保存，但课程尚未创建。", "没有丢失任何内容。请检查选项并重新创建课程。", "概念掌握报告", "本报告仅依据已验证的证据。无法进行的评估既不算失败，也不算掌握。", "已掌握", "待加强", "已达到概念掌握 90% 门槛", "概念掌握门槛进行中", "沟通与情境", "语法与结构", "动词系统与变位", "词汇与目标词库", "正字法、书写与语音", "已掌握", "未掌握", "进行中", "无法评估"],
  vi: ["Không gian ngôn ngữ của bạn đã được lưu nhưng khóa học chưa được tạo.", "Không có dữ liệu nào bị mất. Hãy kiểm tra lựa chọn rồi thử tạo lại khóa học.", "Báo cáo mức độ làm chủ khái niệm", "Báo cáo này chỉ phản ánh bằng chứng đã xác minh. Đánh giá không khả dụng không được tính là thất bại hay đã làm chủ.", "Đã làm chủ", "Cần củng cố", "Đã đạt ngưỡng 90% khái niệm", "Đang tiến tới ngưỡng khái niệm", "Giao tiếp và tình huống", "Ngữ pháp và cấu trúc", "Hệ thống động từ và chia động từ", "Từ vựng và vốn từ mục tiêu", "Chính tả, chữ viết và ngữ âm", "Đã làm chủ", "Chưa làm chủ", "Đang tiến hành", "Không thể đánh giá"],
  ja: ["言語スペースは保存されましたが、コースは作成されませんでした。", "失われた内容はありません。選択内容を確認して、コース作成を再試行してください。", "概念習得レポート", "このレポートは検証済みの証拠のみを反映します。評価できない項目は、不合格にも習得済みにも数えません。", "習得済み", "要強化", "概念の90%基準を達成", "概念の基準に向けて進行中", "コミュニケーションと場面", "文法と構造", "動詞体系と活用", "語彙と目標語彙", "正書法・文字・音声", "習得済み", "未習得", "進行中", "評価不可"],
  sv: ["Ditt språkutrymme sparades, men kursen skapades inte.", "Inget gick förlorat. Kontrollera valen och försök skapa kursen igen.", "Rapport över begreppsbehärskning", "Rapporten bygger endast på verifierade belägg. En otillgänglig bedömning räknas varken som misslyckande eller behärskning.", "Behärskade", "Att stärka", "Gränsen på 90 % för begrepp är nådd", "Begreppsgränsen pågår", "Kommunikation och situationer", "Grammatik och strukturer", "Verbalsystem och böjning", "Ordförråd och målordförråd", "Ortografi, skrift och fonetik", "Behärskad", "Inte behärskad", "Pågår", "Kan inte bedömas"],
  th: ["พื้นที่ภาษาของคุณถูกบันทึกแล้ว แต่ยังไม่ได้สร้างหลักสูตร", "ไม่มีข้อมูลสูญหาย โปรดตรวจสอบตัวเลือกแล้วลองสร้างหลักสูตรอีกครั้ง", "รายงานการเรียนรู้แนวคิด", "รายงานนี้อ้างอิงเฉพาะหลักฐานที่ตรวจสอบแล้ว การประเมินที่ทำไม่ได้ไม่นับเป็นความล้มเหลวหรือการเรียนรู้สำเร็จ", "เรียนรู้แล้ว", "ต้องเสริม", "ถึงเกณฑ์แนวคิด 90% แล้ว", "กำลังไปสู่เกณฑ์แนวคิด", "การสื่อสารและสถานการณ์", "ไวยากรณ์และโครงสร้าง", "ระบบคำกริยาและการผัน", "คำศัพท์และคลังคำเป้าหมาย", "การสะกด รูปอักษร และสัทศาสตร์", "เรียนรู้แล้ว", "ยังไม่เรียนรู้", "กำลังดำเนินการ", "ประเมินไม่ได้"],
  ar: ["تم حفظ مساحة اللغة، لكن لم يتم إنشاء الدورة.", "لم يضع شيء. راجع الاختيارات ثم حاول إنشاء الدورة من جديد.", "تقرير إتقان المفاهيم", "يعكس هذا التقرير الأدلة المتحقق منها فقط. التقييم غير المتاح لا يُحسب فشلًا ولا إتقانًا.", "متقنة", "بحاجة إلى تعزيز", "تم بلوغ عتبة 90٪ من المفاهيم", "التقدم نحو عتبة المفاهيم مستمر", "التواصل والمواقف", "القواعد والتراكيب", "نظام الأفعال والتصريف", "المفردات والمعجم المستهدف", "الإملاء والكتابة والصوتيات", "متقنة", "غير متقنة", "قيد التقدم", "غير قابلة للتقييم"],
  ko: ["언어 공간은 저장되었지만 코스가 생성되지 않았습니다.", "잃어버린 내용은 없습니다. 선택 사항을 확인하고 코스 생성을 다시 시도하세요.", "개념 숙달 보고서", "이 보고서는 검증된 근거만 반영합니다. 평가할 수 없는 항목은 실패나 숙달로 계산하지 않습니다.", "숙달", "강화 필요", "개념 90% 기준 달성", "개념 기준 진행 중", "의사소통과 상황", "문법과 구조", "동사 체계와 활용", "어휘와 목표 어휘", "철자법, 표기와 음성학", "숙달", "미숙달", "진행 중", "평가 불가"],
  nl: ["Je taalruimte is opgeslagen, maar de cursus is niet aangemaakt.", "Er is niets verloren. Controleer de keuzes en probeer de cursus opnieuw aan te maken.", "Rapport begripsbeheersing", "Dit rapport weerspiegelt alleen geverifieerd bewijs. Een niet-beschikbare beoordeling telt niet als mislukking of beheersing.", "Beheerst", "Te versterken", "Drempel van 90% van de begrippen bereikt", "Begripsdrempel in uitvoering", "Communicatie en situaties", "Grammatica en structuren", "Werkwoordsysteem en vervoeging", "Woordenschat en doellexicon", "Spelling, schrift en fonetiek", "Beheerst", "Niet beheerst", "Bezig", "Niet beoordeelbaar"],
  el: ["Ο χώρος γλώσσας αποθηκεύτηκε, αλλά το μάθημα δεν δημιουργήθηκε.", "Δεν χάθηκε τίποτα. Ελέγξτε τις επιλογές και δοκιμάστε ξανά να δημιουργήσετε το μάθημα.", "Δελτίο κατάκτησης εννοιών", "Το δελτίο βασίζεται μόνο σε επαληθευμένα στοιχεία. Μια μη διαθέσιμη αξιολόγηση δεν μετρά ούτε ως αποτυχία ούτε ως κατάκτηση.", "Κατακτημένες", "Προς ενίσχυση", "Επιτεύχθηκε το όριο 90% των εννοιών", "Το όριο εννοιών βρίσκεται σε εξέλιξη", "Επικοινωνία και καταστάσεις", "Γραμματική και δομές", "Ρηματικό σύστημα και κλίση", "Λεξιλόγιο και λεξιλόγιο-στόχος", "Ορθογραφία, γραφή και φωνητική", "Κατακτημένη", "Μη κατακτημένη", "Σε εξέλιξη", "Μη αξιολογήσιμη"],
  cs: ["Jazykový prostor byl uložen, ale kurz nebyl vytvořen.", "Nic se neztratilo. Zkontrolujte volby a zkuste kurz vytvořit znovu.", "Přehled zvládnutí pojmů", "Přehled vychází pouze z ověřených důkazů. Nedostupné hodnocení se nepočítá jako neúspěch ani jako zvládnutí.", "Zvládnuté", "K posílení", "Dosažena 90% hranice pojmů", "Hranice pojmů se plní", "Komunikace a situace", "Gramatika a struktury", "Slovesný systém a časování", "Slovní zásoba a cílové lexikum", "Pravopis, zápis a fonetika", "Zvládnuto", "Nezvládnuto", "Probíhá", "Nelze hodnotit"],
  ro: ["Spațiul tău de limbă a fost salvat, dar cursul nu a fost creat.", "Nu s-a pierdut nimic. Verifică opțiunile și încearcă din nou să creezi cursul.", "Raport de stăpânire a noțiunilor", "Raportul reflectă doar dovezi verificate. O evaluare indisponibilă nu este considerată nici eșec, nici stăpânire.", "Stăpânite", "De consolidat", "Pragul de 90% al noțiunilor a fost atins", "Pragul noțiunilor este în curs", "Comunicare și situații", "Gramatică și structuri", "Sistem verbal și conjugare", "Vocabular și lexic țintă", "Ortografie, grafie și fonetică", "Stăpânită", "Nestăpânită", "În curs", "Neevaluabilă"],
  hu: ["A nyelvi területed mentve lett, de a kurzus nem jött létre.", "Semmi sem veszett el. Ellenőrizd a beállításokat, majd próbáld újra létrehozni a kurzust.", "Fogalomelsajátítási jelentés", "A jelentés kizárólag ellenőrzött bizonyítékokra épül. A nem elérhető értékelés nem számít sem kudarcnak, sem elsajátításnak.", "Elsajátítva", "Megerősítendő", "A fogalmak 90%-os küszöbe elérve", "A fogalmi küszöb teljesítése folyamatban", "Kommunikáció és helyzetek", "Nyelvtan és szerkezetek", "Igerendszer és ragozás", "Szókincs és célszókészlet", "Helyesírás, íráskép és fonetika", "Elsajátítva", "Nincs elsajátítva", "Folyamatban", "Nem értékelhető"],
  da: ["Dit sprogområde blev gemt, men kurset blev ikke oprettet.", "Intet gik tabt. Kontrollér valgene, og prøv at oprette kurset igen.", "Rapport over begrebsbeherskelse", "Rapporten bygger kun på verificeret evidens. En utilgængelig vurdering tæller hverken som fiasko eller beherskelse.", "Behersket", "Skal styrkes", "90%-grænsen for begreber er nået", "Begrebsgrænsen er undervejs", "Kommunikation og situationer", "Grammatik og strukturer", "Verbalsystem og bøjning", "Ordforråd og målrettet leksikon", "Retskrivning, skrift og fonetik", "Behersket", "Ikke behersket", "I gang", "Kan ikke vurderes"],
  fi: ["Kielialueesi tallennettiin, mutta kurssia ei luotu.", "Mitään ei kadonnut. Tarkista valinnat ja yritä luoda kurssi uudelleen.", "Käsitteiden hallintaraportti", "Raportti perustuu vain vahvistettuun näyttöön. Arvioimatta jäänyt kohta ei merkitse epäonnistumista eikä hallintaa.", "Hallittu", "Vahvistettava", "Käsitteiden 90%:n raja saavutettu", "Käsiterajan saavuttaminen käynnissä", "Viestintä ja tilanteet", "Kielioppi ja rakenteet", "Verbijärjestelmä ja taivutus", "Sanasto ja kohdesanasto", "Oikeinkirjoitus, kirjoitusasu ja fonetiikka", "Hallittu", "Ei hallittu", "Käynnissä", "Ei arvioitavissa"],
  id: ["Ruang bahasa Anda telah disimpan, tetapi kursus belum dibuat.", "Tidak ada yang hilang. Periksa pilihan lalu coba buat kursus lagi.", "Laporan penguasaan konsep", "Laporan ini hanya mencerminkan bukti terverifikasi. Penilaian yang tidak tersedia tidak dihitung sebagai kegagalan maupun penguasaan.", "Dikuasai", "Perlu diperkuat", "Ambang 90% konsep tercapai", "Ambang konsep sedang dicapai", "Komunikasi dan situasi", "Tata bahasa dan struktur", "Sistem verba dan konjugasi", "Kosakata dan leksikon sasaran", "Ejaan, grafi, dan fonetik", "Dikuasai", "Belum dikuasai", "Sedang berlangsung", "Tidak dapat dinilai"],
  nb: ["Språkområdet ditt ble lagret, men kurset ble ikke opprettet.", "Ingenting gikk tapt. Kontroller valgene og prøv å opprette kurset på nytt.", "Rapport om begrepsmestring", "Rapporten bygger bare på bekreftede bevis. En utilgjengelig vurdering teller verken som feil eller mestring.", "Mestret", "Må styrkes", "90%-grensen for begreper er nådd", "Begrepsgrensen er under arbeid", "Kommunikasjon og situasjoner", "Grammatikk og strukturer", "Verbalsystem og bøying", "Ordforråd og målleksikon", "Rettskriving, skrift og fonetikk", "Mestret", "Ikke mestret", "Pågår", "Kan ikke vurderes"],
  uk: ["Ваш мовний простір збережено, але курс не створено.", "Нічого не втрачено. Перевірте вибір і спробуйте створити курс ще раз.", "Звіт про опанування понять", "Звіт ґрунтується лише на перевірених доказах. Недоступне оцінювання не вважається ні невдачею, ні опануванням.", "Опановано", "Потрібно посилити", "Досягнуто поріг 90% понять", "Досягнення порогу понять триває", "Спілкування і ситуації", "Граматика і структури", "Дієслівна система і відмінювання", "Словниковий запас і цільова лексика", "Правопис, письмо і фонетика", "Опановано", "Не опановано", "У процесі", "Не можна оцінити"],
  ln: ["Esika na yo ya monɔkɔ ebombami, kasi kelasi esalemi te.", "Eloko moko ebungi te. Tala lisusu maponi mpe meká kosala kelasi lisusu.", "Bulletin ya boyebi makambo", "Bulletin oyo esalelaka kaka bilembeteli oyo endimami. Evaluation oyo ekoki kosalema te etangami te lokola kokweya to koyeba.", "Oyebi yango", "Esengeli kolendisa", "Okómi na ndelo ya 90% ya makambo", "Ozali kokende na ndelo ya makambo", "Kosolola mpe makambo ya bomoi", "Grammaire mpe ndenge ya kotonga", "Système ya ba-verbe mpe conjugaison", "Maloba mpe lexique oyo olingi koyeba", "Orthographe, graphie mpe phonétique", "Oyebi yango", "Oyebi yango naino te", "Ezali kokoba", "Ekoki kozwa evaluation te"],
  sw: ["Nafasi yako ya lugha imehifadhiwa, lakini kozi haikuundwa.", "Hakuna kilichopotea. Kagua chaguo kisha ujaribu kuunda kozi tena.", "Ripoti ya umahiri wa dhana", "Ripoti hii hutegemea ushahidi uliothibitishwa pekee. Tathmini isiyopatikana haihesabiwi kama kushindwa wala umahiri.", "Zimeeleweka", "Za kuimarisha", "Kizingiti cha 90% cha dhana kimefikiwa", "Kizingiti cha dhana kinaendelea", "Mawasiliano na hali", "Sarufi na miundo", "Mfumo wa vitenzi na unyambulishaji", "Msamiati na leksikoni lengwa", "Tahajia, mwandiko na fonetiki", "Imeeleweka", "Haijaeleweka", "Inaendelea", "Haiwezi kutathminiwa"],
  wo: ["Sa dencukaayu làkk bi aar nañu ko, waaye njàng mi sosu-gul.", "Dara réerul. Seetal tànneef yi te jéemaat sos njàng mi.", "Xibaaru man a xam xalaat yi", "Xibaar bii sukkandiku na ci firnde yu wóor rekk. Lu ñu manul a natt du tekki daanu mbaa man ko.", "Xam nañu ko", "War a dëgëral", "Àgg nañu ci tolluwaayu 90% ci xalaat yi", "Jëm nañu ci tolluwaayu xalaat yi", "Waxtaan ak xaalis yi", "Njàngat ak tëggin yi", "Nosteg wax-jëf ak soppi", "Kàddu yi ak baatu jubluwaay", "Mbind, nataal baat ak fonetik", "Xam nañu ko", "Xamagul ko", "Mi ngi ci yoon", "Manu koo natt"],
  ha: ["An adana filin harshenka, amma ba a ƙirƙiri kwas ɗin ba.", "Babu abin da ya ɓace. Duba zaɓuɓɓukan sannan ka sake gwada ƙirƙirar kwas.", "Rahoton ƙwarewar fahimta", "Wannan rahoto yana dogara ne kawai kan shaidar da aka tabbatar. Gwajin da ba ya samuwa ba ya nufin gazawa ko ƙwarewa.", "An ƙware", "A ƙarfafa", "An kai iyakar 90% na fahimta", "Ana ci gaba zuwa iyakar fahimta", "Sadarwa da yanayi", "Nahawu da tsari", "Tsarin aikatau da sarrafawa", "Kalmomi da ƙamus na manufa", "Rubutun kalma, zane da sauti", "An ƙware", "Ba a ƙware ba", "Ana ci gaba", "Ba za a iya tantancewa ba"],
  he: ["מרחב השפה שלך נשמר, אך הקורס לא נוצר.", "דבר לא אבד. בדוק את הבחירות ונסה ליצור את הקורס שוב.", "דוח שליטה במושגים", "הדוח משקף רק ראיות מאומתות. הערכה שאינה זמינה אינה נחשבת לכישלון או לשליטה.", "נשלטו", "לחיזוק", "הושג סף של 90% מהמושגים", "סף המושגים בתהליך", "תקשורת ומצבים", "דקדוק ומבנים", "מערכת הפועל והטיה", "אוצר מילים ולקסיקון יעד", "כתיב, כתב ופונטיקה", "נשלט", "לא נשלט", "בתהליך", "לא ניתן להערכה"],
  'zh-Hant': ["你的語言空間已儲存，但課程尚未建立。", "沒有遺失任何內容。請檢查選項並重新建立課程。", "概念掌握報告", "本報告只依據已驗證的證據。無法進行的評量既不算失敗，也不算掌握。", "已掌握", "待加強", "已達到概念掌握 90% 門檻", "概念掌握門檻進行中", "溝通與情境", "文法與結構", "動詞系統與變位", "詞彙與目標詞庫", "正字法、書寫與語音", "已掌握", "未掌握", "進行中", "無法評量"],
  bn: ["আপনার ভাষার স্থান সংরক্ষিত হয়েছে, কিন্তু কোর্স তৈরি হয়নি।", "কিছুই হারায়নি। পছন্দগুলো যাচাই করে আবার কোর্স তৈরির চেষ্টা করুন।", "ধারণা আয়ত্তের প্রতিবেদন", "এই প্রতিবেদন শুধু যাচাইকৃত প্রমাণ দেখায়। অনুপলব্ধ মূল্যায়ন ব্যর্থতা বা আয়ত্ত হিসেবে গণ্য হয় না।", "আয়ত্ত হয়েছে", "আরও শক্তিশালী করতে হবে", "ধারণার ৯০% সীমা অর্জিত", "ধারণার সীমার দিকে অগ্রগতি চলছে", "যোগাযোগ ও পরিস্থিতি", "ব্যাকরণ ও কাঠামো", "ক্রিয়া-ব্যবস্থা ও রূপান্তর", "শব্দভাণ্ডার ও লক্ষ্যভিত্তিক শব্দ", "বানান, লিপি ও ধ্বনিবিজ্ঞান", "আয়ত্ত হয়েছে", "আয়ত্ত হয়নি", "চলমান", "মূল্যায়নযোগ্য নয়"],
};

export const languageMasteryAliases: Partial<Record<(typeof languageMasteryKeys)[number], string>> = {
  'rlle.ui.autonomy.notice': 'teacher.exam.feedbackAfter',
  'rlle.ui.autonomy.verdict.mastered': 'rlle.ui.cando.status.validated',
  'rlle.ui.autonomy.verdict.not-mastered': 'lesson.notQuite',
  'rlle.ui.autonomy.verdict.not-evaluable': 'rlle.ui.course.notEvaluated',
  'rlle.ui.autonomy.leaveForHelp': 'rlle.ui.common.backCourse',
  'rlle.ui.autonomy.start': 'examiner.take',
  'rlle.ui.autonomy.resume': 'home4.resumeAction',
  'rlle.ui.remediation.start': 'rlle.ui.repair.retry-now',
  'rlle.ui.remediation.ready': 'state.success',
  'rlle.ui.training.format.recognition-mcq': 'examiner.t.mcq',
  'rlle.ui.training.format.contextual-discrimination': 'rlle.ui.stage.comprehension',
  'rlle.ui.training.format.fill-blank-no-hint': 'rlle.ui.stage.practice',
  'rlle.ui.training.format.sentence-reconstruction': 'rlle.ui.dimension.writing',
  'rlle.ui.training.format.register-matching': 'rlle.ui.stage.comprehension',
  'rlle.ui.training.format.error-correction': 'daily.p.correction',
  'rlle.ui.training.format.listening-discrimination': 'rlle.ui.dimension.listening',
  'rlle.ui.training.format.guided-writing': 'rlle.ui.dimension.writing',
  'rlle.ui.training.format.voice-pronunciation': 'rlle.ui.dimension.pronunciation',
  'rlle.ui.training.format.mini-dialogue': 'rlle.ui.dimension.conversation',
  'rlle.ui.training.tokenBank': 'rlle.ui.strand.vocabulary',
  'rlle.ui.training.voice': 'learn5.modality.speak',
  'rlle.ui.training.answer': 'examiner.yourAnswer',
  'rlle.ui.capabilities.title': 'languages11.practice.oral',
  'rlle.ui.capabilities.detail': 'languages11.oral.detail',
  'rlle.ui.capabilities.audioCapture': 'learn5.modality.speak',
  'rlle.ui.capabilities.transcription': 'voice11.state.transcription',
  'rlle.ui.capabilities.spokenContent': 'languages11.practice.oral',
  'rlle.ui.capabilities.listening': 'rlle.ui.dimension.listening',
  'rlle.ui.capabilities.graphy': 'rlle.ui.dimension.writing',
  'rlle.ui.capabilities.pronunciation': 'rlle.ui.dimension.pronunciation',
  'rlle.ui.capabilities.available': 'state.success',
  'rlle.ui.capabilities.runtimeRequired': 'voice11.state.ready',
  'rlle.ui.capabilities.notEvaluable': 'rlle.ui.dimension.status.not-evaluated',
  'rlle.ui.capabilities.providerReady': 'state.success',
  'rlle.ui.capabilities.blocked': 'state.partial',
  'rlle.ui.capabilities.blockedDetail': 'rlle.ui.course.notEvaluated',
  'rlle.ui.capabilities.checkMicrophone': 'learn.oral.record',
  'rlle.ui.capabilities.strictDisabled': 'rlle.ui.course.notEvaluated',
};

for (const code of languageMasteryLocaleCodes) {
  extendLocaleAliases(code, languageMasteryAliases);
  const values = languageBulletinTranslations[code];
  const catalog = Object.fromEntries(
    languageBulletinKeys.map((key, index) => [key, values[index]]),
  ) as Record<LanguageBulletinKey, string>;
  extendLocale(code, catalog);
}
