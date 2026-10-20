import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { LanguageLearningCoreView, LanguageLearningLessonView, LanguageLearningState } from '@second-brain/shared';
import { resolveLanguageExercisePresentation } from '@second-brain/shared';
import { useRouter } from 'expo-router';
import { useTokens } from '../../lib/design/theme';
import { useRlleCopy } from '../../lib/language-rll-i18n';
import { useLanguageLearningCopy } from '../../lib/language-learning-copy';
import { LANGUAGE_PRODUCT_LEVEL_COPY } from '../../lib/language-placement-presentation';
import { languageCoreCourseHref, selectLanguageCoreLesson } from '../../lib/language-learning-core-presentation';
import { languageCourseOpeningError } from '../../lib/language-course-opening';
import {
  askLanguageLearningHelp, loadLanguageLearningCore, saveLanguageLearningAnswers, saveLanguageLearningAssessmentAnswers,
  startLanguageLearningAssessment, startLanguageLearningLesson, startLanguageLearningRemediation,
  startNextLanguageLearningLevel, submitLanguageLearningAssessment, submitLanguageLearningLesson,
  type LanguageLearningSessionView,
} from '../../lib/language-learning-core-client';
import { Alert, Badge, Button, Card, Progress } from '../ds/core';
import { SmartErrorState, SmartLoadingState } from '../ds/states';
import { Markdown } from '../markdown';
import { SpeakButton } from '../speak-button';

export const LEARNING_CORE_STATUS_COPY: Record<LanguageLearningState, string> = {
  LOCKED: 'rlle.ui.course.status.locked', AVAILABLE: 'rlle.ui.course.status.available',
  IN_PROGRESS: 'rlle.ui.course.status.in-progress', NEEDS_REMEDIATION: 'rlle.ui.autonomy.verdict.not-mastered',
  MASTERED: 'rlle.ui.bulletin.status.mastered', NOT_EVALUABLE: 'rlle.ui.bulletin.status.notEvaluable',
};
export function learningCoreScore(value: number | null): string {
  return value == null ? '—' : `${Number((value * 100).toFixed(2))}%`;
}
/** Display only: persisted evidence labels and grading remain untouched. */
const weakConceptLabels = (labels: readonly string[], supportLanguageCode?: string, targetLanguageCode?: string): string =>
  labels.map((label) => {
    if (!supportLanguageCode) return label;
    const presentation = resolveLanguageExercisePresentation({ question: label }, supportLanguageCode, targetLanguageCode);
    return presentation.normalized ? presentation.prompt : label;
  }).join(' · ');
const operationKey = (profileId: string, targetId: string, action: string) =>
  `learning-core:${profileId}:${targetId}:${action}:${Date.now()}`;

/** One server-authoritative post-placement projection. Rendering the catalogue
 * never generates lessons, assessments, help or provider calls. */
