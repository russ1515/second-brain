import { extendLocale } from '../i18n';

/** Small, explicit UI overlay; pedagogical lesson bodies use supportLanguage
 * from the server, not the interface locale. Every selectable catalogue gets
 * the same keys; there is no English fallback used to claim completeness. */
export const languageLearningCoreKeys = [
  'learningCore.module.01', 'learningCore.module.02', 'learningCore.module.03',
  'learningCore.module.04', 'learningCore.module.05', 'learningCore.module.06',
  'learningCore.module.07', 'learningCore.module.08', 'learningCore.module.09',
  'learningCore.module.10', 'learningCore.module.11', 'learningCore.help',
  'learningCore.moduleAssessment', 'learningCore.levelAssessment',
  'learningCore.bestScore',
] as const;

export const languageLearningCoreTranslations: Record<string, string> = {
  en: 'Basics|Greetings & introductions|Vocabulary & expressions|Grammar & sentence building|Conjugation|Listening comprehension|Pronunciation & fluency|Speaking / oral expression|Conversation|Reading & written comprehension|Practice, review & assessment|Need help?|Module assessment|Level assessment',
  fr: 'Bases|Salutations et présentations|Vocabulaire et expressions|Grammaire et construction des phrases|Conjugaison|Compréhension orale|Prononciation et fluidité|Expression orale|Conversation|Lecture et compréhension écrite|Pratique, révision et évaluation|Besoin d’aide ?|Évaluation du module|Évaluation du niveau',
  es: 'Fundamentos|Saludos y presentaciones|Vocabulario y expresiones|Gramática y construcción de frases|Conjugación|Comprensión auditiva|Pronunciación y fluidez|Expresión oral|Conversación|Lectura y comprensión escrita|Práctica, repaso y evaluación|¿Necesitas ayuda?|Evaluación del módulo|Evaluación del nivel',
  de: 'Grundlagen|Begrüßung und Vorstellung|Wortschatz und Ausdrücke|Grammatik und Satzbau|Konjugation|Hörverstehen|Aussprache und Sprachfluss|Mündlicher Ausdruck|Konversation|Lesen und Textverständnis|Übung, Wiederholung und Bewertung|Brauchst du Hilfe?|Modulprüfung|Niveauprüfung',
  it: 'Basi|Saluti e presentazioni|Vocabolario ed espressioni|Grammatica e costruzione delle frasi|Coniugazione|Comprensione orale|Pronuncia e fluidità|Espressione orale|Conversazione|Lettura e comprensione scritta|Pratica, ripasso e valutazione|Hai bisogno di aiuto?|Valutazione del modulo|Valutazione del livello',
  pt: 'Fundamentos|Saudações e apresentações|Vocabulário e expressões|Gramática e construção de frases|Conjugação|Compreensão oral|Pronúncia e fluência|Expressão oral|Conversação|Leitura e compreensão escrita|Prática, revisão e avaliação|Precisas de ajuda?|Avaliação do módulo|Avaliação do nível',
  hi: 'बुनियादी बातें|अभिवादन और परिचय|शब्दावली और अभिव्यक्तियाँ|व्याकरण और वाक्य निर्माण|क्रिया रूप|सुनकर समझना|उच्चारण और प्रवाह|मौखिक अभिव्यक्ति|बातचीत|पठन और लिखित समझ|अभ्यास, पुनरावृत्ति और मूल्यांकन|मदद चाहिए?|मॉड्यूल का मूल्यांकन|स्तर का मूल्यांकन',
  tr: 'Temeller|Selamlaşma ve tanışma|Kelime bilgisi ve ifadeler|Dil bilgisi ve cümle kurma|Fiil çekimi|Dinlediğini anlama|Telaffuz ve akıcılık|Sözlü anlatım|Konuşma|Okuma ve yazılı anlama|Alıştırma, tekrar ve değerlendirme|Yardıma ihtiyacın var mı?|Modül değerlendirmesi|Seviye değerlendirmesi',
  pl: 'Podstawy|Powitania i przedstawianie się|Słownictwo i wyrażenia|Gramatyka i budowa zdań|Odmiana czasowników|Rozumienie ze słuchu|Wymowa i płynność|Wypowiedź ustna|Rozmowa|Czytanie i rozumienie tekstu|Ćwiczenia, powtórki i ocena|Potrzebujesz pomocy?|Ocena modułu|Ocena poziomu',
  ru: 'Основы|Приветствия и знакомство|Словарь и выражения|Грамматика и построение предложений|Спряжение|Понимание на слух|Произношение и беглость|Устная речь|Разговор|Чтение и понимание текста|Практика, повторение и оценка|Нужна помощь?|Оценка модуля|Оценка уровня',
  zh: '基础|问候与自我介绍|词汇与表达|语法与造句|动词变位|听力理解|发音与流利度|口语表达|会话|阅读与书面理解|练习、复习与评估|需要帮助吗？|模块评估|级别评估',
  vi: 'Kiến thức cơ bản|Chào hỏi và giới thiệu|Từ vựng và cách diễn đạt|Ngữ pháp và đặt câu|Chia động từ|Nghe hiểu|Phát âm và độ trôi chảy|Diễn đạt bằng lời|Hội thoại|Đọc và hiểu văn bản|Luyện tập, ôn tập và đánh giá|Bạn cần trợ giúp?|Đánh giá mô-đun|Đánh giá trình độ',
  ja: '基礎|挨拶と自己紹介|語彙と表現|文法と文の組み立て|動詞の活用|聞き取り|発音と流暢さ|口頭表現|会話|読解|練習・復習・評価|助けが必要ですか？|モジュール評価|レベル評価',
  sv: 'Grunder|Hälsningar och presentationer|Ordförråd och uttryck|Grammatik och meningsbyggnad|Verbböjning|Hörförståelse|Uttal och flyt|Muntlig framställning|Samtal|Läsning och textförståelse|Övning, repetition och bedömning|Behöver du hjälp?|Modulbedömning|Nivåbedömning',
  th: 'พื้นฐาน|การทักทายและแนะนำตัว|คำศัพท์และสำนวน|ไวยากรณ์และการสร้างประโยค|การผันคำกริยา|การฟังเพื่อความเข้าใจ|การออกเสียงและความคล่องแคล่ว|การพูดและการแสดงออก|การสนทนา|การอ่านและความเข้าใจภาษาเขียน|การฝึก ทบทวน และประเมินผล|ต้องการความช่วยเหลือไหม?|การประเมินโมดูล|การประเมินระดับ',
  ar: 'الأساسيات|التحيات والتعارف|المفردات والتعابير|القواعد وبناء الجمل|تصريف الأفعال|فهم المسموع|النطق والطلاقة|التعبير الشفهي|المحادثة|القراءة وفهم المكتوب|التدريب والمراجعة والتقييم|هل تحتاج إلى مساعدة؟|تقييم الوحدة|تقييم المستوى',
  ko: '기초|인사와 자기소개|어휘와 표현|문법과 문장 만들기|동사 활용|듣기 이해|발음과 유창성|말하기와 구두 표현|회화|읽기와 글 이해|연습·복습·평가|도움이 필요하신가요?|모듈 평가|수준 평가',
  nl: 'Basis|Begroeten en voorstellen|Woordenschat en uitdrukkingen|Grammatica en zinsbouw|Werkwoordvervoeging|Luistervaardigheid|Uitspraak en vloeiendheid|Spreekvaardigheid|Gesprek|Lezen en tekstbegrip|Oefening, herhaling en toetsing|Hulp nodig?|Moduletoets|Niveautoets',
  el: 'Βασικά|Χαιρετισμοί και συστάσεις|Λεξιλόγιο και εκφράσεις|Γραμματική και σύνταξη προτάσεων|Κλίση ρημάτων|Κατανόηση προφορικού λόγου|Προφορά και ευχέρεια|Προφορική έκφραση|Συνομιλία|Ανάγνωση και κατανόηση γραπτού λόγου|Εξάσκηση, επανάληψη και αξιολόγηση|Χρειάζεσαι βοήθεια;|Αξιολόγηση ενότητας|Αξιολόγηση επιπέδου',
  cs: 'Základy|Pozdravy a představování|Slovní zásoba a výrazy|Gramatika a stavba vět|Časování|Porozumění poslechu|Výslovnost a plynulost|Ústní vyjadřování|Konverzace|Čtení a porozumění textu|Procvičování, opakování a hodnocení|Potřebuješ pomoc?|Hodnocení modulu|Hodnocení úrovně',
  ro: 'Noțiuni de bază|Salutări și prezentări|Vocabular și expresii|Gramatică și construirea propozițiilor|Conjugare|Înțelegere orală|Pronunție și fluență|Exprimare orală|Conversație|Lectură și înțelegere scrisă|Practică, recapitulare și evaluare|Ai nevoie de ajutor?|Evaluarea modulului|Evaluarea nivelului',
  hu: 'Alapok|Köszönés és bemutatkozás|Szókincs és kifejezések|Nyelvtan és mondatalkotás|Igeragozás|Hallásértés|Kiejtés és folyékonyság|Szóbeli kifejezés|Társalgás|Olvasás és szövegértés|Gyakorlás, ismétlés és értékelés|Segítségre van szükséged?|Modulértékelés|Szintértékelés',
  da: 'Grundlæggende|Hilsner og præsentationer|Ordforråd og udtryk|Grammatik og sætningsopbygning|Bøjning af verber|Lytteforståelse|Udtale og flydende tale|Mundtlig fremstilling|Samtale|Læsning og tekstforståelse|Øvelse, repetition og vurdering|Brug for hjælp?|Modulvurdering|Niveauvurdering',
  fi: 'Perusteet|Tervehdykset ja esittäytyminen|Sanasto ja ilmaukset|Kielioppi ja lauseenmuodostus|Verbien taivutus|Kuullun ymmärtäminen|Ääntäminen ja sujuvuus|Suullinen ilmaisu|Keskustelu|Lukeminen ja tekstin ymmärtäminen|Harjoittelu, kertaus ja arviointi|Tarvitsetko apua?|Moduulin arviointi|Tason arviointi',
  id: 'Dasar-dasar|Salam dan perkenalan|Kosakata dan ungkapan|Tata bahasa dan penyusunan kalimat|Konjugasi|Pemahaman menyimak|Pelafalan dan kelancaran|Berbicara dan ungkapan lisan|Percakapan|Membaca dan pemahaman tertulis|Latihan, pengulangan, dan penilaian|Perlu bantuan?|Penilaian modul|Penilaian tingkat',
  nb: 'Grunnleggende|Hilsener og presentasjoner|Ordforråd og uttrykk|Grammatikk og setningsbygging|Verbbøyning|Lytteforståelse|Uttale og flyt|Muntlig uttrykk|Samtale|Lesing og tekstforståelse|Øving, repetisjon og vurdering|Trenger du hjelp?|Modulvurdering|Nivåvurdering',
  uk: 'Основи|Вітання та знайомство|Словниковий запас і вирази|Граматика та побудова речень|Дієвідмінювання|Розуміння на слух|Вимова та вільність мовлення|Усне висловлювання|Розмова|Читання та розуміння тексту|Практика, повторення й оцінювання|Потрібна допомога?|Оцінювання модуля|Оцінювання рівня',
  ln: 'Miboko|Mbote mpe komilakisa|Maloba mpe ndenge ya koloba|Mibeko ya monɔkɔ mpe kotonga bafraze|Kobongola baverbe|Koyeba makambo oyo oyoki|Kobimisa maloba mpe koloba malamu|Komonisa makanisi na monɔkɔ|Lisolo|Kotánga mpe koyeba makomi|Komeka, kozongela mpe kotala boyebi|Ozali na mposa ya lisalisi?|Kotala boyebi ya eteni|Kotala boyebi ya nivo',
  sw: 'Misingi|Salamu na kujitambulisha|Msamiati na misemo|Sarufi na uundaji wa sentensi|Unyambulishaji wa vitenzi|Ufahamu wa kusikiliza|Matamshi na ufasaha|Kujieleza kwa kuzungumza|Mazungumzo|Kusoma na kuelewa maandishi|Mazoezi, marudio na tathmini|Unahitaji msaada?|Tathmini ya moduli|Tathmini ya kiwango',
  wo: 'Njàngum njàlbéen|Nuyoo ak xamante|Baat ak waxin|Nàmpal ak tabax baat|Soppi melow jëfekaay|Dégg li ñuy wax|Waxin wu leer ak xéewal|Joxe xalaat ci wax|Waxtaan|Jàng ak dégg mbind|Tàggat, fàttaliku ak natt|Soxla nga ndimbal?|Nattu pàcc|Nattu tolluwaay',
  ha: 'Tushen karatu|Gaisuwa da gabatar da kai|Kalmomi da jimlolin magana|Nahawu da gina jimloli|Sauyin fi’ili|Fahimtar abin da aka ji|Furuci da iya magana a sarari|Bayyana ra’ayi da baki|Tattaunawa|Karatu da fahimtar rubutu|Atisaye, bita da tantancewa|Kana bukatar taimako?|Tantance sashi|Tantance mataki',
  he: 'יסודות|ברכות והיכרות|אוצר מילים וביטויים|דקדוק ובניית משפטים|נטיית פעלים|הבנת הנשמע|הגייה ושטף|הבעה בעל פה|שיחה|קריאה והבנת הנקרא|תרגול, חזרה והערכה|צריכים עזרה?|הערכת מודול|הערכת רמה',
  'zh-Hant': '基礎|問候與自我介紹|詞彙與表達|文法與造句|動詞變位|聽力理解|發音與流暢度|口語表達|會話|閱讀與書面理解|練習、複習與評量|需要協助嗎？|模組評量|級別評量',
  bn: 'ভিত্তি|শুভেচ্ছা ও পরিচয়|শব্দভান্ডার ও অভিব্যক্তি|ব্যাকরণ ও বাক্য গঠন|ক্রিয়ার রূপ|শুনে বোঝা|উচ্চারণ ও সাবলীলতা|মৌখিক অভিব্যক্তি|কথোপকথন|পড়া ও লিখিত বিষয় বোঝা|অনুশীলন, পুনরালোচনা ও মূল্যায়ন|সাহায্য দরকার?|মডিউল মূল্যায়ন|স্তর মূল্যায়ন',
};

