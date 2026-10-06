import { extendLocale } from '../i18n';

/** Reviewed semantic voice state added by Phase 2. Keeping it in a narrow
 * overlay preserves the 34 complete catalogs without regenerating them. */
const voicePhase2: Record<string, Record<string, string>> = {
  ar: { 'voice11.state.speaking': 'الأستاذ يتحدث' },
  bn: { 'voice11.state.speaking': 'অধ্যাপক কথা বলছেন' },
  cs: { 'voice11.state.speaking': 'Profesor mluví' },
  da: { 'voice11.state.speaking': 'Professoren taler' },
  de: { 'voice11.state.speaking': 'Der Professor spricht' },
  el: { 'voice11.state.speaking': 'Ο Καθηγητής μιλά' },
  es: { 'voice11.state.speaking': 'El Profesor está hablando' },
  fi: { 'voice11.state.speaking': 'Professori puhuu' },
  ha: { 'voice11.state.speaking': 'Malami yana magana' },
  he: { 'voice11.state.speaking': 'הפרופסור מדבר' },
  hi: { 'voice11.state.speaking': 'प्रोफ़ेसर बोल रहे हैं' },
  hu: { 'voice11.state.speaking': 'A professzor beszél' },
  id: { 'voice11.state.speaking': 'Profesor sedang berbicara' },
  it: { 'voice11.state.speaking': 'Il Professore sta parlando' },
  ja: { 'voice11.state.speaking': '教授が話しています' },
  ko: { 'voice11.state.speaking': '교수님이 말하고 있습니다' },
  ln: { 'voice11.state.speaking': 'Molakisi azali koloba' },
  nb: { 'voice11.state.speaking': 'Professoren snakker' },
  nl: { 'voice11.state.speaking': 'De professor spreekt' },
  pl: { 'voice11.state.speaking': 'Profesor mówi' },
  pt: { 'voice11.state.speaking': 'O Professor está a falar' },
  ro: { 'voice11.state.speaking': 'Profesorul vorbește' },
  ru: { 'voice11.state.speaking': 'Профессор говорит' },
  sv: { 'voice11.state.speaking': 'Professorn talar' },
  sw: { 'voice11.state.speaking': 'Profesa anazungumza' },
  th: { 'voice11.state.speaking': 'ศาสตราจารย์กำลังพูด' },
  tr: { 'voice11.state.speaking': 'Profesör konuşuyor' },
  uk: { 'voice11.state.speaking': 'Професор говорить' },
  vi: { 'voice11.state.speaking': 'Giáo sư đang nói' },
  wo: { 'voice11.state.speaking': 'Jàngalekat bi mi ngi wax' },
  zh: { 'voice11.state.speaking': '教授正在说话' },
  'zh-Hant': { 'voice11.state.speaking': '教授正在說話' },
};

for (const [code, catalog] of Object.entries(voicePhase2)) {
  extendLocale(code, catalog);
}
