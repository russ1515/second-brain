import { extendLocale } from '../i18n';

/**
 * Bounded copy for choosing the pedagogical support language.
 *
 * This overlay keeps the two language roles explicit in every selectable
 * interface locale without regenerating the established 34 catalogs.
 */
export const teachingLanguageKeys = [
  'rlle.ui.teachingLanguage.detail',
  'rlle.ui.teachingLanguage.existingCourse',
] as const;

type TeachingLanguageCopy = readonly [string, string];

export const teachingLanguageTranslations: Record<string, TeachingLanguageCopy> = {
  es: [
    'Elige si las explicaciones, instrucciones, correcciones y resúmenes usan el idioma de la interfaz o tu lengua materna.',
    'Tu curso actual se conserva. El contenido nuevo usa esta elección; regenera las explicaciones antiguas solo si quieres adaptarlas.',
  ],
  de: [
    'Wähle, ob Erklärungen, Anweisungen, Korrekturen und Zusammenfassungen die Sprache der Benutzeroberfläche oder deine Muttersprache verwenden.',
    'Dein bestehender Kurs bleibt erhalten. Neue Inhalte verwenden diese Auswahl; erstelle ältere Erklärungen nur neu, wenn du sie anpassen möchtest.',
  ],
  it: [
    'Scegli se spiegazioni, istruzioni, correzioni e sintesi usano la lingua dell’interfaccia o la tua lingua madre.',
    'Il corso esistente viene conservato. I nuovi contenuti usano questa scelta; rigenera le vecchie spiegazioni solo se vuoi adattarle.',
  ],
  pt: [
    'Escolhe se as explicações, instruções, correções e sínteses usam o idioma da interface ou a tua língua materna.',
    'O curso existente é preservado. Os novos conteúdos usam esta escolha; regenera explicações antigas apenas se quiseres adaptá-las.',
  ],
  hi: [
    'चुनें कि व्याख्याएँ, निर्देश, सुधार और सारांश इंटरफ़ेस की भाषा में हों या आपकी मातृभाषा में।',
    'आपका मौजूदा पाठ्यक्रम सुरक्षित रहता है। नई सामग्री इस विकल्प का उपयोग करेगी; पुरानी व्याख्याओं को केवल तब दोबारा बनाएँ जब आप उन्हें अनुकूलित करना चाहें।',
  ],
  tr: [
    'Açıklamaların, yönergelerin, düzeltmelerin ve özetlerin arayüz dilini mi yoksa ana dilini mi kullanacağını seç.',
    'Mevcut kursun korunur. Yeni içerik bu seçimi kullanır; eski açıklamaları yalnızca uyarlamak istiyorsan yeniden oluştur.',
  ],
  pl: [
    'Wybierz, czy wyjaśnienia, instrukcje, poprawki i podsumowania mają używać języka interfejsu czy języka ojczystego.',
    'Obecny kurs zostaje zachowany. Nowe treści użyją tego wyboru; starsze wyjaśnienia wygeneruj ponownie tylko wtedy, gdy chcesz je dostosować.',
  ],
  ru: [
    'Выберите, будут ли объяснения, инструкции, исправления и итоги использовать язык интерфейса или ваш родной язык.',
    'Текущий курс сохраняется. Новые материалы используют этот выбор; создавайте старые объяснения заново только при необходимости их адаптации.',
  ],
  zh: [
    '选择讲解、说明、纠正和总结使用界面语言还是你的母语。',
    '现有课程会被保留。新内容将使用此选择；只有需要调整旧讲解时才重新生成。',
  ],
  vi: [
    'Chọn dùng ngôn ngữ giao diện hay tiếng mẹ đẻ cho phần giải thích, hướng dẫn, sửa lỗi và tổng kết.',
    'Khóa học hiện tại được giữ nguyên. Nội dung mới dùng lựa chọn này; chỉ tạo lại phần giải thích cũ khi bạn muốn điều chỉnh chúng.',
  ],
  ja: [
    '説明、指示、訂正、まとめにインターフェース言語と母語のどちらを使うか選択してください。',
    '既存のコースは保持されます。新しい内容にはこの選択が使われます。以前の説明を適応させたい場合にのみ再生成してください。',
  ],
  sv: [
    'Välj om förklaringar, instruktioner, rättelser och sammanfattningar ska använda gränssnittsspråket eller ditt modersmål.',
    'Din befintliga kurs bevaras. Nytt innehåll använder detta val; återskapa äldre förklaringar endast om du vill anpassa dem.',
  ],
  th: [
    'เลือกว่าจะใช้ภาษาของส่วนติดต่อหรือภาษาแม่สำหรับคำอธิบาย คำสั่ง การแก้ไข และบทสรุป',
    'หลักสูตรเดิมของคุณจะยังคงอยู่ เนื้อหาใหม่จะใช้ตัวเลือกนี้ และสร้างคำอธิบายเดิมใหม่เฉพาะเมื่อคุณต้องการปรับให้เหมาะสม',
  ],
  ar: [
    'اختر ما إذا كانت الشروحات والتعليمات والتصحيحات والملخصات تستخدم لغة الواجهة أم لغتك الأم.',
    'يُحفظ مقررك الحالي. يستخدم المحتوى الجديد هذا الاختيار؛ أعد إنشاء الشروحات القديمة فقط إذا أردت تكييفها.',
  ],
  ko: [
    '설명, 지시, 교정 및 요약에 인터페이스 언어와 모국어 중 어느 언어를 사용할지 선택하세요.',
    '기존 코스는 보존됩니다. 새 콘텐츠에는 이 선택이 적용되며, 이전 설명을 조정하려는 경우에만 다시 생성하세요.',
  ],
  nl: [
    'Kies of uitleg, instructies, correcties en samenvattingen de interfacetaal of je moedertaal gebruiken.',
    'Je bestaande cursus blijft behouden. Nieuwe inhoud gebruikt deze keuze; genereer oudere uitleg alleen opnieuw als je die wilt aanpassen.',
  ],
  el: [
    'Επίλεξε αν οι εξηγήσεις, οι οδηγίες, οι διορθώσεις και οι συνόψεις θα χρησιμοποιούν τη γλώσσα διεπαφής ή τη μητρική σου γλώσσα.',
    'Το υπάρχον μάθημά σου διατηρείται. Το νέο περιεχόμενο χρησιμοποιεί αυτή την επιλογή· αναδημιούργησε παλιές εξηγήσεις μόνο αν θέλεις να τις προσαρμόσεις.',
  ],
  cs: [
    'Zvolte, zda mají vysvětlení, pokyny, opravy a shrnutí používat jazyk rozhraní, nebo váš mateřský jazyk.',
    'Stávající kurz zůstane zachován. Nový obsah použije tuto volbu; starší vysvětlení vytvořte znovu jen tehdy, chcete-li je přizpůsobit.',
  ],
  ro: [
    'Alege dacă explicațiile, instrucțiunile, corectările și sintezele folosesc limba interfeței sau limba ta maternă.',
    'Cursul existent este păstrat. Conținutul nou folosește această alegere; regenerează explicațiile vechi numai dacă vrei să le adaptezi.',
  ],
  hu: [
    'Válaszd ki, hogy a magyarázatok, utasítások, javítások és összefoglalók a felület nyelvét vagy az anyanyelvedet használják.',
    'A meglévő kurzus megmarad. Az új tartalom ezt a választást használja; a régi magyarázatokat csak akkor hozd létre újra, ha át szeretnéd alakítani őket.',
  ],
  da: [
    'Vælg, om forklaringer, instruktioner, rettelser og opsummeringer skal bruge grænsefladesproget eller dit modersmål.',
    'Dit eksisterende kursus bevares. Nyt indhold bruger dette valg; gendan kun ældre forklaringer, hvis du vil tilpasse dem.',
  ],
  fi: [
    'Valitse, käyttävätkö selitykset, ohjeet, korjaukset ja yhteenvedot käyttöliittymän kieltä vai äidinkieltäsi.',
    'Nykyinen kurssisi säilyy. Uusi sisältö käyttää tätä valintaa; luo vanhat selitykset uudelleen vain, jos haluat mukauttaa niitä.',
  ],
  id: [
    'Pilih apakah penjelasan, petunjuk, koreksi, dan ringkasan menggunakan bahasa antarmuka atau bahasa ibu Anda.',
    'Kursus yang ada tetap disimpan. Konten baru menggunakan pilihan ini; buat ulang penjelasan lama hanya jika Anda ingin menyesuaikannya.',
  ],
  nb: [
    'Velg om forklaringer, instruksjoner, rettelser og sammendrag skal bruke grensesnittspråket eller morsmålet ditt.',
    'Det eksisterende kurset bevares. Nytt innhold bruker dette valget; lag eldre forklaringer på nytt bare hvis du vil tilpasse dem.',
  ],
  uk: [
    'Виберіть, чи мають пояснення, інструкції, виправлення та підсумки використовувати мову інтерфейсу або вашу рідну мову.',
    'Поточний курс зберігається. Новий вміст використовує цей вибір; створюйте старі пояснення заново лише за потреби їх адаптувати.',
  ],
  ln: [
    'Poná soki bandimbola, malako, bobongisi mpe mikuse esalela monɔkɔ ya interface to monɔkɔ na yo ya mboka.',
    'Kelasi na yo ya kala ebombami. Makambo ya sika esalelaka liponi oyo; salá lisusu bandimbola ya kala kaka soki olingi kobongola yango.',
  ],
  sw: [
    'Chagua kama maelezo, maagizo, masahihisho na muhtasari vitumie lugha ya kiolesura au lugha yako ya kwanza.',
    'Kozi yako iliyopo inahifadhiwa. Maudhui mapya yanatumia chaguo hili; tengeneza upya maelezo ya zamani ikiwa tu unataka kuyarekebisha.',
  ],
  wo: [
    'Tànnal ndax leeral, ndigal, jubanti ak tënk yi di jëfandikoo làkku interfaas bi walla sa làkku ndey.',
    'Sa njàng mi nekk ba noppi dina des. Ëmbiit yu bees yi dinañu jëfandikoo tànneef bii; sosaat leeral yu mag yi rekk soo bëggee leen dëppale.',
  ],
  ha: [
    'Zaɓi ko bayanai, umarni, gyare-gyare da taƙaitawa su yi amfani da harshen manhaja ko harshenka na asali.',
    'Ana kiyaye kwas ɗinka na yanzu. Sabon abun ciki zai yi amfani da wannan zaɓi; sake samar da tsoffin bayanai ne kawai idan kana son daidaita su.',
  ],
  he: [
    'בחר אם הסברים, הוראות, תיקונים וסיכומים ישתמשו בשפת הממשק או בשפת האם שלך.',
    'הקורס הקיים נשמר. תוכן חדש ישתמש בבחירה זו; צור מחדש הסברים ישנים רק אם ברצונך להתאים אותם.',
  ],
  'zh-Hant': [
    '選擇說明、指示、訂正和摘要要使用介面語言還是你的母語。',
    '現有課程會保留。新內容將使用此選擇；只有需要調整舊說明時才重新產生。',
  ],
  bn: [
    'ব্যাখ্যা, নির্দেশনা, সংশোধন ও সারাংশে ইন্টারফেসের ভাষা নাকি আপনার মাতৃভাষা ব্যবহার হবে তা বেছে নিন।',
    'আপনার বর্তমান কোর্স সংরক্ষিত থাকবে। নতুন বিষয়বস্তু এই পছন্দ ব্যবহার করবে; পুরোনো ব্যাখ্যা মানিয়ে নিতে চাইলে তবেই আবার তৈরি করুন।',
  ],
};

for (const [code, values] of Object.entries(teachingLanguageTranslations)) {
  extendLocale(code, Object.fromEntries(
    teachingLanguageKeys.map((key, index) => [key, values[index]]),
  ));
}
