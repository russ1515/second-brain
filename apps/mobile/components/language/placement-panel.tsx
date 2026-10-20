import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  LANGUAGE_PLACEMENT_SELF_ESTIMATES,
  type LanguagePlacementSelfEstimate,
  type LanguagePlacementView,
} from '@second-brain/shared';
import { Alert, Badge, Button, Card, Input } from '../ds/core';
import { SmartErrorState, SmartLoadingState } from '../ds/states';
import { Markdown } from '../markdown';
import { useTokens } from '../../lib/design/theme';
import { useRlleCopy } from '../../lib/language-rll-i18n';
import { LANGUAGE_PRODUCT_LEVEL_COPY, languagePlacementErrorDetail } from '../../lib/language-placement-presentation';
import {
  loadLanguagePlacement,
  saveLanguagePlacementProgress,
  startLanguagePlacement,
  submitLanguagePlacement,
} from '../../lib/language-placement-client';

/** Placement is separate from mastery. No score, completion or unlock is
 * calculated here, and moving to another round never calls the provider until
 * the learner explicitly chooses Continue. Existing courses do not mount it. */
export function LanguagePlacementPanel({ profileId, onPlacement }: {
  profileId: string;
  onPlacement: (placement: LanguagePlacementView) => void;
}) {
  const { colors: c, spacing, typography } = useTokens();
  const { copy } = useRlleCopy();
  const [placement, setPlacement] = useState<LanguagePlacementView | null>(null);
  const [estimate, setEstimate] = useState<LanguagePlacementSelfEstimate | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const inFlight = useRef(false);
  const answersRef = useRef<string[]>([]);
  const questionIndexRef = useRef(0);
  const progressVersion = useRef(0);
  const editVersion = useRef(0);
  const pendingProgress = useRef<{ assessmentId: string; answers: string[]; currentQuestionIndex: number; editVersion: number } | null>(null);
  const saveInFlight = useRef<Promise<boolean> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPlacementRef = useRef(onPlacement);
  onPlacementRef.current = onPlacement;
  const canRetrySubmission = placement?.progress?.source === 'submission'
    && placement.progress.submissionStatus === 'failed';

  const accept = useCallback((next: LanguagePlacementView) => {
    setPlacement(next);
    setEstimate(next.selfEstimate);
    const progress = next.progress?.assessmentId === next.assessment?.id ? next.progress : null;
    const restored = next.assessment?.questions.map((_, index) => progress?.answers[index] ?? '') ?? [];
    answersRef.current = restored;
    questionIndexRef.current = progress?.currentQuestionIndex ?? 0;
    progressVersion.current = progress?.version ?? 0;
    setAnswers(restored);
    setCurrentQuestionIndex(questionIndexRef.current);
    setSaveState('saved');
    onPlacementRef.current(next);
  }, []);

  // At most one non-billable write is in flight. New edits replace the queued
  // snapshot; an older response can never overwrite newer text or its cursor.
  const flushProgress = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (saveInFlight.current) return saveInFlight.current;
    if (!pendingProgress.current) return true;
    const generation = requestGeneration.current;
    const saving = (async () => {
      while (pendingProgress.current && generation === requestGeneration.current) {
        const snapshot = pendingProgress.current;
        pendingProgress.current = null;
        try {
          const next = await saveLanguagePlacementProgress(profileId, {
            assessmentId: snapshot.assessmentId,
            answers: snapshot.answers,
            currentQuestionIndex: snapshot.currentQuestionIndex,
            expectedVersion: progressVersion.current,
          });
          if (generation !== requestGeneration.current) return false;
          progressVersion.current = next.progress?.version ?? progressVersion.current;
          if (!pendingProgress.current && snapshot.editVersion === editVersion.current) {
            setPlacement(next);
            setSaveState('saved');
            onPlacementRef.current(next);
          }
        } catch (cause) {
          if (generation === requestGeneration.current) {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = null;
            pendingProgress.current ??= snapshot;
            setSaveState('failed');
            setError(languagePlacementErrorDetail(cause));
          }
          return false; // No automatic retry, and no paid submission after this.
        }
      }
      return generation === requestGeneration.current;
    })();
    saveInFlight.current = saving;
    try { return await saving; }
    finally { if (generation === requestGeneration.current) saveInFlight.current = null; }
  }, [profileId]);

  const queueProgress = (index: number, nextAnswers = answersRef.current) => {
    if (!placement?.assessment || placement.progress?.source === 'submission' || inFlight.current) return;
    answersRef.current = nextAnswers;
    questionIndexRef.current = index;
    setAnswers(nextAnswers);
    setCurrentQuestionIndex(index);
    pendingProgress.current = {
      assessmentId: placement.assessment.id, answers: [...nextAnswers], currentQuestionIndex: index,
      editVersion: ++editVersion.current,
    };
    setSaveState('saving');
    setError(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flushProgress(); }, 250);
  };

  const updateAnswer = (index: number, answer: string) => {
    const next = answersRef.current.map((value, answerIndex) => answerIndex === index ? answer : value);
    queueProgress(index, next);
  };

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setError(null);
    try {
      const next = await loadLanguagePlacement(profileId);
      if (generation === requestGeneration.current) accept(next);
    } catch (cause) {
      if (generation === requestGeneration.current) setError(languagePlacementErrorDetail(cause));
    }
  }, [accept, profileId]);

  useEffect(() => {
    setPlacement(null);
    setEstimate(null);
    setAnswers([]);
    answersRef.current = [];
    questionIndexRef.current = 0;
    progressVersion.current = 0;
    pendingProgress.current = null;
    saveInFlight.current = null;
    setCurrentQuestionIndex(0);
    setSaveState('saved');
    setBusy(false);
    inFlight.current = false;
    void load();
    return () => {
      ++requestGeneration.current;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
    };
  }, [load]);

  const start = async () => {
    const selfEstimate = placement?.selfEstimate ?? estimate;
    if (!placement || !selfEstimate || inFlight.current) return;
    const generation = requestGeneration.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await startLanguagePlacement(profileId, {
        selfEstimate,
        idempotencyKey: `mobile-placement:${profileId}:${placement.round}:${selfEstimate}`,
      });
      if (generation === requestGeneration.current) accept(next);
    } catch (cause) {
      if (generation === requestGeneration.current) setError(languagePlacementErrorDetail(cause));
    } finally {
      if (generation === requestGeneration.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };

  const submit = async () => {
    if (!placement?.assessment || inFlight.current
      || (placement.progress?.source === 'submission' && !canRetrySubmission)) return;
    const generation = requestGeneration.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!await flushProgress() || generation !== requestGeneration.current) return;
      const next = await submitLanguagePlacement(profileId, {
        assessmentId: placement.assessment.id,
        answers: [...answersRef.current],
        idempotencyKey: `mobile-placement:${placement.assessment.id}`,
      });
      if (generation === requestGeneration.current) accept(next);
    } catch (cause) {
      // Keep the learner's answers on transport/provider errors. A retry is an
      // explicit user action with the same operation key, never a hidden loop.
      if (generation === requestGeneration.current) setError(languagePlacementErrorDetail(cause));
    } finally {
      if (generation === requestGeneration.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };

  if (!placement) {
    return error
      ? <SmartErrorState detail={error} retryable onRetry={() => void load()} />
      : <SmartLoadingState title={copy('placement.ui.title')} />;
  }

  return (
    <Card elevated style={{ gap: spacing.md, borderColor: c.aiAccent }} testID="language-placement">
      <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{copy('placement.ui.title')}</Text>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('placement.ui.detail')}</Text>
      <Alert tone="info" title={copy('placement.ui.oralUnavailable')} />
      {error ? <SmartErrorState detail={error} /> : null}

      {placement.status === 'required' ? (
        <View style={{ gap: spacing.sm }} testID="language-placement-estimate">
          <Text style={[typography.label, { color: c.textPrimary }]}>{copy('placement.ui.selfQuestion')}</Text>
          {LANGUAGE_PLACEMENT_SELF_ESTIMATES.map((value) => (
            <Button
              key={value}
              testID={`language-placement-estimate-${value}`}
              label={copy(`placement.ui.self.${value}`)}
              variant={estimate === value ? 'primary' : 'secondary'}
              disabled={busy}
              onPress={() => setEstimate(value)}
            />
          ))}
          <Button testID="language-placement-start" label={copy('placement.ui.start')} variant="ai" loading={busy} disabled={!estimate} onPress={() => void start()} />
        </View>
      ) : null}

      {placement.status === 'active' ? (
        <View style={{ gap: spacing.md }} testID="language-placement-active">
          <Badge label={copy('placement.ui.round', { round: placement.round })} tone="info" />
          {placement.assessment ? (
            <>
              <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: c.textSecondary }]} testID="language-placement-save-state">
                {copy(`placement.ui.${saveState === 'saved' ? 'draftSaved' : saveState === 'saving' ? 'draftSaving' : 'draftSaveFailed'}`)}
              </Text>
              <Text style={[typography.caption, { color: c.textMuted }]} testID="language-placement-current-question">
                {copy('placement.ui.resume', { number: currentQuestionIndex + 1 })}
              </Text>
              {saveState === 'failed' ? <Button testID="language-placement-save-retry" label={copy('rlle.ui.common.retry')} variant="secondary" onPress={() => void flushProgress()} /> : null}
              {placement.assessment.questions.map((question, index) => (
                <View key={question.id} style={{ gap: spacing.sm }} testID={`language-placement-question-${index}`}>
                  <Markdown text={question.prompt} />
                  {question.format === 'mcq' && question.options ? (
                    <View style={{ gap: spacing.xs }}>
                      {question.options.map((option, optionIndex) => (
                        <Button
                          key={optionIndex}
                          label={option}
                          testID={`language-placement-option-${index}-${optionIndex}`}
                          variant={answers[index] === option ? 'primary' : 'secondary'}
                          disabled={busy || placement.progress?.source === 'submission'}
                          onPress={() => updateAnswer(index, option)}
                        />
                      ))}
                    </View>
                  ) : (
                    <Input
                      label={copy('lesson.yourAnswer')}
                      testID={`language-placement-answer-${index}`}
                      value={answers[index] ?? ''}
                      onChangeText={(answer) => updateAnswer(index, answer)}
                      onFocus={() => { if (questionIndexRef.current !== index) queueProgress(index); }}
                      onBlur={() => { void flushProgress(); }}
                      autoFocus={index === currentQuestionIndex}
                      multiline
                      editable={!busy && placement.progress?.source !== 'submission'}
                      maxLength={4000}
                    />
                  )}
                </View>
              ))}
              <Button testID="language-placement-submit" label={copy(canRetrySubmission ? 'rlle.ui.common.retry' : 'examiner.submit')} variant="ai" loading={busy} disabled={placement.progress?.source === 'submission' && !canRetrySubmission} onPress={() => void submit()} />
            </>
          ) : (
            <Button testID="language-placement-next-round" label={copy('lesson.continue')} variant="ai" loading={busy} onPress={() => void start()} />
          )}
        </View>
      ) : null}

      {placement.status === 'not_evaluable' ? <Alert tone="warning" title={copy('placement.ui.notEvaluable')} /> : null}
      {placement.status === 'complete' && placement.productLevel && placement.globalLevel ? (
        <View style={{ gap: spacing.sm }} testID="language-placement-result">
          <Text style={[typography.h3, { color: c.textPrimary }]}>
            {copy('placement.ui.result', { level: copy(LANGUAGE_PRODUCT_LEVEL_COPY[placement.productLevel]) })}
          </Text>
          <Badge label={placement.globalLevel} tone="info" />
          {([1, 2, 3] as const).map((round) => {
            const observations = placement.skills.filter((skill) => skill.round === round);
            if (observations.length === 0) return null;
            return (
              <View key={round} style={{ gap: spacing.sm }} testID={`language-placement-evidence-round-${round}`}>
                <Badge label={copy('placement.ui.round', { round })} tone="neutral" />
                {observations.map((skill) => (
                  <View key={skill.skill} style={{ gap: spacing.xs }}>
                    <Text style={[typography.label, { color: c.textPrimary }]}>
                      {copy(`rlle.ui.dimension.${skill.skill}`)} · {skill.level ?? copy('rlle.ui.course.notEvaluated')}
                    </Text>
                    <Text style={[typography.caption, { color: c.textSecondary }]}>{skill.reason}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}
