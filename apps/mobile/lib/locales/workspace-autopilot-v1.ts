import { extendLocale, extendLocaleAliases } from '../i18n';

/** Autopilot-specific copy; shared controls reuse their reviewed local wording. */
export const workspaceAutopilotKeys = [
  'workspaceAutopilot.title', 'workspaceAutopilot.consent', 'workspaceAutopilot.start',
  'workspaceAutopilot.preparing', 'workspaceAutopilot.understood', 'workspaceAutopilot.methodReady',
  'workspaceAutopilot.working', 'workspaceAutopilot.think', 'workspaceAutopilot.method',
  'workspaceAutopilot.draft', 'workspaceAutopilot.check', 'workspaceAutopilot.finish',
  'workspaceAutopilot.done', 'workspaceAutopilot.paused', 'workspaceAutopilot.pausedError',
  'workspaceAutopilot.reviewRequired', 'workspaceAutopilot.needsInput', 'workspaceAutopilot.stopped',
  'workspaceAutopilot.question', 'workspaceAutopilot.orientation', 'workspaceAutopilot.undo',
  'workspaceAutopilot.options', 'workspaceAutopilot.hideOptions', 'workspaceAutopilot.manual',
  'workspaceAutopilot.instruction', 'workspaceAutopilot.response', 'workspaceAutopilot.pending',
  'workspaceAutopilot.continueEditing',
] as const;

export const workspaceAutopilotAliases = {
  'workspaceAutopilot.verifying': 'workspaceProfessor.phase.VERIFICATION',
  'workspaceAutopilot.finalizing': 'workspaceProfessor.phase.FINALIZATION',
  'workspaceAutopilot.pause': 'voice11.pause',
  'workspaceAutopilot.resume': 'voice11.resume',
  'workspaceAutopilot.stop': 'learn.oral.stop',
  'workspaceAutopilot.addSource': 'workspace10.addSource',
};

