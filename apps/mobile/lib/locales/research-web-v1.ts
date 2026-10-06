import { extendLocale } from '../i18n';

/** Reviewed availability copy for the Web/connector provenance split. */
const researchWebV1: Record<string, [string, string]> = {
  ar: ['المصادر الخارجية المتخصصة غير متاحة', 'لم تتم تهيئة أي موصل متخصص. يظل البحث في الويب العام مستقلاً.'],
  bn: ['বিশেষায়িত বাহ্যিক উৎস উপলভ্য নয়', 'কোনো বিশেষায়িত সংযোগকারী কনফিগার করা নেই। সর্বজনীন ওয়েব অনুসন্ধান আলাদাভাবে কাজ করে।'],
  cs: ['Specializované externí zdroje nejsou dostupné', 'Není nakonfigurován žádný specializovaný konektor. Veřejné webové vyhledávání funguje nezávisle.'],
  da: ['Specialiserede eksterne kilder er ikke tilgængelige', 'Der er ikke konfigureret en specialiseret connector. Offentlig websøgning fungerer uafhængigt.'],
  de: ['Spezialisierte externe Quellen nicht verfügbar', 'Es ist kein spezialisierter Konnektor konfiguriert. Die öffentliche Websuche bleibt unabhängig.'],
  el: ['Οι εξειδικευμένες εξωτερικές πηγές δεν είναι διαθέσιμες', 'Δεν έχει ρυθμιστεί εξειδικευμένος σύνδεσμος. Η δημόσια αναζήτηση στον Ιστό παραμένει ανεξάρτητη.'],
  es: ['Fuentes externas especializadas no disponibles', 'No hay ningún conector especializado configurado. La búsqueda web pública funciona de forma independiente.'],
  fi: ['Erikoistuneet ulkoiset lähteet eivät ole käytettävissä', 'Erikoistunutta liitintä ei ole määritetty. Julkinen verkkohaku toimii itsenäisesti.'],
  ha: ['Babu ƙwararrun majiyoyin waje', 'Ba a saita mahaɗin ƙwararru ba. Binciken yanar gizo na jama’a yana ci gaba da kansa.'],
  he: ['מקורות חיצוניים מתמחים אינם זמינים', 'לא הוגדר מחבר מתמחה. החיפוש ברשת הציבורית נשאר עצמאי.'],
  hi: ['विशेष बाहरी स्रोत उपलब्ध नहीं हैं', 'कोई विशेष कनेक्टर कॉन्फ़िगर नहीं है। सार्वजनिक वेब खोज स्वतंत्र रूप से उपलब्ध है।'],
  hu: ['A speciális külső források nem érhetők el', 'Nincs speciális összekötő beállítva. A nyilvános webes keresés ettől függetlenül működik.'],
  id: ['Sumber eksternal khusus tidak tersedia', 'Belum ada konektor khusus yang dikonfigurasi. Pencarian Web publik tetap berjalan secara terpisah.'],
  it: ['Fonti esterne specializzate non disponibili', 'Non è configurato alcun connettore specializzato. La ricerca Web pubblica resta indipendente.'],
  ja: ['専門外部ソースは利用できません', '専門コネクターが設定されていません。公開 Web 検索は独立して利用できます。'],
  ko: ['전문 외부 소스를 사용할 수 없습니다', '전문 커넥터가 구성되지 않았습니다. 공개 웹 검색은 별도로 작동합니다.'],
  ln: ['Maziba ya libándá ya sipesiale ezali te', 'Connecteur moko te ya sipesiale ebongisami. Boluki na Web ya bato nyonso ezali kosala na ndenge na yango.'],
  nb: ['Spesialiserte eksterne kilder er ikke tilgjengelige', 'Ingen spesialisert kobling er konfigurert. Offentlig nettsøk fungerer uavhengig.'],
  nl: ['Gespecialiseerde externe bronnen niet beschikbaar', 'Er is geen gespecialiseerde connector ingesteld. Openbaar zoeken op het web blijft onafhankelijk.'],
  pl: ['Specjalistyczne źródła zewnętrzne są niedostępne', 'Nie skonfigurowano specjalistycznego łącznika. Publiczne wyszukiwanie w sieci działa niezależnie.'],
  pt: ['Fontes externas especializadas indisponíveis', 'Não está configurado nenhum conector especializado. A pesquisa Web pública permanece independente.'],
  ro: ['Sursele externe specializate nu sunt disponibile', 'Nu este configurat niciun conector specializat. Căutarea pe Web-ul public rămâne independentă.'],
  ru: ['Специализированные внешние источники недоступны', 'Специализированный коннектор не настроен. Поиск в открытом интернете работает независимо.'],
  sv: ['Specialiserade externa källor är inte tillgängliga', 'Ingen specialiserad anslutning är konfigurerad. Offentlig webbsökning fungerar oberoende.'],
  sw: ['Vyanzo maalumu vya nje havipatikani', 'Hakuna kiunganishi maalumu kilichosanidiwa. Utafutaji wa Wavuti ya umma unaendelea kwa kujitegemea.'],
  th: ['ยังไม่มีแหล่งข้อมูลภายนอกเฉพาะทาง', 'ยังไม่ได้กำหนดค่าตัวเชื่อมต่อเฉพาะทาง การค้นหาเว็บสาธารณะยังทำงานแยกกัน'],
  tr: ['Uzmanlaşmış dış kaynaklar kullanılamıyor', 'Uzmanlaşmış bir bağlayıcı yapılandırılmadı. Genel Web araması bağımsız olarak çalışır.'],
  uk: ['Спеціалізовані зовнішні джерела недоступні', 'Спеціалізований конектор не налаштовано. Пошук у відкритому інтернеті працює незалежно.'],
  vi: ['Nguồn bên ngoài chuyên biệt chưa khả dụng', 'Chưa cấu hình trình kết nối chuyên biệt. Tìm kiếm Web công khai vẫn hoạt động độc lập.'],
  wo: ['Gëstu yu biti yu xereñ yi jëfandikuwul', 'Amul benn jokkoo bu xereñ bu ñu samp. Ceetug Web bi ñépp mën a gis dafay dox boppam.'],
  zh: ['专业外部来源不可用', '尚未配置专业连接器。公开网络搜索仍可独立使用。'],
  'zh-Hant': ['專業外部來源無法使用', '尚未設定專業連接器。公開網路搜尋仍可獨立使用。'],
};

for (const [code, values] of Object.entries(researchWebV1)) {
  extendLocale(code, {
    'research10.externalUnavailable': values[0],
    'research10.externalUnavailableDetail': values[1],
  });
}
