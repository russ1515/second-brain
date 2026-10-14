import { extendLocale } from '../i18n';

/** Reviewed label for the legacy, detailed Workspace form kept behind the
 * Universal Capture entry point. Keep this action distinct from “Create”. */
export const workspaceCaptureV1: Record<string, Record<string, string>> = {
  es: { 'workspaceCapture.manual': 'Configurar manualmente', 'workspaceCapture.sourceLimit': 'Un espacio admite hasta 50 fuentes. Elimina una y vuelve a intentarlo; tu captura se conserva.' },
  de: { 'workspaceCapture.manual': 'Manuell konfigurieren', 'workspaceCapture.sourceLimit': 'Ein Workspace kann höchstens 50 Quellen enthalten. Entferne eine Quelle und versuche es erneut; deine Erfassung bleibt erhalten.' },
  it: { 'workspaceCapture.manual': 'Configura manualmente', 'workspaceCapture.sourceLimit': 'Un Workspace può contenere al massimo 50 fonti. Rimuovine una e riprova; la cattura è stata conservata.' },
  pt: { 'workspaceCapture.manual': 'Configurar manualmente', 'workspaceCapture.sourceLimit': 'Um Workspace pode conter no máximo 50 fontes. Remove uma e tenta novamente; a captura foi mantida.' },
  hi: { 'workspaceCapture.manual': 'मैन्युअल रूप से कॉन्फ़िगर करें', 'workspaceCapture.sourceLimit': 'एक Workspace में अधिकतम 50 स्रोत हो सकते हैं। एक स्रोत हटाकर फिर प्रयास करें; आपकी कैप्चर सुरक्षित है।' },
  tr: { 'workspaceCapture.manual': 'Elle yapılandır', 'workspaceCapture.sourceLimit': 'Bir Workspace en fazla 50 kaynak içerebilir. Bir kaynağı kaldırıp yeniden deneyin; yakalamanız korundu.' },
  pl: { 'workspaceCapture.manual': 'Skonfiguruj ręcznie', 'workspaceCapture.sourceLimit': 'Workspace może zawierać maksymalnie 50 źródeł. Usuń jedno źródło i spróbuj ponownie; przechwycone dane zachowano.' },
  ru: { 'workspaceCapture.manual': 'Настроить вручную', 'workspaceCapture.sourceLimit': 'В Workspace может быть не более 50 источников. Удалите один источник и повторите попытку; захваченные данные сохранены.' },
  zh: { 'workspaceCapture.manual': '手动配置', 'workspaceCapture.sourceLimit': '一个工作区最多可包含 50 个来源。请移除一个来源后重试；本次采集已保留。' },
  vi: { 'workspaceCapture.manual': 'Cấu hình thủ công', 'workspaceCapture.sourceLimit': 'Một Workspace có thể chứa tối đa 50 nguồn. Hãy xóa một nguồn rồi thử lại; nội dung đã ghi nhận vẫn được giữ.' },
  ja: { 'workspaceCapture.manual': '手動で設定', 'workspaceCapture.sourceLimit': '1つのWorkspaceに追加できるソースは50件までです。1件削除してから再試行してください。キャプチャ内容は保持されています。' },
  sv: { 'workspaceCapture.manual': 'Konfigurera manuellt', 'workspaceCapture.sourceLimit': 'En Workspace kan innehålla högst 50 källor. Ta bort en källa och försök igen; din insamling har sparats.' },
  th: { 'workspaceCapture.manual': 'กำหนดค่าด้วยตนเอง', 'workspaceCapture.sourceLimit': 'Workspace หนึ่งรายการมีแหล่งข้อมูลได้สูงสุด 50 แหล่ง โปรดลบหนึ่งแหล่งแล้วลองอีกครั้ง ข้อมูลที่บันทึกไว้ยังคงอยู่' },
  ar: { 'workspaceCapture.manual': 'الإعداد يدويًا', 'workspaceCapture.sourceLimit': 'يمكن أن يحتوي Workspace على 50 مصدرًا كحد أقصى. أزل مصدرًا ثم أعد المحاولة؛ تم الاحتفاظ بالمحتوى الملتقط.' },
  ko: { 'workspaceCapture.manual': '수동으로 설정', 'workspaceCapture.sourceLimit': 'Workspace에는 최대 50개의 출처를 추가할 수 있습니다. 출처 하나를 제거한 뒤 다시 시도하세요. 캡처 내용은 보존되었습니다.' },
  nl: { 'workspaceCapture.manual': 'Handmatig configureren', 'workspaceCapture.sourceLimit': 'Een Workspace kan maximaal 50 bronnen bevatten. Verwijder een bron en probeer opnieuw; je vastlegging is bewaard.' },
  el: { 'workspaceCapture.manual': 'Χειροκίνητη ρύθμιση', 'workspaceCapture.sourceLimit': 'Ένα Workspace μπορεί να περιέχει έως 50 πηγές. Αφαίρεσε μία πηγή και δοκίμασε ξανά· η καταγραφή σου διατηρήθηκε.' },
  cs: { 'workspaceCapture.manual': 'Nastavit ručně', 'workspaceCapture.sourceLimit': 'Workspace může obsahovat nejvýše 50 zdrojů. Jeden zdroj odeberte a zkuste to znovu; zachycený obsah zůstal uložen.' },
  ro: { 'workspaceCapture.manual': 'Configurează manual', 'workspaceCapture.sourceLimit': 'Un Workspace poate conține cel mult 50 de surse. Elimină o sursă și încearcă din nou; captura a fost păstrată.' },
  hu: { 'workspaceCapture.manual': 'Kézi beállítás', 'workspaceCapture.sourceLimit': 'Egy Workspace legfeljebb 50 forrást tartalmazhat. Távolíts el egy forrást, majd próbáld újra; a rögzített tartalom megmaradt.' },
  da: { 'workspaceCapture.manual': 'Konfigurer manuelt', 'workspaceCapture.sourceLimit': 'Et Workspace kan højst indeholde 50 kilder. Fjern en kilde, og prøv igen; din registrering er bevaret.' },
  fi: { 'workspaceCapture.manual': 'Määritä manuaalisesti', 'workspaceCapture.sourceLimit': 'Workspace voi sisältää enintään 50 lähdettä. Poista yksi lähde ja yritä uudelleen; tallennettu sisältö säilytettiin.' },
  id: { 'workspaceCapture.manual': 'Konfigurasikan secara manual', 'workspaceCapture.sourceLimit': 'Satu Workspace dapat memuat paling banyak 50 sumber. Hapus satu sumber lalu coba lagi; hasil tangkapan Anda tetap disimpan.' },
  nb: { 'workspaceCapture.manual': 'Konfigurer manuelt', 'workspaceCapture.sourceLimit': 'Et Workspace kan inneholde maksimalt 50 kilder. Fjern én kilde og prøv igjen; innholdet du fanget opp er bevart.' },
  uk: { 'workspaceCapture.manual': 'Налаштувати вручну', 'workspaceCapture.sourceLimit': 'Workspace може містити щонайбільше 50 джерел. Видаліть одне джерело й повторіть спробу; захоплені дані збережено.' },
  ln: { 'workspaceCapture.manual': 'Bongisá na mabɔkɔ', 'workspaceCapture.sourceLimit': 'Workspace ekoki kozala na maziba koleka 50 te. Longola liziba moko mpe meká lisusu; makambo oyo okangaki ebatelami.' },
  sw: { 'workspaceCapture.manual': 'Sanidi mwenyewe', 'workspaceCapture.sourceLimit': 'Workspace inaweza kuwa na vyanzo visivyozidi 50. Ondoa chanzo kimoja kisha ujaribu tena; ulichonasa kimehifadhiwa.' },
  wo: { 'workspaceCapture.manual': 'Sampal ak loxo', 'workspaceCapture.sourceLimit': 'Workspace mën na am lu ëpp 50 gongikuwaay. Dindi benn te jéemaat; li nga jàppoon dañu ko denc.' },
  ha: { 'workspaceCapture.manual': 'Saita da hannu', 'workspaceCapture.sourceLimit': 'Workspace na iya ɗaukar tushe 50 kawai. Cire tushe ɗaya sannan ka sake gwadawa; an adana abin da ka kama.' },
  he: { 'workspaceCapture.manual': 'הגדרה ידנית', 'workspaceCapture.sourceLimit': 'Workspace יכול להכיל עד 50 מקורות. יש להסיר מקור אחד ולנסות שוב; התוכן שנקלט נשמר.' },
  'zh-Hant': { 'workspaceCapture.manual': '手動設定', 'workspaceCapture.sourceLimit': '一個 Workspace 最多可包含 50 個來源。請移除一個來源後再試；本次擷取內容已保留。' },
  bn: { 'workspaceCapture.manual': 'ম্যানুয়ালি কনফিগার করুন', 'workspaceCapture.sourceLimit': 'একটি Workspace-এ সর্বোচ্চ ৫০টি উৎস রাখা যায়। একটি উৎস সরিয়ে আবার চেষ্টা করুন; আপনার ক্যাপচার সংরক্ষিত আছে।' },
};

for (const [code, catalog] of Object.entries(workspaceCaptureV1)) {
  extendLocale(code, catalog);
}
