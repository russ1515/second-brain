import * as Print from 'expo-print';
import type { LessonView } from '@second-brain/shared';

export interface LessonPdfLabels {
  introduction: string;
  examples: string;
  questions: string;
  exercises: string;
  correction: string;
  keyPoints: string;
  objective: string;
  explanation: string;
  homework: string;
  summary: string;
  revision: string;
  level: string;
  cardsScheduled: string;
}

const ENGLISH_LABELS: LessonPdfLabels = {
  introduction: 'Introduction',
  examples: 'Worked examples',
  questions: 'Guided questions',
  exercises: 'Exercises',
  correction: 'Correction',
  keyPoints: 'Key takeaways',
  objective: 'Objective',
  explanation: 'Explanation',
  homework: 'Homework',
  summary: 'Summary',
  revision: 'Revision sheet',
  level: 'level',
  cardsScheduled: 'flashcards are scheduled in your revision queue.',
};

const FRENCH_LABELS: LessonPdfLabels = {
  introduction: 'Introduction',
  examples: 'Exemples guidés',
  questions: 'Questions guidées',
  exercises: 'Exercices',
  correction: 'Correction',
  keyPoints: 'Points clés',
  objective: 'Objectif',
  explanation: 'Explication',
  homework: 'Devoirs',
  summary: 'Résumé',
  revision: 'Fiche de révision',
  level: 'niveau',
  cardsScheduled: 'cartes sont planifiées dans ta file de révision.',
};

const RTL_LOCALES = new Set(['ar', 'fa', 'he', 'ur']);

/** Escape learner/model text before it goes into the PDF's HTML. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .filter((block) => block.trim())
    .map((block) => `<p dir="auto">${esc(block).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function orderedItems(values: readonly string[], className = ''): string {
  if (!values.length) return '';
  const classAttribute = className ? ` class="${className}"` : '';
  return `<ol${classAttribute}>${values
    .map((value) => `<li><span dir="auto">${esc(value).replace(/\n/g, '<br/>')}</span></li>`)
    .join('')}</ol>`;
}

function isRtlLesson(lesson: LessonView, locale: string): boolean {
  const base = locale.split('-')[0]?.toLowerCase() ?? '';
  if (RTL_LOCALES.has(base)) return true;
  const sample = [
    lesson.topic,
    lesson.objective,
    lesson.intro,
    lesson.explanation,
    lesson.summary,
    lesson.revisionSheet,
    ...lesson.examples,
    ...lesson.questions,
    ...lesson.keyPoints,
    ...lesson.exercises.flatMap((exercise) => [
      exercise.question,
      exercise.answer,
      ...(exercise.options ?? []),
    ]),
  ].join(' ');
  const rtlCount = (sample.match(/[\u0590-\u08ff]/gu) ?? []).length;
  const letterCount = (sample.match(/[\p{L}]/gu) ?? []).length;
  return letterCount > 0 && rtlCount / letterCount >= 0.4;
}

/**
 * Build a complete lesson document from LessonView, never from the current
 * viewport. Labels come from the active runtime catalogue so all supported UI
 * languages reuse the same renderer without an English-only branch.
 */
