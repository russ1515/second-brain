import { extendLocale } from '../i18n';

/** Reviewed AW-4 copy for the two irreducible dialectical labels. All other
 * shell copy reuses the already translated Workspace and orchestrator keys. */
export const workspaceShellsV1: Record<string, Record<string, string>> = {
  es: {
    'workspaceShell.dissertation.thesis': 'Tesis',
    'workspaceShell.dissertation.antithesis': 'Antítesis',
  },
  de: {
    'workspaceShell.dissertation.thesis': 'These',
    'workspaceShell.dissertation.antithesis': 'Antithese',
  },
  it: {
    'workspaceShell.dissertation.thesis': 'Tesi',
    'workspaceShell.dissertation.antithesis': 'Antitesi',
  },
  pt: {
    'workspaceShell.dissertation.thesis': 'Tese',
    'workspaceShell.dissertation.antithesis': 'Antítese',
  },
  hi: {
    'workspaceShell.dissertation.thesis': 'पक्ष',
    'workspaceShell.dissertation.antithesis': 'प्रतिपक्ष',
  },
  tr: {
    'workspaceShell.dissertation.thesis': 'Tez',
    'workspaceShell.dissertation.antithesis': 'Antitez',
  },
  pl: {
    'workspaceShell.dissertation.thesis': 'Teza',
    'workspaceShell.dissertation.antithesis': 'Antyteza',
  },
  ru: {
    'workspaceShell.dissertation.thesis': 'Тезис',
    'workspaceShell.dissertation.antithesis': 'Антитезис',
  },
  zh: {
    'workspaceShell.dissertation.thesis': '论点',
    'workspaceShell.dissertation.antithesis': '反论点',
  },
  vi: {
    'workspaceShell.dissertation.thesis': 'Luận đề',
    'workspaceShell.dissertation.antithesis': 'Phản đề',
  },
  ja: {
    'workspaceShell.dissertation.thesis': '主張',
    'workspaceShell.dissertation.antithesis': '反論',
  },
  sv: {
    'workspaceShell.dissertation.thesis': 'Tes',
    'workspaceShell.dissertation.antithesis': 'Antites',
  },
  th: {
    'workspaceShell.dissertation.thesis': 'ข้อเสนอ',
    'workspaceShell.dissertation.antithesis': 'ข้อโต้แย้ง',
  },
  ar: {
    'workspaceShell.dissertation.thesis': 'الأطروحة',
    'workspaceShell.dissertation.antithesis': 'النقيض',
  },
  ko: {
    'workspaceShell.dissertation.thesis': '정립',
    'workspaceShell.dissertation.antithesis': '반정립',
  },
  nl: {
    'workspaceShell.dissertation.thesis': 'These',
    'workspaceShell.dissertation.antithesis': 'Antithese',
  },
  el: {
    'workspaceShell.dissertation.thesis': 'Θέση',
    'workspaceShell.dissertation.antithesis': 'Αντίθεση',
  },
  cs: {
    'workspaceShell.dissertation.thesis': 'Teze',
    'workspaceShell.dissertation.antithesis': 'Antiteze',
  },
  ro: {
    'workspaceShell.dissertation.thesis': 'Teză',
    'workspaceShell.dissertation.antithesis': 'Antiteză',
  },
  hu: {
    'workspaceShell.dissertation.thesis': 'Tézis',
    'workspaceShell.dissertation.antithesis': 'Antitézis',
  },
  da: {
    'workspaceShell.dissertation.thesis': 'Tese',
    'workspaceShell.dissertation.antithesis': 'Antitese',
  },
  fi: {
    'workspaceShell.dissertation.thesis': 'Teesi',
    'workspaceShell.dissertation.antithesis': 'Antiteesi',
  },
  id: {
    'workspaceShell.dissertation.thesis': 'Tesis',
    'workspaceShell.dissertation.antithesis': 'Antitesis',
  },
  nb: {
    'workspaceShell.dissertation.thesis': 'Tese',
    'workspaceShell.dissertation.antithesis': 'Antitese',
  },
  uk: {
    'workspaceShell.dissertation.thesis': 'Теза',
    'workspaceShell.dissertation.antithesis': 'Антитеза',
  },
  ln: {
    'workspaceShell.dissertation.thesis': 'Likanisi ya liboso',
    'workspaceShell.dissertation.antithesis': 'Likanisi ya kotelemela',
  },
  sw: {
    'workspaceShell.dissertation.thesis': 'Hoja kuu',
    'workspaceShell.dissertation.antithesis': 'Hoja kinzani',
  },
  wo: {
    'workspaceShell.dissertation.thesis': 'Xalaat bu njëkk',
    'workspaceShell.dissertation.antithesis': 'Xalaat wu koy weddi',
  },
  ha: {
    'workspaceShell.dissertation.thesis': 'Babban hujja',
    'workspaceShell.dissertation.antithesis': 'Hujjar akasi',
  },
  he: {
    'workspaceShell.dissertation.thesis': 'תזה',
    'workspaceShell.dissertation.antithesis': 'אנטיתזה',
  },
  'zh-Hant': {
    'workspaceShell.dissertation.thesis': '論點',
    'workspaceShell.dissertation.antithesis': '反論點',
  },
  bn: {
    'workspaceShell.dissertation.thesis': 'মূল বক্তব্য',
    'workspaceShell.dissertation.antithesis': 'বিপরীত বক্তব্য',
  },
};

for (const [code, catalog] of Object.entries(workspaceShellsV1)) {
  extendLocale(code, catalog);
}
