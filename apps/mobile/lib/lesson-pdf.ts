import * as Print from 'expo-print';
import type { LessonView } from '@second-brain/shared';

/** Escape learner/model text before it goes into the PDF's HTML. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${esc(block).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/**
 * Save a lesson as a PDF.
 *
 * Printed light-on-white on purpose: the classroom is dark, but a lesson that
 * gets printed or filed should look like a document, not a screenshot.
 *
 * Exercise ANSWERS are included — this is the learner's own study sheet, and a
 * revision sheet without the corrections is half a lesson.
 */
export function lessonHtml(lesson: LessonView, locale = 'en'): string {
  const fr = locale.toLowerCase().startsWith('fr');
  const copy = fr
    ? {
        examples: 'Exemples guidés', exercises: 'Exercices', answer: 'Réponse',
        keyPoints: 'Points clés', objective: 'Objectif', explanation: 'Explication',
        homework: 'Devoirs', summary: 'Résumé', revision: 'Fiche de révision',
        level: 'niveau', footerOne: 'carte de cette leçon est planifiée',
        footerMany: 'cartes de cette leçon sont planifiées', queue: 'dans ta file de révision',
      }
    : {
        examples: 'Worked examples', exercises: 'Exercises', answer: 'Answer',
        keyPoints: 'Key takeaways', objective: 'Objective', explanation: 'Explanation',
        homework: 'Homework', summary: 'Summary', revision: 'Revision sheet',
        level: 'level', footerOne: 'flashcard from this lesson is scheduled',
        footerMany: 'flashcards from this lesson are scheduled', queue: 'in your revision queue',
      };
  const section = (title: string, body: string) =>
    body?.trim() ? `<h2>${esc(title)}</h2>${paragraphs(body)}` : '';

  const examples = lesson.examples.length
    ? `<h2>${copy.examples}</h2><ol>${lesson.examples
        .map((e) => `<li>${esc(e).replace(/\n/g, '<br/>')}</li>`)
        .join('')}</ol>`
    : '';

  const exercises = lesson.exercises.length
    ? `<h2>${copy.exercises}</h2><ol>${lesson.exercises
        .map(
          (e) =>
            `<li><p class="q">${esc(e.question)}</p><p class="a"><strong>${copy.answer} :</strong> ${esc(
              e.answer,
            )}</p></li>`,
        )
        .join('')}</ol>`
    : '';

  const keyPoints = lesson.keyPoints.length
    ? `<h2>${copy.keyPoints}</h2><ul>${lesson.keyPoints
        .map((p) => `<li>${esc(p)}</li>`)
        .join('')}</ul>`
    : '';

  return `
<html>
  <head><meta charset="utf-8" />
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.55;
           padding: 32px 36px; max-width: 720px; }
    h1 { font-size: 26px; margin: 0 0 4px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 22px;
            border-bottom: 1px solid #ddd; padding-bottom: 12px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #555;
         margin: 26px 0 8px; }
    p { margin: 0 0 10px; }
    li { margin-bottom: 12px; }
    .q { font-weight: bold; margin-bottom: 4px; }
    .a { color: #444; }
    .objective { background: #f4f6fb; border-left: 3px solid #2563EB;
                 padding: 10px 14px; margin-bottom: 8px; }
    footer { margin-top: 34px; padding-top: 10px; border-top: 1px solid #ddd;
             color: #888; font-size: 11px; }
  </style></head>
  <body>
    <h1>${esc(lesson.topic)}</h1>
    <div class="meta">
      ${lesson.language ? `${esc(lesson.language)} · ` : ''}${
        lesson.level ? `${esc(lesson.level)} ${copy.level} · ` : ''
      }${new Date(lesson.createdAt).toLocaleDateString(locale)}
    </div>
    <div class="objective"><strong>${copy.objective}.</strong> ${esc(lesson.objective)}</div>
    ${lesson.intro ? paragraphs(lesson.intro) : ''}
    ${section(copy.explanation, lesson.explanation)}
    ${examples}
    ${exercises}
    ${keyPoints}
    ${section(copy.homework, lesson.homework)}
    ${section(copy.summary, lesson.summary)}
    ${section(copy.revision, lesson.revisionSheet)}
    <footer>Second Brain — ${lesson.cardCount} ${
      lesson.cardCount === 1 ? copy.footerOne : copy.footerMany
    } ${copy.queue}.</footer>
  </body>
</html>`;
}

/** Open the platform's print/save dialog for this lesson. On web this is the
 *  browser's print sheet, where "Save as PDF" is the standard destination. */
export async function saveLessonAsPdf(lesson: LessonView, locale = 'en'): Promise<void> {
  await Print.printAsync({ html: lessonHtml(lesson, locale) });
}