export function lessonHtml(
  lesson: LessonView,
  formatLocale = 'en',
  labels?: Partial<LessonPdfLabels>,
): string {
  const fallback = formatLocale.toLowerCase().startsWith('fr')
    ? FRENCH_LABELS
    : ENGLISH_LABELS;
  const copy = { ...fallback, ...labels };
  const direction = isRtlLesson(lesson, formatLocale) ? 'rtl' : 'ltr';
  const section = (title: string, body: string) =>
    body?.trim()
      ? `<section><h2>${esc(title)}</h2>${paragraphs(body)}</section>`
      : '';

  const introduction = lesson.intro.trim()
    ? `<section><h2>${esc(copy.introduction)}</h2>${paragraphs(lesson.intro)}</section>`
    : '';
  const examples = lesson.examples.length
    ? `<section><h2>${esc(copy.examples)}</h2>${orderedItems(lesson.examples, 'examples')}</section>`
    : '';
  const questions = lesson.questions.length
    ? `<section><h2>${esc(copy.questions)}</h2>${orderedItems(lesson.questions, 'questions')}</section>`
    : '';
  const exercises = lesson.exercises.length
    ? `<section><h2>${esc(copy.exercises)}</h2><ol class="exercises">${lesson.exercises
        .map((exercise) => {
          const options = exercise.options?.length
            ? `<ul class="options">${exercise.options
                .map((option) => `<li><span dir="auto">${esc(option)}</span></li>`)
                .join('')}</ul>`
            : '';
          return `<li class="exercise"><span class="question" dir="auto">${esc(exercise.question)}</span>${options}<div class="correction"><strong>${esc(copy.correction)}:</strong> <span dir="auto">${esc(exercise.answer)}</span></div></li>`;
        })
        .join('')}</ol></section>`
    : '';
  const keyPoints = lesson.keyPoints.length
    ? `<section><h2>${esc(copy.keyPoints)}</h2><ul class="key-points">${lesson.keyPoints
        .map((point) => `<li><span dir="auto">${esc(point)}</span></li>`)
        .join('')}</ul></section>`
    : '';

  return `<!doctype html>
<html lang="${esc(formatLocale)}" dir="${direction}">
  <head><meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 18mm 16mm 20mm; }
    * { box-sizing: border-box; }
    html { color-scheme: light; }
    body { margin: 0; color: #17171f; background: #fff;
      font-family: Arial, "Noto Sans", "Noto Sans Arabic", "Noto Sans Hebrew", sans-serif;
      font-size: 11pt; line-height: 1.55; }
    h1 { font-size: 24pt; line-height: 1.15; margin: 0 0 3mm; }
    h2 { color: #4d4b65; font-size: 13pt; letter-spacing: .04em;
      margin: 9mm 0 3mm; page-break-after: avoid; break-after: avoid-page; }
    p { margin: 0 0 4mm; overflow-wrap: anywhere; }
    li { margin: 0 0 3mm; }
    .objective, .meta, .correction { break-inside: avoid-page; page-break-inside: avoid; }
    ol, ul { padding-inline-start: 7mm; margin: 0; }
    .meta { color: #666; font-size: 9.5pt; margin-bottom: 7mm;
      border-bottom: 1px solid #ddd; padding-bottom: 4mm; }
    .objective { background: #f4f3ff; border-inline-start: 3px solid #5a45ef;
      padding: 4mm 5mm; margin-bottom: 6mm; }
    .examples > li, .exercise { padding: 3mm 0; }
    .question { display: inline; font-weight: 700; }
    .options { margin: 2mm 0; }
    .correction { color: #38364c; background: #f6f6f8; border-radius: 3mm;
      padding: 3mm 4mm; }
    footer { margin-top: 6mm; padding-top: 4mm; border-top: 1px solid #ddd;
      color: #777; font-size: 9pt; break-inside: avoid; page-break-inside: avoid; }
    html[dir="rtl"] body { text-align: right; }
    html[dir="rtl"] ol, html[dir="rtl"] ul {
      padding-inline-start: 0; padding-inline-end: 7mm; list-style-position: inside;
    }
  </style></head>
  <body>
    <header>
      <h1 dir="auto">${esc(lesson.topic)}</h1>
      <div class="meta" dir="auto">${
        lesson.language ? `${esc(lesson.language)} · ` : ''
      }${lesson.level ? `${esc(lesson.level)} ${esc(copy.level)} · ` : ''}${esc(
        new Intl.DateTimeFormat(formatLocale).format(new Date(lesson.createdAt)),
      )}</div>
    </header>
    <div class="objective"><strong>${esc(copy.objective)}.</strong> <span dir="auto">${esc(lesson.objective)}</span></div>
    ${introduction}
    ${section(copy.explanation, lesson.explanation)}
    ${examples}
    ${questions}
    ${exercises}
    ${keyPoints}
    ${section(copy.homework, lesson.homework)}
    ${section(copy.summary, lesson.summary)}
    ${section(copy.revision, lesson.revisionSheet)}
    <footer>Second Brain — ${lesson.cardCount} ${esc(copy.cardsScheduled)}</footer>
  </body>
</html>`;
}

/** Open the platform's print/save dialog for this complete lesson. */
export async function saveLessonAsPdf(
  lesson: LessonView,
  formatLocale = 'en',
  labels?: Partial<LessonPdfLabels>,
): Promise<void> {
  const html = lessonHtml(lesson, formatLocale, labels);
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    await printLessonHtmlOnWeb(html);
    return;
  }
  await Print.printAsync({ html });
}

/** Expo Print's Web adapter delegates to `window.print()` and ignores `html`.
 * Render the lesson in an isolated frame so the app shell, composer and voice
 * controls can never leak into the browser's Save as PDF output. */
export function printLessonHtmlOnWeb(html: string): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.reject(new Error('WEB_PRINT_UNAVAILABLE'));
  }

  return new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.inset = 'auto 0 0 auto';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.border = '0';
    frame.style.opacity = '0';

    let started = false;
    let cleanupTimer: number | null = null;
    const cleanup = () => {
      if (cleanupTimer) window.clearTimeout(cleanupTimer);
      cleanupTimer = null;
      frame.remove();
    };
    const start = () => {
      if (started) return;
      started = true;
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        cleanup();
        reject(new Error('WEB_PRINT_UNAVAILABLE'));
        return;
      }
      try {
        printWindow.addEventListener('afterprint', cleanup, { once: true });
        printWindow.focus();
        printWindow.print();
        // Some engines omit `afterprint` when the dialog is cancelled. Keep
        // the frame long enough for the print snapshot, then release it.
        cleanupTimer = window.setTimeout(cleanup, 60_000);
        resolve();
      } catch {
        cleanup();
        reject(new Error('WEB_PRINT_FAILED'));
      }
    };

    frame.addEventListener('load', start, { once: true });
    document.body.appendChild(frame);
    const printDocument = frame.contentDocument;
    if (!printDocument) {
      cleanup();
      reject(new Error('WEB_PRINT_UNAVAILABLE'));
      return;
    }
    printDocument.open();
    printDocument.write(html);
    printDocument.close();
    if (printDocument.readyState === 'complete') window.setTimeout(start, 0);
  });
}