const bestScoreTranslations: Record<string, string> = {
  en: 'Best score', fr: 'Meilleur score', es: 'Mejor puntuación', de: 'Bestes Ergebnis',
  it: 'Miglior punteggio', pt: 'Melhor pontuação', hi: 'सर्वश्रेष्ठ अंक', tr: 'En iyi puan',
  pl: 'Najlepszy wynik', ru: 'Лучший результат', zh: '最佳成绩', vi: 'Điểm cao nhất',
  ja: '最高得点', sv: 'Bästa resultat', th: 'คะแนนสูงสุด', ar: 'أفضل نتيجة', ko: '최고 점수',
  nl: 'Beste score', el: 'Καλύτερη βαθμολογία', cs: 'Nejlepší výsledek', ro: 'Cel mai bun punctaj',
  hu: 'Legjobb eredmény', da: 'Bedste resultat', fi: 'Paras tulos', id: 'Nilai terbaik',
  nb: 'Beste resultat', uk: 'Найкращий результат', ln: 'Bapwɛ ya malamu koleka',
  sw: 'Alama bora zaidi', wo: 'Natt bu gën', ha: 'Maki mafi kyau', he: 'הציון הגבוה ביותר',
  'zh-Hant': '最佳成績', bn: 'সেরা নম্বর',
};

for (const [code, row] of Object.entries(languageLearningCoreTranslations)) {
  const values = [...row.split('|'), bestScoreTranslations[code]!];
  if (values.length !== languageLearningCoreKeys.length) throw new Error(`Invalid learning-core copy: ${code}`);
  extendLocale(code, Object.fromEntries(languageLearningCoreKeys.map((key, index) => [key, values[index]!])));
}