export function LanguageLearningCore({ profileId, requestedModuleId, requestedLessonId }: { profileId: string; requestedModuleId?: string; requestedLessonId?: string }) {
  const { copy } = useRlleCopy();
  const router = useRouter();
  const { colors: c, spacing, typography } = useTokens();
  const [session, setSession] = useState<LanguageLearningSessionView | null>(null);
  const teaching = useLanguageLearningCopy(session?.supportLanguageCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const requestKeys = useRef(new Map<string, string>());
  const loadRevision = useRef(0);
  const load = useCallback(async () => {
    const revision = ++loadRevision.current;
    setError(null);
    try { const result = await loadLanguageLearningCore(profileId); if (revision === loadRevision.current) setSession(result); }
    catch (cause) { if (revision === loadRevision.current) setError(languageCourseOpeningError(cause, 'LEARNING_CORE', copy)); }
  }, [profileId, copy]);
  useEffect(() => { setSession(null); requestKeys.current.clear(); void load(); return () => { loadRevision.current += 1; }; }, [load]);
  const run = async (action: string, targetId: string, fn: (key: string) => Promise<LanguageLearningSessionView>) => {
    if (busy) return;
    setBusy(`${action}:${targetId}`); setError(null);
    const requestId = `${action}:${targetId}:${session?.latestSubmission?.id ?? 'initial'}`;
    const key = requestKeys.current.get(requestId) ?? operationKey(profileId, targetId, action);
    requestKeys.current.set(requestId, key);
    try {
      const result = await fn(key);
      setSession(result);
      // Keep the deep link aligned with an explicit action; changing a target
      // must never display another lesson's restored content under its title.
      if (['start', 'remediation'].includes(action) && result.activeScope === 'lesson' && result.activeTargetId) router.replace(languageCoreCourseHref(profileId, result.core, result.activeTargetId) as never);
      else if (['assessment', 'next-level'].includes(action)) router.replace(`/languages/${encodeURIComponent(profileId)}/course` as never);
    }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(null); }
  };
  if (!session) return error
    ? <SmartErrorState detail={error} retryable onRetry={() => void load()} />
    : <SmartLoadingState title={copy('rlle.ui.course.loading')} />;
  const { core } = session;
  const actionCopy = (key: string, values?: Record<string, string | number>) => teaching.ready ? teaching.copy(key, values) : copy('error.detail');
  const restoringAssessment = (session.activeScope === 'module' || session.activeScope === 'level') && Boolean(session.assessment) && !requestedModuleId && !requestedLessonId;
  const selection = restoringAssessment ? { kind: 'none' as const } : selectLanguageCoreLesson(core, requestedModuleId, requestedLessonId);
  if (selection.kind === 'invalid') return <View style={{ gap: spacing.sm }} testID="language-core-invalid-selection"><SmartErrorState detail={`${copy(selection.code === 'COURSE_LESSON_LOCKED' ? 'rlle.ui.course.status.locked' : 'error.notFound')}\n${selection.code}`} /><Button label={copy('rlle.ui.common.backCourse')} onPress={() => router.replace(`/languages/${encodeURIComponent(profileId)}/course` as never)} /></View>;
  const selectedLesson = selection.kind === 'selected' ? selection.lesson : undefined;
  const activeContentMatches = session.activeScope === 'lesson'
    ? selectedLesson?.id === session.activeTargetId
    : !requestedModuleId && !requestedLessonId;
  const hasSelectedContent = activeContentMatches && Boolean(session.content || session.assessment);
  const openLesson = (lessonId: string) => router.replace(languageCoreCourseHref(profileId, core, lessonId) as never);
  const activeLesson = core.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === session.activeTargetId);
  const currentModule = expandedModule ?? (selection.kind === 'selected' ? selection.module.id : core.currentModuleId) ?? core.modules[0]?.id;
  const completed = core.modules.reduce((total, module) => total + module.masteredLessons, 0);
  const total = core.modules.reduce((count, module) => count + module.totalLessons, 0);
  return (
    <View style={{ gap: spacing.lg }} testID="language-learning-core">
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
          <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{copy('rlle.ui.course.curriculum')}</Text>
          <Badge label={copy(LANGUAGE_PRODUCT_LEVEL_COPY[core.productLevel])} tone="info" />
          <Badge label={core.cefrLevel} />
          <Badge label={copy(LEARNING_CORE_STATUS_COPY[core.levelStatus])} tone={core.levelStatus === 'MASTERED' ? 'success' : 'neutral'} />
        </View>
        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('rlle.ui.course.progressUnits', { done: completed, total })}</Text>
        {total > 0 ? <Progress value={completed / total * 100} /> : null}
        {core.curriculumStatus !== 'COMPLETE' ? <Alert tone="warning" title={copy('state.partial')} detail={copy('rlle.ui.course.notEvaluated')} /> : null}
        <Text style={[typography.caption, { color: c.textMuted }]}>{copy('rlle.ui.capabilities.strictDisabled')}</Text>
        {core.nextAction.lessonId && ['start-lesson', 'resume-lesson', 'remediate-lesson'].includes(core.nextAction.kind) ? (
          <Button
            testID="language-core-next-action"
            label={teaching.ready ? teaching.copy(core.nextAction.kind === 'remediate-lesson' ? 'rlle.ui.remediation.start' : core.nextAction.kind === 'resume-lesson' ? 'rlle.ui.course.resume' : 'rlle.ui.nba.nextLessonAction') : copy('error.detail')}
            variant="ai"
            disabled={busy !== null || !teaching.ready}
            onPress={() => openLesson(core.nextAction.lessonId!)}
          />
        ) : null}
      </Card>
      {error ? <SmartErrorState detail={error} /> : null}
      {selection.kind === 'selected' ? (
        <Card style={{ gap: spacing.md }} testID="language-core-lesson-preview">
          <Text style={[typography.label, { color: c.textMuted }]}>{copy(`learningCore.module.${String(selection.module.order).padStart(2, '0')}`)}</Text>
          <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{selection.lesson.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Badge label={copy(LANGUAGE_PRODUCT_LEVEL_COPY[core.productLevel])} tone="info" /><Badge label={core.cefrLevel} />
            <Badge label={copy(LEARNING_CORE_STATUS_COPY[selection.lesson.status])} />
          </View>
          <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('rlle.ui.course.title', { language: session.targetLanguage ?? core.languageCode })}</Text>
          {session.supportLanguage ? <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('passport.teachingLanguage')} · {session.supportLanguage}</Text> : null}
          {!hasSelectedContent ? <>
            <View style={{ gap: spacing.xs }} testID="language-core-preview-objective"><Text style={[typography.label, { color: c.textPrimary }]}>{copy('lesson.objectiveLabel')}</Text><Text style={[typography.body, { color: c.textSecondary }]}>{selection.lesson.objective}</Text></View>
            <View style={{ gap: spacing.sm }} testID="language-core-content-pending"><Text style={[typography.label, { color: c.textPrimary }]}>{copy('lesson.concept')}</Text><Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('rlle.ui.lesson.noActive')}</Text></View>
            <Button testID="language-core-preview-help" label={copy('learningCore.help')} variant="ghost" disabled accessibilityExpanded={false} />
            <Button testID="language-core-preview-start" label={teaching.ready ? teaching.copy(selection.lesson.status === 'NEEDS_REMEDIATION' ? 'rlle.ui.remediation.start' : 'rlle.ui.lesson.start') : copy('error.detail')} variant="ai" loading={busy !== null} disabled={busy !== null || !teaching.ready} onPress={() => {
              const remediate = selection.lesson.status === 'NEEDS_REMEDIATION';
              void run(remediate ? 'remediation' : 'start', selection.lesson.id, (key) => remediate ? startLanguageLearningRemediation(profileId, selection.lesson.id, key) : startLanguageLearningLesson(profileId, selection.lesson.id, key));
            }} />
          </> : null}
        </Card>
      ) : null}
      {core.levelStatus === 'NEEDS_REMEDIATION' ? (
        <Card style={{ gap: spacing.sm }} testID="language-core-level-remediation">
          <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{copy('learningCore.levelAssessment')}</Text>
          <Badge label={copy(LEARNING_CORE_STATUS_COPY[core.levelStatus])} tone="warning" />
          {(core.levelWeakLessonIds ?? []).map((id) => core.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === id))
            .filter((lesson): lesson is LanguageLearningLessonView => Boolean(lesson))
            .map((lesson) => <Button key={lesson.id} testID={`language-core-level-remediation-${lesson.id}`} label={`${actionCopy('rlle.ui.remediation.start')} · ${lesson.title}`} variant="ai" disabled={busy !== null || !teaching.ready} onPress={() => void run('remediation', lesson.id, (key) => startLanguageLearningRemediation(profileId, lesson.id, key))} />)}
        </Card>
      ) : null}
      {hasSelectedContent ? (
        <LearningLesson key={`${session.sessionId}:${session.assessment?.id ?? session.content?.id}`} profileId={profileId} session={session} lesson={activeLesson} busy={busy !== null} onSession={setSession} onError={setError} run={run} />
      ) : null}
      <View style={{ gap: spacing.sm }} testID="language-core-modules">
        {core.modules.map((module) => {
          const expanded = module.id === currentModule;
          return (
            <Card key={module.id} style={{ gap: spacing.sm }} testID={`language-core-module-${module.id}`}>
              <Button variant="secondary" fullWidth accessibilityExpanded={expanded} label={`${String(module.order).padStart(2, '0')} — ${copy(`learningCore.module.${String(module.order).padStart(2, '0')}`)}`} onPress={() => setExpandedModule(expanded ? '' : module.id)} />
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Badge label={copy(LEARNING_CORE_STATUS_COPY[module.status])} tone={module.status === 'MASTERED' ? 'success' : module.status === 'NEEDS_REMEDIATION' ? 'warning' : 'neutral'} />
                <Text style={[typography.caption, { color: c.textSecondary }]}>{module.masteredLessons}/{module.totalLessons} · {learningCoreScore(module.score)}</Text>
                {module.bestScore != null ? <Text style={[typography.caption, { color: c.textMuted }]}>{copy('learningCore.bestScore')} · {learningCoreScore(module.bestScore)}</Text> : null}
              </View>
              {expanded ? (
                <View style={{ gap: spacing.sm }}>
                  {module.lessons.map((lesson) => (
                    <View key={lesson.id} style={{ borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: spacing.sm, gap: spacing.xs }}>
                      <Text style={[typography.body, { color: c.textPrimary }]}>{lesson.order}. {lesson.title}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <Badge label={copy(LEARNING_CORE_STATUS_COPY[lesson.status])} tone={lesson.status === 'MASTERED' ? 'success' : lesson.status === 'NEEDS_REMEDIATION' ? 'warning' : 'neutral'} />
                        {lesson.score != null ? <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{learningCoreScore(lesson.score)}</Text> : null}
                        {lesson.bestScore != null ? <Text style={[typography.caption, { color: c.textMuted }]}>{copy('learningCore.bestScore')} · {learningCoreScore(lesson.bestScore)}</Text> : null}
                      </View>
                      {lesson.weakConcepts.length ? <Text testID={`language-core-weak-concepts-${lesson.id}`} style={[typography.caption, { color: c.textSecondary, writingDirection: teaching.direction, textAlign: teaching.direction === 'rtl' ? 'right' : 'left' }]}>{weakConceptLabels(lesson.weakConcepts, session.supportLanguageCode, core.languageCode)}</Text> : null}
                      {lesson.status !== 'LOCKED' ? <Button size="sm" variant={lesson.status === 'NEEDS_REMEDIATION' ? 'ai' : 'ghost'} disabled={busy !== null || !teaching.ready} label={actionCopy(lesson.status === 'NEEDS_REMEDIATION' ? 'rlle.ui.remediation.start' : lesson.status === 'AVAILABLE' ? 'rlle.ui.lesson.start' : 'rlle.ui.lesson.resume')} onPress={() => openLesson(lesson.id)} /> : null}
                      {lesson.status === 'MASTERED' && module.status === 'NEEDS_REMEDIATION' && module.weakLessonIds.includes(lesson.id) ? <Button label={actionCopy('rlle.ui.remediation.start')} variant="ai" disabled={busy !== null || !teaching.ready} onPress={() => void run('remediation', lesson.id, (key) => startLanguageLearningRemediation(profileId, lesson.id, key))} /> : null}
                    </View>
                  ))}
                  {module.kind === 'transversal' ? <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('rlle.ui.course.review')} · {copy('rlle.ui.training.format.recognition-mcq')} · {copy('rlle.ui.remediation.start')} · {copy('learningCore.moduleAssessment')}</Text> : null}
                  {module.status === 'NEEDS_REMEDIATION' ? module.weakLessonIds
                    .filter((id) => !module.lessons.some((lesson) => lesson.id === id))
                    .map((id) => core.modules.flatMap((entry) => entry.lessons).find((lesson) => lesson.id === id))
                    .filter((lesson): lesson is LanguageLearningLessonView => Boolean(lesson))
                    .map((lesson) => <Button key={lesson.id} label={`${actionCopy('rlle.ui.remediation.start')} · ${lesson.title}`} variant="ai" disabled={busy !== null || !teaching.ready} onPress={() => void run('remediation', lesson.id, (key) => startLanguageLearningRemediation(profileId, lesson.id, key))} />) : null}
                  {module.assessmentBlockedReason === 'acoustic-unavailable' ? <Alert tone="warning" title={copy('rlle.ui.capabilities.notEvaluable')} detail={copy('rlle.ui.capabilities.blockedDetail')} /> : null}
                  {module.assessmentAvailable ? <Button label={actionCopy('learningCore.moduleAssessment')} disabled={busy !== null || !teaching.ready} onPress={() => void run('assessment', module.id, (key) => startLanguageLearningAssessment(profileId, 'module', module.id, key))} /> : null}
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
      {core.levelAssessmentAvailable ? <Button label={actionCopy('learningCore.levelAssessment')} disabled={busy !== null || !teaching.ready} onPress={() => void run('assessment', core.productLevel, (key) => startLanguageLearningAssessment(profileId, 'level', core.productLevel, key))} /> : null}
      {core.levelStatus === 'MASTERED' && core.nextProductLevel ? <Button label={`${actionCopy('onb.continue')} · ${actionCopy(LANGUAGE_PRODUCT_LEVEL_COPY[core.nextProductLevel])}`} disabled={busy !== null || !teaching.ready} onPress={() => void run('next-level', core.productLevel, (key) => startNextLanguageLearningLevel(profileId, key))} /> : null}
    </View>
  );
}

type RunAction = (action: string, targetId: string, fn: (key: string) => Promise<LanguageLearningSessionView>) => Promise<void>;
export function LearningLesson({ profileId, session, lesson, busy, onSession, onError, run }: {
  profileId: string; session: LanguageLearningSessionView; lesson?: LanguageLearningLessonView;
  busy: boolean; onSession: (session: LanguageLearningSessionView) => void; onError: (error: string | null) => void; run: RunAction;
}) {
  const { copy: interfaceCopy } = useRlleCopy();
  const { copy, ready, direction, targetDirection } = useLanguageLearningCopy(session.supportLanguageCode, session.core.languageCode);
  const { colors: c, spacing, typography } = useTokens();
  const [step, setStep] = useState(session.phase === 'assessment' ? 4 : session.teachingStep ?? 0);
  const [answers, setAnswers] = useState<string[]>(session.answers);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [flowBusy, setFlowBusy] = useState(false);
  const queue = useRef(Promise.resolve());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const latestAnswers = useRef(answers);
  const savedAnswers = useRef(JSON.stringify(session.answers));
  const targetId = session.activeTargetId;
  const autonomous = !session.latestSubmission && (step === 4 || session.activeScope !== 'lesson');
  const persistAnswers = async () => {
    if (!targetId || !dirty.current || session.latestSubmission) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    const snapshot = latestAnswers.current.slice();
    const work = queue.current.catch(() => undefined).then(async () => {
      if (session.activeScope === 'lesson') await saveLanguageLearningAnswers(profileId, targetId, snapshot);
      else await saveLanguageLearningAssessmentAnswers(profileId, targetId, snapshot);
    });
    queue.current = work;
    try {
      await work;
      savedAnswers.current = JSON.stringify(snapshot);
      setSaveStatus(savedAnswers.current === JSON.stringify(latestAnswers.current) ? 'saved' : 'saving');
    }
    catch (cause) { setSaveStatus('failed'); throw cause; }
  };
  useEffect(() => {
    if (!dirty.current || !targetId || session.latestSubmission) return;
    setSaveStatus('saving');
    saveTimer.current = setTimeout(() => { void persistAnswers().catch(() => undefined); }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [answers, profileId, targetId, session.activeScope, session.latestSubmission]);
  const enterAssessment = async () => {
    if (!targetId || flowBusy) return;
    setFlowBusy(true);
    try {
      onSession(await saveLanguageLearningAnswers(profileId, targetId, answers));
      setStep(4);
    } catch (cause) { onError((cause as Error).message); }
    finally { setFlowBusy(false); }
  };
  const changeTeachingStep = async (next: number) => {
    if (!targetId || flowBusy) return;
    setFlowBusy(true);
    try { onSession(await saveLanguageLearningAnswers(profileId, targetId, answers, 'teaching', next)); setStep(next); }
    catch (cause) { onError((cause as Error).message); }
    finally { setFlowBusy(false); }
  };
  const submit = async () => {
    if (!targetId || !session.activeScope) return;
    try { await persistAnswers(); }
    catch (cause) { onError((cause as Error).message); return; }
    dirty.current = false;
    const snapshot = answers.slice();
    await run('submit', targetId, (key) => session.activeScope === 'lesson'
      ? submitLanguageLearningLesson(profileId, targetId, snapshot, key)
      : submitLanguageLearningAssessment(profileId, targetId, snapshot, key));
    dirty.current = false;
  };
  const content = session.content;
  const labels = ['lesson.objectiveLabel', 'lesson.concept', 'lesson.examples', 'lesson.questions'];
  if (!ready) return <SmartErrorState detail={interfaceCopy('error.detail')} />;
  return (
    <Card style={{ gap: spacing.md, borderColor: c.aiAccent, direction }} testID="language-core-lesson">
      <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{content?.topic ?? session.assessment?.title ?? lesson?.title}</Text>
      {session.latestSubmission ? (
        <View style={{ gap: spacing.sm }} testID="language-core-result">
          {lesson ? <Badge label={copy(LEARNING_CORE_STATUS_COPY[lesson.status])} tone={lesson.status === 'MASTERED' ? 'success' : 'warning'} /> : null}
          <Text style={[typography.h2, { color: c.textPrimary }]}>{session.latestSubmission.score}%</Text>
          <Markdown text={session.latestSubmission.summary} />
          {session.latestSubmission.results.map((result) => <View key={result.questionId} style={{ gap: spacing.xs }}><Text style={[typography.body, { color: c.textPrimary }]}>{result.prompt}</Text><Text style={[typography.bodySmall, { color: c.textSecondary }]}>{result.learnerAnswer} · {result.awarded}/{result.max}</Text>{[result.errorMade, result.why, result.how, result.howToAvoid].filter(Boolean).map((text, index) => <Markdown key={index} text={text!} />)}</View>)}
          <Markdown text={session.latestSubmission.advice} />
          {lesson?.status === 'NEEDS_REMEDIATION' ? <Button label={copy('rlle.ui.remediation.start')} disabled={busy} onPress={() => void run('remediation', lesson.id, (key) => startLanguageLearningRemediation(profileId, lesson.id, key))} /> : null}
        </View>
      ) : autonomous ? (
        <View style={{ gap: spacing.md }} testID="language-core-autonomous">
          <Alert tone="info" title={copy('rlle.ui.autonomy.notice')} />
          {session.assessment?.questions.map((question, index) => <View key={question.id} style={{ gap: spacing.sm }}>
            <Text testID={`language-core-question-${question.id}`} style={[typography.body, { color: c.textPrimary, writingDirection: direction, textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{index + 1}. {question.instructionText ?? question.prompt}</Text>
            {question.instructionText && question.targetText ? <Text testID={`language-core-target-${question.id}`} style={[typography.body, { color: c.textPrimary, writingDirection: targetDirection, textAlign: targetDirection === 'rtl' ? 'right' : 'left' }]}>{question.targetText}</Text> : null}
            {question.options?.length ? question.options.map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: answers[index] === option, disabled: busy }} disabled={busy} onPress={() => { const next = [...answers]; next[index] = option; latestAnswers.current = next; dirty.current = true; setAnswers(next); }} style={{ minHeight: 44, justifyContent: 'center', padding: spacing.sm, borderWidth: 1, borderColor: answers[index] === option ? c.aiAccent : c.border, borderRadius: 8 }}><Text style={[typography.body, { color: c.textPrimary, writingDirection: targetDirection, textAlign: targetDirection === 'rtl' ? 'right' : 'left' }]}>{option}</Text></Pressable>) : <TextInput accessibilityLabel={copy('examiner.yourAnswer')} multiline editable={!busy} value={answers[index] ?? ''} onChangeText={(value) => { const next = [...answers]; next[index] = value; latestAnswers.current = next; dirty.current = true; setAnswers(next); }} style={{ color: c.textPrimary, backgroundColor: c.surfaceSunken, minHeight: 80, padding: spacing.sm, borderWidth: 1, borderColor: c.border, borderRadius: 8, writingDirection: targetDirection }} />}
          </View>)}
          <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: saveStatus === 'failed' ? c.error : c.textMuted }]}>{copy(saveStatus === 'saving' ? 'placement.ui.draftSaving' : saveStatus === 'failed' ? 'placement.ui.draftSaveFailed' : 'placement.ui.draftSaved')}</Text>
          {saveStatus === 'failed' ? <Button variant="secondary" label={copy('rlle.ui.common.retry')} onPress={() => void persistAnswers().catch((cause) => onError((cause as Error).message))} /> : null}
          <Button label={copy('lesson.submit')} loading={busy} disabled={!session.assessment?.questions.length || session.assessment.questions.some((_, index) => !answers[index]?.trim())} onPress={() => void submit()} />
        </View>
      ) : content ? (
        <View style={{ gap: spacing.md }} testID="language-core-teaching">
          <Badge label={copy(labels[step] ?? 'lesson.questions')} tone="ai" />
          {step === 0 ? <><Markdown text={content.objective} />{content.intro ? <Markdown text={content.intro} /> : null}</> : null}
          {step === 1 ? <><Markdown text={content.explanation} /><SpeakButton text={content.explanation} language={session.supportLanguage} label={copy('lesson.readAloud')} /></> : null}
          {step === 2 ? content.examples.map((example, index) => <Markdown key={index} text={example} />) : null}
          {step === 3 ? content.questions.map((question, index) => <Markdown key={index} text={question} />) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {step > 0 ? <Button variant="ghost" disabled={flowBusy} label={copy('app.back')} onPress={() => void changeTeachingStep(step - 1)} /> : null}
            <Button label={copy(step === 3 ? 'rlle.ui.autonomy.start' : 'onb.continue')} disabled={busy} loading={flowBusy} onPress={() => step < 3 ? void changeTeachingStep(step + 1) : void enterAssessment()} />
          </View>
        </View>
      ) : null}
      {!autonomous && lesson ? <LanguageLearningHelp key={lesson.id} profileId={profileId} lessonId={lesson.id} supportLanguageCode={session.supportLanguageCode} /> : null}
    </Card>
  );
}

/** Assistance-only endpoint. There are deliberately no score, completion,
 * unlock or progress callbacks in this component. It is not mounted in exams. */
export function LanguageLearningHelp({ profileId, lessonId, supportLanguageCode }: { profileId: string; lessonId: string; supportLanguageCode?: string }) {
  const { copy: interfaceCopy } = useRlleCopy();
  const { copy, ready, direction } = useLanguageLearningCopy(supportLanguageCode);
  const { colors: c, spacing, typography } = useTokens();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const send = async () => {
    if (!message.trim() || busy) return;
    setBusy(true); setError(null);
    key.current ??= operationKey(profileId, lessonId, 'help');
    try { setAnswer((await askLanguageLearningHelp(profileId, lessonId, message.trim(), key.current)).answer); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  if (!ready) return <SmartErrorState detail={interfaceCopy('error.detail')} />;
  return <View style={{ gap: spacing.sm, direction }} testID="language-core-help">
    <Button label={copy('learningCore.help')} variant="ghost" accessibilityExpanded={open} onPress={() => setOpen((value) => !value)} />
    {open ? <View style={{ gap: spacing.sm }}><TextInput accessibilityLabel={copy('learningCore.help')} multiline value={message} editable={!busy} onChangeText={(value) => { setMessage(value); key.current = null; }} style={{ minHeight: 80, color: c.textPrimary, backgroundColor: c.surfaceSunken, padding: spacing.sm, borderWidth: 1, borderColor: c.border, borderRadius: 8 }} /><Button label={copy('tutor.send')} loading={busy} disabled={!message.trim()} onPress={() => void send()} />{error ? <Text accessibilityRole="alert" style={[typography.bodySmall, { color: c.error }]}>{error}</Text> : null}{answer ? <Markdown text={answer} /> : null}</View> : null}
  </View>;
}

/** Lazy Passport detail uses the identical canonical projection; expanding one
 * language does not fan out requests for every language or generate a lesson. */
export function LanguageLearningPassportSummary({ profileId }: { profileId: string }) {
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [core, setCore] = useState<LanguageLearningCoreView | null>(null);
  const [supportLanguageCode, setSupportLanguageCode] = useState<string | undefined>();
  const teaching = useLanguageLearningCopy(supportLanguageCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const expand = async () => {
    setOpen((value) => !value);
    if (core || busy) return;
    setBusy(true); setError(null);
    try { const result = await loadLanguageLearningCore(profileId); setCore(result.core); setSupportLanguageCode(result.supportLanguageCode); }
    catch (cause) { setError(languageCourseOpeningError(cause, 'LEARNING_CORE', copy)); }
    finally { setBusy(false); }
  };
  const current = core?.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === core.currentLessonId);
  return <View style={{ gap: spacing.sm }} testID={`passport-learning-core-${profileId}`}>
    <Button variant="ghost" label={copy('rlle.ui.course.curriculum')} accessibilityExpanded={open} loading={busy} onPress={() => void expand()} />
    {open ? <View style={{ gap: spacing.sm }}>{error ? <SmartErrorState detail={error} /> : null}{core?.modules.map((module) => <View key={module.id} style={{ gap: spacing.xs }}><Text style={[typography.bodySmall, { color: c.textPrimary }]}>{String(module.order).padStart(2, '0')} · {copy(`learningCore.module.${String(module.order).padStart(2, '0')}`)}</Text><Text style={[typography.caption, { color: c.textSecondary }]}>{copy(LEARNING_CORE_STATUS_COPY[module.status])} · {module.masteredLessons}/{module.totalLessons} · {learningCoreScore(module.score)}</Text>{module.lessons.filter((lesson) => lesson.status !== 'LOCKED').map((lesson) => <Text key={lesson.id} style={[typography.caption, { color: c.textSecondary }]}>{lesson.title} · {copy(LEARNING_CORE_STATUS_COPY[lesson.status])} · {learningCoreScore(lesson.score)} · {learningCoreScore(lesson.bestScore)}{lesson.weakConcepts.length ? <Text testID={`passport-core-weak-concepts-${lesson.id}`} style={{ writingDirection: teaching.direction, textAlign: teaching.direction === 'rtl' ? 'right' : 'left' }}>{` · ${weakConceptLabels(lesson.weakConcepts, supportLanguageCode, core.languageCode)}`}</Text> : null}</Text>)}</View>)}{current ? <Text style={[typography.body, { color: c.textPrimary }]}>{copy('rlle.ui.lesson.title')} · {current.title}</Text> : null}<Button label={copy('rlle.ui.course.resume')} onPress={() => router.push(languageCoreCourseHref(profileId, core) as never)} /></View> : null}
  </View>;
}
