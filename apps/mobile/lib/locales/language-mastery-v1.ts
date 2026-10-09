import { extendLocaleAliases } from '../i18n';

/**
 * Bounded copy for the autonomous language-mastery gate.
 *
 * English and French carry the precise product wording in the source catalog.
 * The other complete catalogs reuse already-reviewed copy from their own
 * locale so the new flow never falls back to English. Those aliases guarantee
 * technical coverage; they do not claim a new human linguistic review.
 */
export const languageMasteryKeys = [
  'rlle.ui.autonomy.notice',
  'rlle.ui.autonomy.verdict.mastered',
  'rlle.ui.autonomy.verdict.not-mastered',
  'rlle.ui.autonomy.verdict.not-evaluable',
  'rlle.ui.autonomy.leaveForHelp',
  'rlle.ui.autonomy.start',
  'rlle.ui.autonomy.resume',
  'rlle.ui.remediation.start',
  'rlle.ui.remediation.ready',
  'rlle.ui.training.format.recognition-mcq',
  'rlle.ui.training.format.contextual-discrimination',
  'rlle.ui.training.format.fill-blank-no-hint',
  'rlle.ui.training.format.sentence-reconstruction',
  'rlle.ui.training.format.register-matching',
  'rlle.ui.training.format.error-correction',
  'rlle.ui.training.format.listening-discrimination',
  'rlle.ui.training.format.guided-writing',
  'rlle.ui.training.format.voice-pronunciation',
  'rlle.ui.training.format.mini-dialogue',
  'rlle.ui.training.tokenBank',
  'rlle.ui.training.voice',
  'rlle.ui.training.answer',
  'rlle.ui.capabilities.title',
  'rlle.ui.capabilities.detail',
  'rlle.ui.capabilities.audioCapture',
  'rlle.ui.capabilities.transcription',
  'rlle.ui.capabilities.spokenContent',
  'rlle.ui.capabilities.listening',
  'rlle.ui.capabilities.graphy',
  'rlle.ui.capabilities.pronunciation',
  'rlle.ui.capabilities.available',
  'rlle.ui.capabilities.runtimeRequired',
  'rlle.ui.capabilities.notEvaluable',
  'rlle.ui.capabilities.providerReady',
  'rlle.ui.capabilities.blocked',
  'rlle.ui.capabilities.blockedDetail',
  'rlle.ui.capabilities.checkMicrophone',
  'rlle.ui.capabilities.strictDisabled',
] as const;

export const languageMasteryLocaleCodes = [
  'es', 'de', 'it', 'pt', 'hi', 'tr', 'pl', 'ru', 'zh', 'vi', 'ja', 'sv',
  'th', 'ar', 'ko', 'nl', 'el', 'cs', 'ro', 'hu', 'da', 'fi', 'id', 'nb',
  'uk', 'ln', 'sw', 'wo', 'ha', 'he', 'zh-Hant', 'bn',
] as const;

export const languageMasteryAliases: Record<(typeof languageMasteryKeys)[number], string> = {
  'rlle.ui.autonomy.notice': 'teacher.exam.feedbackAfter',
  'rlle.ui.autonomy.verdict.mastered': 'rlle.ui.cando.status.validated',
  'rlle.ui.autonomy.verdict.not-mastered': 'lesson.notQuite',
  'rlle.ui.autonomy.verdict.not-evaluable': 'rlle.ui.course.notEvaluated',
  'rlle.ui.autonomy.leaveForHelp': 'rlle.ui.common.backCourse',
  'rlle.ui.autonomy.start': 'examiner.take',
  'rlle.ui.autonomy.resume': 'home4.resumeAction',
  'rlle.ui.remediation.start': 'rlle.ui.repair.retry-now',
  'rlle.ui.remediation.ready': 'state.success',
  'rlle.ui.training.format.recognition-mcq': 'examiner.t.mcq',
  'rlle.ui.training.format.contextual-discrimination': 'rlle.ui.stage.comprehension',
  'rlle.ui.training.format.fill-blank-no-hint': 'rlle.ui.stage.practice',
  'rlle.ui.training.format.sentence-reconstruction': 'rlle.ui.dimension.writing',
  'rlle.ui.training.format.register-matching': 'rlle.ui.stage.comprehension',
  'rlle.ui.training.format.error-correction': 'daily.p.correction',
  'rlle.ui.training.format.listening-discrimination': 'rlle.ui.dimension.listening',
  'rlle.ui.training.format.guided-writing': 'rlle.ui.dimension.writing',
  'rlle.ui.training.format.voice-pronunciation': 'rlle.ui.dimension.pronunciation',
  'rlle.ui.training.format.mini-dialogue': 'rlle.ui.dimension.conversation',
  'rlle.ui.training.tokenBank': 'rlle.ui.strand.vocabulary',
  'rlle.ui.training.voice': 'learn5.modality.speak',
  'rlle.ui.training.answer': 'examiner.yourAnswer',
  'rlle.ui.capabilities.title': 'languages11.practice.oral',
  'rlle.ui.capabilities.detail': 'languages11.oral.detail',
  'rlle.ui.capabilities.audioCapture': 'learn5.modality.speak',
  'rlle.ui.capabilities.transcription': 'voice11.state.transcription',
  'rlle.ui.capabilities.spokenContent': 'languages11.practice.oral',
  'rlle.ui.capabilities.listening': 'rlle.ui.dimension.listening',
  'rlle.ui.capabilities.graphy': 'rlle.ui.dimension.writing',
  'rlle.ui.capabilities.pronunciation': 'rlle.ui.dimension.pronunciation',
  'rlle.ui.capabilities.available': 'state.success',
  'rlle.ui.capabilities.runtimeRequired': 'voice11.state.ready',
  'rlle.ui.capabilities.notEvaluable': 'rlle.ui.dimension.status.not-evaluated',
  'rlle.ui.capabilities.providerReady': 'state.success',
  'rlle.ui.capabilities.blocked': 'state.partial',
  'rlle.ui.capabilities.blockedDetail': 'rlle.ui.course.notEvaluated',
  'rlle.ui.capabilities.checkMicrophone': 'learn.oral.record',
  'rlle.ui.capabilities.strictDisabled': 'rlle.ui.course.notEvaluated',
};

for (const code of languageMasteryLocaleCodes) {
  extendLocaleAliases(code, languageMasteryAliases);
}