export const workspaceAutopilotTranslations: Record<string, readonly string[]> = {
  es: [
    `Profesor automático`, `El Profesor puede preparar y mejorar automáticamente el borrador de este espacio de trabajo. Cada cambio se guarda y se puede deshacer.`, `Dejar que el Profesor prepare mi trabajo`,
    `El Profesor está preparando tu trabajo…`, `Trabajo comprendido`, `Método preparado`, `Trabajo en curso`, `Estoy comprendiendo las instrucciones.`, `Estoy preparando el método.`, `Estoy trabajando en el borrador.`, `Estoy verificando el resultado.`, `Estoy preparando el resultado final.`,
    `Tu trabajo está listo.`, `El Profesor está en pausa. Tu trabajo está guardado.`, `El Profesor se ha detenido temporalmente. Tu trabajo está guardado.`, `El trabajo automático ha alcanzado su límite de seguridad. Revisa el borrador antes de continuar.`, `El Profesor necesita una aclaración antes de continuar.`, `El trabajo automático se ha detenido. Tu borrador está guardado.`,
    `Hacer una pregunta`, `Cambiar la orientación`, `Deshacer el último cambio`, `Más opciones`, `Cerrar opciones`, `Modo manual guiado`, `Instrucciones / tema`, `Trabajo / respuesta`, `Terminando el paso actual…`, `Seguir editando`,
  ],
  de: [
    `Automatischer Professor`, `Der Professor darf den Entwurf dieses Arbeitsbereichs automatisch vorbereiten und verbessern. Jede Änderung wird gespeichert und kann rückgängig gemacht werden.`, `Den Professor meine Arbeit vorbereiten lassen`,
    `Der Professor bereitet deine Arbeit vor…`, `Aufgabe verstanden`, `Methode vorbereitet`, `Arbeit in Bearbeitung`, `Ich erfasse die Aufgabenstellung.`, `Ich bereite die Methode vor.`, `Ich arbeite am Entwurf.`, `Ich überprüfe das Ergebnis.`, `Ich bereite das Endergebnis vor.`,
    `Deine Arbeit ist fertig.`, `Der Professor pausiert. Deine Arbeit ist gespeichert.`, `Der Professor hat vorübergehend angehalten. Deine Arbeit ist gespeichert.`, `Die automatische Bearbeitung hat ihre Sicherheitsgrenze erreicht. Prüfe den Entwurf, bevor du fortfährst.`, `Der Professor benötigt eine Klarstellung, bevor es weitergeht.`, `Die automatische Bearbeitung wurde gestoppt. Dein Entwurf ist gespeichert.`,
    `Eine Frage stellen`, `Ausrichtung ändern`, `Letzte Änderung rückgängig machen`, `Weitere Optionen`, `Optionen schließen`, `Angeleiteter manueller Modus`, `Aufgabenstellung / Thema`, `Arbeit / Antwort`, `Der aktuelle Schritt wird abgeschlossen…`, `Weiterbearbeiten`,
  ],
  it: [
    `Professore automatico`, `Il Professore può preparare e migliorare automaticamente la bozza di questo spazio di lavoro. Ogni modifica viene salvata ed è reversibile.`, `Lascia che il Professore prepari il mio lavoro`,
    `Il Professore sta preparando il tuo lavoro…`, `Compito compreso`, `Metodo preparato`, `Lavoro in corso`, `Sto comprendendo le istruzioni.`, `Sto preparando il metodo.`, `Sto lavorando alla bozza.`, `Sto verificando il risultato.`, `Sto preparando il risultato finale.`,
    `Il tuo lavoro è pronto.`, `Il Professore è in pausa. Il tuo lavoro è salvato.`, `Il Professore si è fermato temporaneamente. Il tuo lavoro è salvato.`, `Il lavoro automatico ha raggiunto il limite di sicurezza. Controlla la bozza prima di continuare.`, `Il Professore ha bisogno di un chiarimento prima di continuare.`, `Il lavoro automatico è stato interrotto. La tua bozza è salvata.`,
    `Fai una domanda`, `Cambia direzione`, `Annulla l’ultima modifica`, `Altre opzioni`, `Chiudi opzioni`, `Modalità manuale guidata`, `Istruzioni / argomento`, `Lavoro / risposta`, `Completamento del passaggio attuale…`, `Continua a modificare`,
  ],
  pt: [
    `Professor automático`, `O Professor pode preparar e melhorar automaticamente o rascunho deste espaço de trabalho. Cada alteração fica guardada e pode ser anulada.`, `Deixar o Professor preparar o meu trabalho`,
    `O Professor está a preparar o teu trabalho…`, `Trabalho compreendido`, `Método preparado`, `Trabalho em curso`, `Estou a compreender as instruções.`, `Estou a preparar o método.`, `Estou a trabalhar no rascunho.`, `Estou a verificar o resultado.`, `Estou a preparar o resultado final.`,
    `O teu trabalho está pronto.`, `O Professor está em pausa. O teu trabalho está guardado.`, `O Professor parou temporariamente. O teu trabalho está guardado.`, `O trabalho automático atingiu o limite de segurança. Revê o rascunho antes de continuar.`, `O Professor precisa de um esclarecimento antes de continuar.`, `O trabalho automático foi interrompido. O teu rascunho está guardado.`,
    `Fazer uma pergunta`, `Alterar a orientação`, `Anular a última alteração`, `Mais opções`, `Fechar opções`, `Modo manual guiado`, `Instruções / tema`, `Trabalho / resposta`, `A terminar a etapa atual…`, `Continuar a editar`,
  ],
  hi: [
    `स्वचालित प्राध्यापक`, `प्राध्यापक इस कार्यक्षेत्र का मसौदा अपने आप तैयार और बेहतर कर सकते हैं। हर बदलाव सहेजा जाता है और वापस लिया जा सकता है।`, `प्राध्यापक को मेरा काम तैयार करने दें`,
    `प्राध्यापक तुम्हारा काम तैयार कर रहे हैं…`, `काम समझ लिया गया`, `विधि तैयार है`, `काम जारी है`, `मैं निर्देश समझ रहा हूँ।`, `मैं विधि तैयार कर रहा हूँ।`, `मैं मसौदे पर काम कर रहा हूँ।`, `मैं परिणाम की जाँच कर रहा हूँ।`, `मैं अंतिम परिणाम तैयार कर रहा हूँ।`,
    `तुम्हारा काम तैयार है।`, `प्राध्यापक रुके हुए हैं। तुम्हारा काम सहेजा गया है।`, `प्राध्यापक कुछ समय के लिए रुक गए हैं। तुम्हारा काम सहेजा गया है।`, `स्वचालित काम की सुरक्षा सीमा पहुँच गई है। आगे बढ़ने से पहले मसौदा जाँचो।`, `आगे बढ़ने से पहले प्राध्यापक को एक स्पष्टीकरण चाहिए।`, `स्वचालित काम रोक दिया गया है। तुम्हारा मसौदा सहेजा गया है।`,
    `प्रश्न पूछो`, `दिशा बदलो`, `अंतिम बदलाव वापस लो`, `और विकल्प`, `विकल्प बंद करो`, `मार्गदर्शित मैनुअल मोड`, `निर्देश / विषय`, `काम / उत्तर`, `मौजूदा चरण पूरा हो रहा है…`, `संपादन जारी रखो`,
  ],
  tr: [
    `Otomatik Öğretmen`, `Öğretmen bu çalışma alanındaki taslağı otomatik olarak hazırlayıp geliştirebilir. Her değişiklik kaydedilir ve geri alınabilir.`, `Öğretmenin çalışmamı hazırlamasına izin ver`,
    `Öğretmen çalışmanı hazırlıyor…`, `Görev anlaşıldı`, `Yöntem hazırlandı`, `Çalışma sürüyor`, `Yönergeleri anlamaya çalışıyorum.`, `Yöntemi hazırlıyorum.`, `Taslak üzerinde çalışıyorum.`, `Sonucu doğruluyorum.`, `Nihai sonucu hazırlıyorum.`,
    `Çalışman hazır.`, `Öğretmen duraklatıldı. Çalışman kaydedildi.`, `Öğretmen geçici olarak durdu. Çalışman kaydedildi.`, `Otomatik çalışma güvenlik sınırına ulaştı. Devam etmeden önce taslağı gözden geçir.`, `Öğretmenin devam etmeden önce bir açıklamaya ihtiyacı var.`, `Otomatik çalışma durduruldu. Taslağın kaydedildi.`,
    `Soru sor`, `Yönü değiştir`, `Son değişikliği geri al`, `Diğer seçenekler`, `Seçenekleri kapat`, `Rehberli elle çalışma modu`, `Yönerge / konu`, `Çalışma / yanıt`, `Geçerli adım tamamlanıyor…`, `Düzenlemeye devam et`,
  ],
  pl: [
    `Automatyczny Profesor`, `Profesor może automatycznie przygotowywać i ulepszać szkic w tym obszarze pracy. Każda zmiana jest zapisywana i można ją cofnąć.`, `Pozwól Profesorowi przygotować moją pracę`,
    `Profesor przygotowuje twoją pracę…`, `Zadanie zrozumiane`, `Metoda przygotowana`, `Praca w toku`, `Analizuję polecenie.`, `Przygotowuję metodę.`, `Pracuję nad szkicem.`, `Sprawdzam wynik.`, `Przygotowuję wynik końcowy.`,
    `Twoja praca jest gotowa.`, `Profesor jest wstrzymany. Twoja praca jest zapisana.`, `Profesor zatrzymał się tymczasowo. Twoja praca jest zapisana.`, `Praca automatyczna osiągnęła limit bezpieczeństwa. Sprawdź szkic przed kontynuowaniem.`, `Profesor potrzebuje wyjaśnienia przed kontynuowaniem.`, `Praca automatyczna została zatrzymana. Twój szkic jest zapisany.`,
    `Zadaj pytanie`, `Zmień kierunek`, `Cofnij ostatnią zmianę`, `Więcej opcji`, `Zamknij opcje`, `Ręczny tryb z prowadzeniem`, `Polecenie / temat`, `Praca / odpowiedź`, `Kończenie bieżącego kroku…`, `Kontynuuj edycję`,
  ],
  ru: [
    `Автоматический преподаватель`, `Преподаватель может автоматически готовить и улучшать черновик в этом рабочем пространстве. Каждое изменение сохраняется и может быть отменено.`, `Разрешить преподавателю подготовить мою работу`,
    `Преподаватель готовит твою работу…`, `Задание понято`, `Метод подготовлен`, `Работа выполняется`, `Я разбираюсь в условии.`, `Я подготавливаю метод.`, `Я работаю над черновиком.`, `Я проверяю результат.`, `Я подготавливаю итоговый результат.`,
    `Твоя работа готова.`, `Преподаватель на паузе. Твоя работа сохранена.`, `Преподаватель временно остановился. Твоя работа сохранена.`, `Автоматическая работа достигла предела безопасности. Проверь черновик перед продолжением.`, `Преподавателю нужно уточнение, прежде чем продолжить.`, `Автоматическая работа остановлена. Твой черновик сохранён.`,
    `Задать вопрос`, `Изменить направление`, `Отменить последнее изменение`, `Другие действия`, `Закрыть действия`, `Ручной режим с подсказками`, `Условие / тема`, `Работа / ответ`, `Завершение текущего шага…`, `Продолжить редактирование`,
  ],
  zh: [
    `教授自动模式`, `教授可以自动准备和改进此工作区的草稿。每次修改都会保存，并可撤销。`, `让教授准备我的作业`,
    `教授正在准备你的作业…`, `已理解任务`, `已准备方法`, `正在处理作业`, `我正在理解题目要求。`, `我正在准备方法。`, `我正在编写草稿。`, `我正在核验结果。`, `我正在准备最终结果。`,
    `你的作业已准备好。`, `教授已暂停。你的作业已保存。`, `教授暂时停止了。你的作业已保存。`, `自动处理已达到安全上限。请先检查草稿，再继续。`, `教授需要进一步说明才能继续。`, `自动处理已停止。你的草稿已保存。`,
    `提问`, `调整方向`, `撤销上次修改`, `更多选项`, `关闭选项`, `手动引导模式`, `题目 / 要求`, `作业 / 答案`, `正在完成当前步骤…`, `继续编辑`,
  ],
  vi: [
    `Giáo sư tự động`, `Giáo sư có thể tự động chuẩn bị và cải thiện bản nháp trong không gian làm việc này. Mọi thay đổi đều được lưu và có thể hoàn tác.`, `Để Giáo sư chuẩn bị bài làm của tôi`,
    `Giáo sư đang chuẩn bị bài làm của bạn…`, `Đã hiểu đề bài`, `Đã chuẩn bị phương pháp`, `Đang làm bài`, `Tôi đang tìm hiểu yêu cầu.`, `Tôi đang chuẩn bị phương pháp.`, `Tôi đang làm bản nháp.`, `Tôi đang kiểm tra kết quả.`, `Tôi đang chuẩn bị kết quả cuối cùng.`,
    `Bài làm của bạn đã sẵn sàng.`, `Giáo sư đang tạm dừng. Bài làm của bạn đã được lưu.`, `Giáo sư đã tạm ngừng. Bài làm của bạn đã được lưu.`, `Chế độ tự động đã đạt giới hạn an toàn. Hãy kiểm tra bản nháp trước khi tiếp tục.`, `Giáo sư cần làm rõ một thông tin trước khi tiếp tục.`, `Chế độ tự động đã dừng. Bản nháp của bạn đã được lưu.`,
    `Đặt câu hỏi`, `Đổi hướng`, `Hoàn tác thay đổi cuối`, `Tùy chọn khác`, `Đóng tùy chọn`, `Chế độ thủ công có hướng dẫn`, `Đề bài / yêu cầu`, `Bài làm / câu trả lời`, `Đang hoàn tất bước hiện tại…`, `Tiếp tục chỉnh sửa`,
  ],
  ja: [
    `教授の自動進行`, `教授がこのワークスペースの下書きを自動で作成・改善できます。変更はすべて保存され、元に戻せます。`, `教授に作業の準備を任せる`,
    `教授が作業を準備しています…`, `課題を理解しました`, `方法を準備しました`, `作業中`, `課題の指示を確認しています。`, `方法を準備しています。`, `下書きを作成しています。`, `結果を検証しています。`, `最終結果を準備しています。`,
    `作業の成果ができました。`, `教授は一時停止中です。作業は保存されています。`, `教授は一時的に停止しました。作業は保存されています。`, `自動処理が安全上の上限に達しました。下書きを確認してから続けてください。`, `教授が続けるには確認が必要です。`, `自動処理は停止しています。下書きは保存されています。`,
    `質問する`, `方針を変更`, `直前の変更を元に戻す`, `その他の操作`, `操作を閉じる`, `手動ガイドモード`, `課題 / 指示`, `作業 / 回答`, `現在の手順を完了しています…`, `編集を続ける`,
  ],
  sv: [
    `Automatisk professor`, `Professorn får förbereda och förbättra utkastet i den här arbetsytan automatiskt. Varje ändring sparas och kan ångras.`, `Låt Professorn förbereda mitt arbete`,
    `Professorn förbereder ditt arbete…`, `Uppgiften förstådd`, `Metoden förberedd`, `Arbete pågår`, `Jag sätter mig in i instruktionerna.`, `Jag förbereder metoden.`, `Jag arbetar med utkastet.`, `Jag kontrollerar resultatet.`, `Jag förbereder slutresultatet.`,
    `Ditt arbete är klart.`, `Professorn är pausad. Ditt arbete är sparat.`, `Professorn har stannat tillfälligt. Ditt arbete är sparat.`, `Det automatiska arbetet har nått sin säkerhetsgräns. Granska utkastet innan du fortsätter.`, `Professorn behöver ett förtydligande innan arbetet kan fortsätta.`, `Det automatiska arbetet har stoppats. Ditt utkast är sparat.`,
    `Ställ en fråga`, `Ändra inriktning`, `Ångra senaste ändringen`, `Fler alternativ`, `Stäng alternativen`, `Väglett manuellt läge`, `Instruktioner / ämne`, `Arbete / svar`, `Avslutar det aktuella steget…`, `Fortsätt redigera`,
  ],
  th: [
    `อาจารย์โหมดอัตโนมัติ`, `อาจารย์สามารถเตรียมและปรับปรุงร่างในพื้นที่ทำงานนี้โดยอัตโนมัติ ทุกการเปลี่ยนแปลงจะถูกบันทึกและย้อนกลับได้`, `ให้อาจารย์เตรียมงานของฉัน`,
    `อาจารย์กำลังเตรียมงานของคุณ…`, `เข้าใจโจทย์แล้ว`, `เตรียมวิธีการแล้ว`, `กำลังทำงาน`, `ฉันกำลังทำความเข้าใจคำสั่ง`, `ฉันกำลังเตรียมวิธีการ`, `ฉันกำลังทำร่างงาน`, `ฉันกำลังตรวจสอบผลลัพธ์`, `ฉันกำลังเตรียมผลลัพธ์สุดท้าย`,
    `งานของคุณพร้อมแล้ว`, `อาจารย์พักอยู่ งานของคุณบันทึกแล้ว`, `อาจารย์หยุดชั่วคราว งานของคุณบันทึกแล้ว`, `งานอัตโนมัติถึงขีดจำกัดความปลอดภัยแล้ว ตรวจร่างก่อนดำเนินการต่อ`, `อาจารย์ต้องการข้อมูลเพิ่มเติมก่อนดำเนินการต่อ`, `หยุดงานอัตโนมัติแล้ว ร่างของคุณบันทึกแล้ว`,
    `ถามคำถาม`, `เปลี่ยนแนวทาง`, `เลิกทำการเปลี่ยนแปลงล่าสุด`, `ตัวเลือกเพิ่มเติม`, `ปิดตัวเลือก`, `โหมดทำเองพร้อมคำแนะนำ`, `คำสั่ง / หัวข้อ`, `งาน / คำตอบ`, `กำลังจบขั้นตอนปัจจุบัน…`, `แก้ไขต่อ`,
  ],
  ar: [
    `الأستاذ الآلي`, `يمكن للأستاذ إعداد مسودة مساحة العمل هذه وتحسينها تلقائيًا. يُحفظ كل تغيير ويمكن التراجع عنه.`, `دع الأستاذ يُعد عملي`,
    `الأستاذ يُعد عملك…`, `تم فهم المهمة`, `تم إعداد المنهجية`, `العمل جارٍ`, `أفهم المطلوب الآن.`, `أُعد المنهجية.`, `أعمل على المسودة.`, `أتحقق من النتيجة.`, `أُعد النتيجة النهائية.`,
    `عملك جاهز.`, `الأستاذ متوقف مؤقتًا. عملك محفوظ.`, `توقف الأستاذ مؤقتًا بسبب عطل. عملك محفوظ.`, `بلغ العمل التلقائي حد الأمان. راجع المسودة قبل المتابعة.`, `يحتاج الأستاذ إلى توضيح قبل المتابعة.`, `تم إيقاف العمل التلقائي. مسودتك محفوظة.`,
    `اطرح سؤالًا`, `غيّر الاتجاه`, `تراجع عن آخر تغيير`, `خيارات إضافية`, `أغلق الخيارات`, `الوضع اليدوي الموجّه`, `التعليمات / الموضوع`, `العمل / الإجابة`, `جارٍ إنهاء الخطوة الحالية…`, `متابعة التحرير`,
  ],
  ko: [
    `교수 자동 진행`, `교수가 이 작업 공간의 초안을 자동으로 준비하고 개선할 수 있습니다. 모든 변경 사항은 저장되며 되돌릴 수 있습니다.`, `교수에게 내 작업 준비 맡기기`,
    `교수가 작업을 준비하고 있습니다…`, `과제 이해 완료`, `방법 준비 완료`, `작업 진행 중`, `요구 사항을 이해하고 있습니다.`, `방법을 준비하고 있습니다.`, `초안을 작성하고 있습니다.`, `결과를 검증하고 있습니다.`, `최종 결과를 준비하고 있습니다.`,
    `작업 결과가 준비되었습니다.`, `교수가 일시 정지되었습니다. 작업은 저장되었습니다.`, `교수가 일시적으로 멈췄습니다. 작업은 저장되었습니다.`, `자동 작업이 안전 한도에 도달했습니다. 계속하기 전에 초안을 검토하세요.`, `교수가 계속하려면 추가 설명이 필요합니다.`, `자동 작업이 중지되었습니다. 초안은 저장되었습니다.`,
    `질문하기`, `방향 변경`, `마지막 변경 취소`, `추가 옵션`, `옵션 닫기`, `수동 안내 모드`, `지시 / 주제`, `작업 / 답변`, `현재 단계 마무리 중…`, `계속 편집`,
  ],
  nl: [
    `Automatische Professor`, `De Professor mag het concept in deze werkruimte automatisch voorbereiden en verbeteren. Elke wijziging wordt opgeslagen en kan worden teruggedraaid.`, `Laat de Professor mijn werk voorbereiden`,
    `De Professor bereidt je werk voor…`, `Opdracht begrepen`, `Methode voorbereid`, `Werk in uitvoering`, `Ik bekijk wat er gevraagd wordt.`, `Ik bereid de methode voor.`, `Ik werk aan het concept.`, `Ik controleer het resultaat.`, `Ik bereid het eindresultaat voor.`,
    `Je werk is klaar.`, `De Professor is gepauzeerd. Je werk is opgeslagen.`, `De Professor is tijdelijk gestopt. Je werk is opgeslagen.`, `Het automatische werk heeft de veiligheidsgrens bereikt. Controleer het concept voordat je verdergaat.`, `De Professor heeft een verduidelijking nodig voordat het werk verder kan.`, `Het automatische werk is gestopt. Je concept is opgeslagen.`,
    `Een vraag stellen`, `Richting wijzigen`, `Laatste wijziging ongedaan maken`, `Meer opties`, `Opties sluiten`, `Begeleide handmatige modus`, `Opdracht / onderwerp`, `Werk / antwoord`, `De huidige stap wordt afgerond…`, `Verder bewerken`,
  ],
  el: [
    `Αυτόματος Καθηγητής`, `Ο Καθηγητής μπορεί να ετοιμάζει και να βελτιώνει αυτόματα το προσχέδιο αυτού του χώρου εργασίας. Κάθε αλλαγή αποθηκεύεται και μπορεί να αναιρεθεί.`, `Να ετοιμάσει ο Καθηγητής την εργασία μου`,
    `Ο Καθηγητής ετοιμάζει την εργασία σου…`, `Η εργασία κατανοήθηκε`, `Η μέθοδος ετοιμάστηκε`, `Η εργασία εκτελείται`, `Κατανοώ τις οδηγίες.`, `Ετοιμάζω τη μέθοδο.`, `Εργάζομαι στο προσχέδιο.`, `Ελέγχω το αποτέλεσμα.`, `Ετοιμάζω το τελικό αποτέλεσμα.`,
    `Η εργασία σου είναι έτοιμη.`, `Ο Καθηγητής βρίσκεται σε παύση. Η εργασία σου αποθηκεύτηκε.`, `Ο Καθηγητής σταμάτησε προσωρινά. Η εργασία σου αποθηκεύτηκε.`, `Η αυτόματη εργασία έφτασε το όριο ασφαλείας. Έλεγξε το προσχέδιο πριν συνεχίσεις.`, `Ο Καθηγητής χρειάζεται μια διευκρίνιση πριν συνεχίσει.`, `Η αυτόματη εργασία σταμάτησε. Το προσχέδιό σου αποθηκεύτηκε.`,
    `Κάνε μια ερώτηση`, `Άλλαξε κατεύθυνση`, `Αναίρεσε την τελευταία αλλαγή`, `Περισσότερες επιλογές`, `Κλείσιμο επιλογών`, `Χειροκίνητη καθοδηγούμενη λειτουργία`, `Οδηγίες / θέμα`, `Εργασία / απάντηση`, `Ολοκλήρωση του τρέχοντος βήματος…`, `Συνέχισε την επεξεργασία`,
  ],
  cs: [
    `Automatický Profesor`, `Profesor může automaticky připravovat a vylepšovat koncept v tomto pracovním prostoru. Každá změna se ukládá a lze ji vrátit.`, `Nechat Profesora připravit mou práci`,
    `Profesor připravuje tvou práci…`, `Zadání pochopeno`, `Metoda připravena`, `Práce probíhá`, `Rozebírám zadání.`, `Připravuji metodu.`, `Pracuji na konceptu.`, `Ověřuji výsledek.`, `Připravuji konečný výsledek.`,
    `Tvá práce je připravena.`, `Profesor je pozastaven. Tvá práce je uložena.`, `Profesor se dočasně zastavil. Tvá práce je uložena.`, `Automatická práce dosáhla bezpečnostního limitu. Před pokračováním zkontroluj koncept.`, `Profesor potřebuje před pokračováním upřesnění.`, `Automatická práce byla zastavena. Tvůj koncept je uložen.`,
    `Položit otázku`, `Změnit směr`, `Vrátit poslední změnu`, `Další možnosti`, `Zavřít možnosti`, `Ruční režim s vedením`, `Zadání / téma`, `Práce / odpověď`, `Dokončuji aktuální krok…`, `Pokračovat v úpravách`,
  ],
  ro: [
    `Profesor automat`, `Profesorul poate pregăti și îmbunătăți automat ciorna din acest spațiu de lucru. Fiecare modificare este salvată și poate fi anulată.`, `Lasă Profesorul să îmi pregătească lucrarea`,
    `Profesorul îți pregătește lucrarea…`, `Cerința a fost înțeleasă`, `Metoda este pregătită`, `Lucrare în curs`, `Înțeleg cerințele.`, `Pregătesc metoda.`, `Lucrez la ciornă.`, `Verific rezultatul.`, `Pregătesc rezultatul final.`,
    `Lucrarea ta este gata.`, `Profesorul este în pauză. Lucrarea ta este salvată.`, `Profesorul s-a oprit temporar. Lucrarea ta este salvată.`, `Lucrul automat a atins limita de siguranță. Verifică ciorna înainte de a continua.`, `Profesorul are nevoie de o clarificare înainte de a continua.`, `Lucrul automat este oprit. Ciorna ta este salvată.`,
    `Pune o întrebare`, `Schimbă direcția`, `Anulează ultima modificare`, `Mai multe opțiuni`, `Închide opțiunile`, `Mod manual ghidat`, `Cerințe / subiect`, `Lucrare / răspuns`, `Se încheie pasul curent…`, `Continuă editarea`,
  ],
  hu: [
    `Automatikus Tanár`, `A Tanár automatikusan elkészítheti és javíthatja ennek a munkaterületnek a vázlatát. Minden módosítás mentésre kerül és visszavonható.`, `Készítse elő a Tanár a munkámat`,
    `A Tanár előkészíti a munkádat…`, `Feladat megértve`, `Módszer előkészítve`, `Munka folyamatban`, `Értelmezem az utasításokat.`, `Előkészítem a módszert.`, `A vázlaton dolgozom.`, `Ellenőrzöm az eredményt.`, `Előkészítem a végeredményt.`,
    `A munkád elkészült.`, `A Tanár szünetel. A munkád el van mentve.`, `A Tanár átmenetileg leállt. A munkád el van mentve.`, `Az automatikus munka elérte a biztonsági korlátot. Folytatás előtt ellenőrizd a vázlatot.`, `A Tanárnak pontosításra van szüksége a folytatáshoz.`, `Az automatikus munka leállt. A vázlatod el van mentve.`,
    `Kérdés feltevése`, `Irány módosítása`, `Utolsó módosítás visszavonása`, `További lehetőségek`, `Lehetőségek bezárása`, `Irányított kézi mód`, `Utasítások / téma`, `Munka / válasz`, `Az aktuális lépés befejezése…`, `Szerkesztés folytatása`,
  ],
  da: [
    `Automatisk Professor`, `Professoren må automatisk forberede og forbedre kladden i dette arbejdsområde. Hver ændring gemmes og kan fortrydes.`, `Lad Professoren forberede mit arbejde`,
    `Professoren forbereder dit arbejde…`, `Opgaven forstået`, `Metoden forberedt`, `Arbejdet er i gang`, `Jeg sætter mig ind i instruktionerne.`, `Jeg forbereder metoden.`, `Jeg arbejder på kladden.`, `Jeg kontrollerer resultatet.`, `Jeg forbereder det endelige resultat.`,
    `Dit arbejde er klar.`, `Professoren er sat på pause. Dit arbejde er gemt.`, `Professoren er stoppet midlertidigt. Dit arbejde er gemt.`, `Det automatiske arbejde har nået sikkerhedsgrænsen. Gennemgå kladden, før du fortsætter.`, `Professoren har brug for en afklaring, før arbejdet kan fortsætte.`, `Det automatiske arbejde er stoppet. Din kladde er gemt.`,
    `Stil et spørgsmål`, `Skift retning`, `Fortryd sidste ændring`, `Flere muligheder`, `Luk muligheder`, `Vejledt manuel tilstand`, `Instruktioner / emne`, `Arbejde / svar`, `Afslutter det aktuelle trin…`, `Fortsæt redigering`,
  ],
  fi: [
    `Automaattinen Opettaja`, `Opettaja saa valmistella ja parantaa tämän työtilan luonnosta automaattisesti. Jokainen muutos tallennetaan ja voidaan kumota.`, `Anna Opettajan valmistella työni`,
    `Opettaja valmistelee työtäsi…`, `Tehtävä ymmärretty`, `Menetelmä valmisteltu`, `Työ käynnissä`, `Perehdyn tehtävänantoon.`, `Valmistelen menetelmää.`, `Työstän luonnosta.`, `Tarkistan tuloksen.`, `Valmistelen lopputulosta.`,
    `Työsi on valmis.`, `Opettaja on tauolla. Työsi on tallennettu.`, `Opettaja pysähtyi tilapäisesti. Työsi on tallennettu.`, `Automaattinen työ saavutti turvarajan. Tarkista luonnos ennen jatkamista.`, `Opettaja tarvitsee tarkennuksen ennen jatkamista.`, `Automaattinen työ on pysäytetty. Luonnoksesi on tallennettu.`,
    `Esitä kysymys`, `Muuta suuntaa`, `Kumoa viimeisin muutos`, `Lisäasetukset`, `Sulje asetukset`, `Ohjattu manuaalinen tila`, `Tehtävänanto / aihe`, `Työ / vastaus`, `Nykyinen vaihe viimeistellään…`, `Jatka muokkaamista`,
  ],
  id: [
    `Profesor otomatis`, `Profesor dapat menyiapkan dan memperbaiki draf ruang kerja ini secara otomatis. Setiap perubahan disimpan dan dapat dibatalkan.`, `Izinkan Profesor menyiapkan pekerjaan saya`,
    `Profesor sedang menyiapkan pekerjaanmu…`, `Tugas dipahami`, `Metode disiapkan`, `Pekerjaan berlangsung`, `Saya sedang memahami instruksi.`, `Saya sedang menyiapkan metode.`, `Saya sedang mengerjakan draf.`, `Saya sedang memeriksa hasil.`, `Saya sedang menyiapkan hasil akhir.`,
    `Pekerjaanmu sudah siap.`, `Profesor dijeda. Pekerjaanmu tersimpan.`, `Profesor berhenti sementara. Pekerjaanmu tersimpan.`, `Pekerjaan otomatis mencapai batas keamanan. Tinjau draf sebelum melanjutkan.`, `Profesor memerlukan penjelasan tambahan sebelum melanjutkan.`, `Pekerjaan otomatis dihentikan. Drafmu tersimpan.`,
    `Ajukan pertanyaan`, `Ubah arah`, `Batalkan perubahan terakhir`, `Pilihan lainnya`, `Tutup pilihan`, `Mode manual terpandu`, `Instruksi / topik`, `Pekerjaan / jawaban`, `Menyelesaikan langkah saat ini…`, `Lanjutkan penyuntingan`,
  ],
  nb: [
    `Automatisk Professor`, `Professoren kan forberede og forbedre utkastet i dette arbeidsområdet automatisk. Hver endring lagres og kan angres.`, `La Professoren forberede arbeidet mitt`,
    `Professoren forbereder arbeidet ditt…`, `Oppgaven forstått`, `Metoden forberedt`, `Arbeid pågår`, `Jeg setter meg inn i instruksjonene.`, `Jeg forbereder metoden.`, `Jeg arbeider med utkastet.`, `Jeg kontrollerer resultatet.`, `Jeg forbereder sluttresultatet.`,
    `Arbeidet ditt er klart.`, `Professoren er satt på pause. Arbeidet ditt er lagret.`, `Professoren har stoppet midlertidig. Arbeidet ditt er lagret.`, `Det automatiske arbeidet har nådd sikkerhetsgrensen. Se gjennom utkastet før du fortsetter.`, `Professoren trenger en avklaring før arbeidet kan fortsette.`, `Det automatiske arbeidet er stoppet. Utkastet ditt er lagret.`,
    `Still et spørsmål`, `Endre retning`, `Angre siste endring`, `Flere alternativer`, `Lukk alternativer`, `Veiledet manuell modus`, `Oppgave / instruksjoner`, `Arbeid / svar`, `Fullfører gjeldende trinn…`, `Fortsett å redigere`,
  ],
  uk: [
    `Автоматичний викладач`, `Викладач може автоматично готувати й покращувати чернетку в цьому робочому просторі. Кожна зміна зберігається, і її можна скасувати.`, `Дозволити викладачу підготувати мою роботу`,
    `Викладач готує твою роботу…`, `Завдання зрозуміле`, `Метод підготовлено`, `Робота триває`, `Я розбираюся в умовах завдання.`, `Я готую метод.`, `Я працюю над чернеткою.`, `Я перевіряю результат.`, `Я готую остаточний результат.`,
    `Твоя робота готова.`, `Викладач на паузі. Твою роботу збережено.`, `Викладач тимчасово зупинився. Твою роботу збережено.`, `Автоматична робота досягла межі безпеки. Перевір чернетку перед продовженням.`, `Викладачу потрібне уточнення перед продовженням.`, `Автоматичну роботу зупинено. Твою чернетку збережено.`,
    `Поставити запитання`, `Змінити напрямок`, `Скасувати останню зміну`, `Інші дії`, `Закрити дії`, `Ручний режим із підказками`, `Умова / тема`, `Робота / відповідь`, `Завершення поточного кроку…`, `Продовжити редагування`,
  ],
  ln: [
    `Molakisi ya kosala ye moko`, `Molakisi akoki kobongisa mpe kokómisa malamu mokanda ya ebandeli na esika oyo ya mosala. Mbongwana nyonso ebombamaka mpe ekoki kozongisama nsima.`, `Tiká Molakisi abongisa mosala na ngai`,
    `Molakisi azali kobongisa mosala na yo…`, `Mosala esili kososolama`, `Lolenge ya kosala ebongisami`, `Mosala ezali kokende`, `Nazali kososola malako.`, `Nazali kobongisa lolenge ya kosala.`, `Nazali kosala mokanda ya ebandeli.`, `Nazali kotala soki eyano ezali malamu.`, `Nazali kobongisa eyano ya nsuka.`,
    `Mosala na yo ezali pene.`, `Molakisi apemi. Mosala na yo ebombami.`, `Molakisi atelemi mpo na mwa ntango. Mosala na yo ebombami.`, `Mosala ya kosala yango moko ekómi na ndelo ya bokengi. Talá mokanda ya ebandeli liboso ya kokoba.`, `Molakisi azali na mposa ya ndimbola moko liboso ya kokoba.`, `Mosala ya kosala yango moko etelemi. Mokanda na yo ya ebandeli ebombami.`,
    `Tuná motuna`, `Bongolá nzela`, `Zongisá mbongwana ya nsuka nsima`, `Boponi mosusu`, `Kangá boponi`, `Kosala na mabɔkɔ na litambwisi`, `Malako / motó ya likambo`, `Mosala / eyano`, `Kosilisa litambe oyo ezali kosalema…`, `Kobá kobongisa`,
  ],
  sw: [
    `Mwalimu wa kiotomatiki`, `Mwalimu anaweza kuandaa na kuboresha rasimu ya nafasi hii ya kazi kiotomatiki. Kila badiliko linahifadhiwa na linaweza kutenguliwa.`, `Mruhusu Mwalimu aandaye kazi yangu`,
    `Mwalimu anaandaa kazi yako…`, `Kazi imeeleweka`, `Mbinu imeandaliwa`, `Kazi inaendelea`, `Ninaelewa maelekezo.`, `Ninaandaa mbinu.`, `Ninafanyia kazi rasimu.`, `Ninakagua matokeo.`, `Ninaandaa matokeo ya mwisho.`,
    `Kazi yako iko tayari.`, `Mwalimu amesitishwa kwa muda. Kazi yako imehifadhiwa.`, `Mwalimu amesimama kwa muda. Kazi yako imehifadhiwa.`, `Kazi ya kiotomatiki imefikia kikomo cha usalama. Kagua rasimu kabla ya kuendelea.`, `Mwalimu anahitaji ufafanuzi kabla ya kuendelea.`, `Kazi ya kiotomatiki imesimamishwa. Rasimu yako imehifadhiwa.`,
    `Uliza swali`, `Badilisha mwelekeo`, `Tengua badiliko la mwisho`, `Chaguo zaidi`, `Funga chaguo`, `Hali ya mikono yenye mwongozo`, `Maelekezo / mada`, `Kazi / jibu`, `Ninamalizia hatua ya sasa…`, `Endelea kuhariri`,
  ],
  wo: [
    `Jàngalekat buy doxal boppam`, `Jàngalekat bi man na waajal te gënal sumbu liggéey bi ci barabu liggéey bii ci boppam. Coppite bu nekk dañu koy denc te man nañu koo dindi.`, `May Jàngalekat bi mu waajal sama liggéey`,
    `Jàngalekat bi dafay waajal sa liggéey…`, `Nanguna liggéey bi`, `Pexe bi jekk na`, `Liggéey baa ngi dox`, `Maa ngi xam li ndigal li laaj.`, `Maa ngi waajal pexe bi.`, `Maa ngi liggéey ci sumb bi.`, `Maa ngi seetlu njureef li.`, `Maa ngi waajal njureef bu mujj bi.`,
    `Sa liggéey jekk na.`, `Jàngalekat bi taxaw na tuuti. Denc nañu sa liggéey.`, `Jàngalekat bi taxaw na ci saa sii. Denc nañu sa liggéey.`, `Liggéey bi buy doxal boppam àgg na ci kemu kaaraange bi. Xoolaatal sumb bi bala ngay wéy.`, `Jàngalekat bi soxla na leeral bala muy wéy.`, `Taxawal nañu liggéey bi buy doxal boppam. Denc nañu sa sumb.`,
    `Laaj ab laaj`, `Soppi jubluwaay`, `Dindi coppite bu mujj bi`, `Yeneen tànneef`, `Tëj tànneef yi`, `Doxalin bu nit di jëf ak ndimbal`, `Ndigal / mbir`, `Liggéey / tontu`, `Maa ngi jeexal jéego bii…`, `Wéy ci soppi`,
  ],
  ha: [
    `Malami mai aiki ta atomatik`, `Malamin zai iya shirya da inganta daftarin wannan filin aiki ta atomatik. Ana adana kowane sauyi kuma za a iya janye shi.`, `Bari Malamin ya shirya aikina`,
    `Malamin yana shirya aikinka…`, `An fahimci aikin`, `An shirya hanyar aiki`, `Ana gudanar da aiki`, `Ina fahimtar umarnin.`, `Ina shirya hanyar aiki.`, `Ina aiki a kan daftari.`, `Ina duba sakamakon.`, `Ina shirya sakamakon ƙarshe.`,
    `Aikinka ya shirya.`, `An dakatar da Malamin na ɗan lokaci. An adana aikinka.`, `Malamin ya tsaya na ɗan lokaci. An adana aikinka.`, `Aikin atomatik ya kai iyakar tsaro. Duba daftarin kafin ka ci gaba.`, `Malamin yana buƙatar ƙarin bayani kafin ya ci gaba.`, `An tsayar da aikin atomatik. An adana daftarin ka.`,
    `Yi tambaya`, `Canja alkibla`, `Janye sauyi na ƙarshe`, `Ƙarin zaɓuɓɓuka`, `Rufe zaɓuɓɓuka`, `Yanayin aiki da hannu mai jagora`, `Umarni / batu`, `Aiki / amsa`, `Ana kammala matakin yanzu…`, `Ci gaba da gyarawa`,
  ],
  he: [
    `מורה אוטומטי`, `המורה רשאי להכין ולשפר אוטומטית את הטיוטה בסביבת העבודה הזאת. כל שינוי נשמר וניתן לביטול.`, `לאפשר למורה להכין את העבודה שלי`,
    `המורה מכין את העבודה שלך…`, `המשימה הובנה`, `השיטה הוכנה`, `העבודה מתבצעת`, `אני מבין את ההנחיות.`, `אני מכין את השיטה.`, `אני עובד על הטיוטה.`, `אני בודק את התוצאה.`, `אני מכין את התוצאה הסופית.`,
    `העבודה שלך מוכנה.`, `המורה בהשהיה. העבודה שלך נשמרה.`, `המורה נעצר זמנית. העבודה שלך נשמרה.`, `העבודה האוטומטית הגיעה למגבלת הבטיחות. יש לבדוק את הטיוטה לפני ההמשך.`, `המורה זקוק להבהרה לפני ההמשך.`, `העבודה האוטומטית הופסקה. הטיוטה שלך נשמרה.`,
    `לשאול שאלה`, `לשנות כיוון`, `לבטל את השינוי האחרון`, `אפשרויות נוספות`, `סגירת האפשרויות`, `מצב ידני מודרך`, `הנחיות / נושא`, `עבודה / תשובה`, `מסיים את השלב הנוכחי…`, `המשך עריכה`,
  ],
  'zh-Hant': [
    `教授自動模式`, `教授可以自動準備及改善此工作區的草稿。每次修改都會儲存，並可復原。`, `讓教授準備我的作業`,
    `教授正在準備你的作業…`, `已理解任務`, `已準備方法`, `正在處理作業`, `我正在理解題目要求。`, `我正在準備方法。`, `我正在撰寫草稿。`, `我正在驗證結果。`, `我正在準備最終結果。`,
    `你的作業已準備好。`, `教授已暫停。你的作業已儲存。`, `教授暫時停止了。你的作業已儲存。`, `自動處理已達到安全上限。請先檢查草稿，再繼續。`, `教授需要進一步說明才能繼續。`, `自動處理已停止。你的草稿已儲存。`,
    `提問`, `調整方向`, `復原上次修改`, `更多選項`, `關閉選項`, `手動引導模式`, `題目 / 要求`, `作業 / 答案`, `正在完成目前步驟…`, `繼續編輯`,
  ],
  bn: [
    `স্বয়ংক্রিয় অধ্যাপক`, `অধ্যাপক এই কর্মক্ষেত্রের খসড়া স্বয়ংক্রিয়ভাবে প্রস্তুত ও উন্নত করতে পারেন। প্রতিটি পরিবর্তন সংরক্ষিত হয় এবং ফিরিয়ে নেওয়া যায়।`, `অধ্যাপককে আমার কাজ প্রস্তুত করতে দাও`,
    `অধ্যাপক তোমার কাজ প্রস্তুত করছেন…`, `কাজ বোঝা হয়েছে`, `পদ্ধতি প্রস্তুত`, `কাজ চলছে`, `আমি নির্দেশনা বুঝছি।`, `আমি পদ্ধতি প্রস্তুত করছি।`, `আমি খসড়ায় কাজ করছি।`, `আমি ফলাফল যাচাই করছি।`, `আমি চূড়ান্ত ফলাফল প্রস্তুত করছি।`,
    `তোমার কাজ প্রস্তুত।`, `অধ্যাপক বিরতিতে আছেন। তোমার কাজ সংরক্ষিত।`, `অধ্যাপক সাময়িকভাবে থেমেছেন। তোমার কাজ সংরক্ষিত।`, `স্বয়ংক্রিয় কাজ নিরাপত্তার সীমায় পৌঁছেছে। এগোনোর আগে খসড়া যাচাই করো।`, `এগোনোর আগে অধ্যাপকের একটি বিষয় পরিষ্কার করা প্রয়োজন।`, `স্বয়ংক্রিয় কাজ বন্ধ হয়েছে। তোমার খসড়া সংরক্ষিত।`,
    `প্রশ্ন করো`, `দিক পরিবর্তন করো`, `শেষ পরিবর্তন ফিরিয়ে নাও`, `আরও বিকল্প`, `বিকল্প বন্ধ করো`, `নির্দেশিত ম্যানুয়াল মোড`, `নির্দেশনা / বিষয়`, `কাজ / উত্তর`, `বর্তমান ধাপ শেষ হচ্ছে…`, `সম্পাদনা চালিয়ে যাও`,
  ],
};

for (const [code, values] of Object.entries(workspaceAutopilotTranslations)) {
  extendLocale(code, Object.fromEntries(workspaceAutopilotKeys.map((key, index) => [key, values[index]])));
  extendLocaleAliases(code, workspaceAutopilotAliases);
}
