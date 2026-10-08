import * as Print from 'expo-print';
import type { LearningReportView } from '@second-brain/shared';

export interface LearningReportPdfCopy {
  title: string;
  subtitle: string;
  generated: string;
  learnerName: string;
  declared: string;
  observed: string;
  assessed: string;
  ageBand: string;
  originCountry: string;
  currentCountry: string;
  teachingLanguage: string;
  subjects: string;
  goals: string;
  preferences: string;
  learningProfile: string;
  lessons: string;
  tutorSessions: string;
  concepts: string;
  completedSessions: string;
  reviews: string;
  lastActivity: string;
  completedLearning: string;
  knowledge: string;
  understanding: string;
  application: string;
  reasoning: string;
  criticalReflection: string;
  perspective: string;
  evidenceCount: string;
  started: string;
  finalized: string;
  objective: string;
  result: string;
  noEvidence: string;
  notAvailable: string;
  privacyNote: string;
  provenanceNote: string;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function present(value: unknown, fallback: string): string {
  if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function row(label: string, value: unknown, fallback: string): string {
  return `<div class="row"><dt>${esc(label)}</dt><dd><bdi dir="auto">${esc(present(value, fallback))}</bdi></dd></div>`;
}

/** Pure, deterministic HTML used by Expo Print on native and Web. */
export function learningReportHtml(
  report: LearningReportView,
  copy: LearningReportPdfCopy,
  formatLocale: string,
  direction: 'ltr' | 'rtl',
  ageBandLabel?: string,
): string {
  const declared = report.declared.profile;
  const observed = report.observed;
  const assessed = report.assessed;
  const education = [
    declared.education.level,
    declared.education.field,
    declared.education.specialty,
    declared.education.year,
  ].filter(Boolean).join(' · ');
  const lastActivity = observed.lastLearningActivityAt
    ? new Date(observed.lastLearningActivityAt).toLocaleDateString(formatLocale)
    : copy.notAvailable;
  const generated = new Date(report.generatedAt).toLocaleString(formatLocale);
  const dimensionLabels = {
    knowledge: copy.knowledge,
    understanding: copy.understanding,
    application: copy.application,
    reasoning: copy.reasoning,
    critical_reflection: copy.criticalReflection,
    perspective: copy.perspective,
  } as const;
  const dimensionMetrics = assessed.evidenceProgress.dimensions.map((dimension) => `
    <div class="metric"><strong>${dimension.percent === null ? esc(copy.notAvailable) : `${Math.round(dimension.percent)}%`}</strong>${esc(dimensionLabels[dimension.dimension])}
      <small>${dimension.evaluatedEvidenceCount} · ${esc(copy.evidenceCount)}</small>
    </div>`).join('');
  const completionHistory = assessed.completionHistory.items.map((item) => {
    const started = item.startedAt ? new Date(item.startedAt).toLocaleString(formatLocale) : copy.notAvailable;
    const finalized = new Date(item.finalizedAt).toLocaleString(formatLocale);
    const result = item.result.score === null
      ? item.result.outcome
      : `${item.result.outcome} · ${Math.round(item.result.score * 100)}%`;
    return `<article class="completion"><h3>${esc(item.title)}</h3><dl>
      ${row(copy.started, started, copy.notAvailable)}
      ${row(copy.finalized, finalized, copy.notAvailable)}
      ${row(copy.objective, item.objective, copy.notAvailable)}
      ${row(copy.result, result, copy.notAvailable)}
      ${row(`${item.provenance.evidenceRefIds.length} · ${copy.evidenceCount}`, new Date(item.provenance.evaluatedAt).toLocaleString(formatLocale), copy.notAvailable)}
    </dl></article>`;
  }).join('');

  return `<!doctype html>
<html lang="${esc(report.locale)}" dir="${direction}">
<head><meta charset="utf-8"/><title>${esc(copy.title)}</title><style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #17171f; background: #fff; font-family: Arial, "Noto Sans", sans-serif; font-size: 10.5pt; line-height: 1.45; }
  header { padding: 0 0 12mm; border-bottom: 2px solid #5b4bdb; }
  h1 { margin: 0 0 2mm; font-size: 24pt; letter-spacing: -0.4px; }
  .subtitle { margin: 0; color: #555466; max-width: 165mm; }
  .generated { margin-top: 3mm; color: #777687; font-size: 8.5pt; }
  section { break-inside: avoid; margin-top: 8mm; padding: 5mm; border: 1px solid #dedce9; border-radius: 4mm; }
  h2 { margin: 0 0 1mm; font-size: 14pt; }
  .source { display: inline-block; margin-bottom: 4mm; padding: 1mm 2.5mm; border-radius: 20mm; background: #eeeaff; color: #4a37bd; font-size: 8pt; font-weight: 700; letter-spacing: .5px; }
  dl { margin: 0; }
  .row { display: grid; grid-template-columns: minmax(40mm, 1fr) 2fr; gap: 6mm; padding: 2mm 0; border-top: 1px solid #eeedf3; }
  .row:first-child { border-top: 0; }
  dt { color: #666577; font-weight: 600; }
  dd { margin: 0; overflow-wrap: anywhere; }
  .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; }
  .metric { padding: 3mm; background: #f7f6fb; border-radius: 3mm; }
  .metric strong { display: block; font-size: 17pt; color: #332a8e; }
  .metric small { display: block; margin-top: 1mm; color: #777687; }
  .completion { margin-top: 4mm; padding-top: 3mm; border-top: 1px solid #eeedf3; break-inside: avoid; }
  .completion h3 { margin: 0 0 2mm; font-size: 11pt; }
  .empty { color: #777687; font-style: italic; }
  footer { margin-top: 9mm; padding-top: 4mm; border-top: 1px solid #dedce9; color: #666577; font-size: 8.5pt; }
  @media print { section { break-inside: avoid-page; } }
  @media (max-width: 600px) { .metrics { grid-template-columns: 1fr; } .row { grid-template-columns: 1fr; gap: 0; } }
</style></head><body>
<header><h1>${esc(copy.title)}</h1><p class="subtitle">${esc(copy.subtitle)}</p><p class="generated">${esc(copy.generated)} · ${esc(generated)}</p></header>
<section><h2>${esc(copy.declared)}</h2><span class="source">${esc(copy.declared)}</span><dl>
  ${row(copy.learnerName, report.learnerName, copy.notAvailable)}
  ${row(copy.ageBand, ageBandLabel ?? declared.ageBand, copy.notAvailable)}
  ${row(copy.originCountry, declared.countryOfOrigin, copy.notAvailable)}
  ${row(copy.currentCountry, declared.currentCountry, copy.notAvailable)}
  ${row(copy.teachingLanguage, declared.teachingLanguage, copy.notAvailable)}
  ${row(copy.subjects, declared.subjects, copy.notAvailable)}
  ${row(copy.goals, declared.academicGoals, copy.notAvailable)}
  ${row(copy.preferences, declared.learningPreferences, copy.notAvailable)}
  ${row(copy.learningProfile, education, copy.notAvailable)}
</dl></section>
<section><h2>${esc(copy.observed)}</h2><span class="source">${esc(copy.observed)}</span><div class="metrics">
  <div class="metric"><strong>${observed.totals.lessons}</strong>${esc(copy.lessons)}</div>
  <div class="metric"><strong>${observed.totals.tutorSessions}</strong>${esc(copy.tutorSessions)}</div>
  <div class="metric"><strong>${observed.totals.concepts}</strong>${esc(copy.concepts)}</div>
  <div class="metric"><strong>${observed.totals.completedStudySessions}</strong>${esc(copy.completedSessions)}</div>
  <div class="metric"><strong>${observed.totals.reviews}</strong>${esc(copy.reviews)}</div>
</div><dl>${row(copy.lastActivity, lastActivity, copy.notAvailable)}
${observed.learnerProfile ? row(copy.learningProfile, `${observed.learnerProfile.level.score ?? copy.notAvailable} / 100 · ${observed.learnerProfile.interactions}`, copy.notAvailable) : `<p class="empty">${esc(copy.noEvidence)}</p>`}</dl></section>
<section><h2>${esc(copy.assessed)}</h2><span class="source">${esc(copy.assessed)}</span>
${assessed.evidenceAvailable ? `<div class="metrics">${dimensionMetrics}</div>
  <h3>${esc(copy.completedLearning)}</h3>${completionHistory || `<p class="empty">${esc(copy.noEvidence)}</p>`}` : `<p class="empty">${esc(copy.noEvidence)}</p>`}
</section>
<footer><p>${esc(copy.provenanceNote)}</p><p>${esc(copy.privacyNote)}</p></footer>
</body></html>`;
}

export async function saveLearningReportAsPdf(
  report: LearningReportView,
  copy: LearningReportPdfCopy,
  formatLocale: string,
  direction: 'ltr' | 'rtl',
  ageBandLabel?: string,
): Promise<void> {
  await Print.printAsync({
    html: learningReportHtml(report, copy, formatLocale, direction, ageBandLabel),
  });
}
