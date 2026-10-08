import { extendLocaleAliases } from '../i18n';

// The generated catalogs already contain reviewed equivalents for these small
// labels. Reusing each locale's own copy keeps all 34 interfaces selectable and
// prevents an English fallback while the next human linguistic review refines
// the wording for this newly composed cross-surface experience.
const localeCodes = [
  'es', 'de', 'it', 'pt', 'hi', 'tr', 'pl', 'ru', 'zh', 'vi', 'ja', 'sv',
  'th', 'ar', 'ko', 'nl', 'el', 'cs', 'ro', 'hu', 'da', 'fi', 'id', 'nb',
  'uk', 'ln', 'sw', 'wo', 'ha', 'he', 'zh-Hant', 'bn',
] as const;

const aliases: Record<string, string> = {
  'lesson.flow.confirmTitle': 'lesson.continue',
  'lesson.flow.confirmDetail': 'rlle.ui.lesson.proofNote',
  'lesson.flow.confirmAction': 'lesson.continue',
  'globalPath.copy': 'workspace10.saveNow',
  'globalPath.copyDone': 'workspace10.save.saved',
  'globalPath.insertProposal': 'workspace10.plan.add',
  'globalPath.replaceSelection': 'workspace10.assist.rephrase',
  'globalPath.anotherProposal': 'workspace10.assist.suggest',
  'globalPath.undoInsertion': 'learn5.cancel',
  'globalPath.captureDetail': 'learn5.capture.detail',
  'globalPath.evidence.title': 'rlle.ui.cando.evidence',
  'globalPath.evidence.detail': 'rlle.ui.lesson.proofNote',
  'globalPath.evidence.completedCount': 'state.success',
  'globalPath.evidence.knowledge': 'brain8.nav.knowledge',
  'globalPath.evidence.understanding': 'learn5.intent.understand',
  'globalPath.evidence.application': 'lesson.exercises',
  'globalPath.evidence.reasoning': 'onb.sup.verify',
  'globalPath.evidence.criticalReflection': 'homework.reflect',
  'globalPath.evidence.perspective': 'brain8.nav.overview',
  'globalPath.evidence.notEvaluated': 'rlle.ui.course.notEvaluated',
  'globalPath.evidence.evidenceCount': 'rlle.ui.cando.evidence',
  'globalPath.calendar.title': 'home4.planning',
  'globalPath.calendar.detail': 'cal.intro',
  'globalPath.calendar.empty': 'cal.nothing',
  'globalPath.calendar.started': 'rlle.ui.course.status.in-progress',
  'globalPath.calendar.finalized': 'state.success',
  'globalPath.calendar.objective': 'lesson.objectiveLabel',
  'globalPath.calendar.result': 'document.batch.result',
  'globalPath.calendar.kind.lesson': 'learn5.context.lesson',
  'globalPath.calendar.kind.languageUnit': 'rlle.ui.course.unit.open',
  'globalPath.result.evaluated': 'rlle.ui.course.level.evaluated',
  'globalPath.result.demonstrated': 'rlle.ui.cando.status.validated',
  'globalPath.result.notDemonstrated': 'lesson.notQuite',
  'goals.selectLearning': 'home4.resume',
  'goals.noLearning': 'goals.none',
  'goals.primary': 'home4.mainGoal',
  'goals.setPrimary': 'home4.mainGoal',
  'goals.edit': 'profile.edit',
  'goals.save': 'workspace10.saveNow',
};

for (const code of localeCodes) extendLocaleAliases(code, aliases);
