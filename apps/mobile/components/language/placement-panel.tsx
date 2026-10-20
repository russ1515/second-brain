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
import { LANGUAGE_PRODUCT_LEVEL_COPY } from '../../lib/language-placement-presentation';
import {
  loadLanguagePlacement,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const inFlight = useRef(false);
  const onPlacementRef = useRef(onPlacement);
  onPlacementRef.current = onPlacement;

  const accept = useCallback((next: LanguagePlacementView) => {
    setPlacement(next);
    setEstimate(next.selfEstimate);
    setAnswers(next.assessment?.questions.map(() => '') ?? []);
    onPlacementRef.current(next);
  }, []);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setError(null);
    try {
      const next = await loadLanguagePlacement(profileId);
      if (generation === requestGeneration.current) accept(next);
    } catch (cause) {
      if (generation === requestGeneration.current) setError((cause as Error).message);
    }
  }, [accept, profileId]);

  useEffect(() => {
    setPlacement(null);
    setEstimate(null);
    setAnswers([]);
    setBusy(false);
    inFlight.current = false;
    void load();
    return () => { ++requestGeneration.current; };
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
      if (generation === requestGeneration.current) setError((cause as Error).message);
    } finally {
      if (generation === requestGeneration.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };

  const submit = async () => {
    if (!placement?.assessment || inFlight.current) return;
    const generation = requestGeneration.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await submitLanguagePlacement(profileId, {
        assessmentId: placement.assessment.id,
        answers,
        idempotencyKey: `mobile-placement:${placement.assessment.id}`,
      });
      if (generation === requestGeneration.current) accept(next);
    } catch (cause) {
      // Keep the learner's answers on transport/provider errors. A retry is an
      // explicit user action with the same operation key, never a hidden loop.
      if (generation === requestGeneration.current) setError((cause as Error).message);
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
                          disabled={busy}
                          onPress={() => setAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? option : value))}
                        />
                      ))}
                    </View>
                  ) : (
                    <Input
                      label={copy('lesson.yourAnswer')}
                      testID={`language-placement-answer-${index}`}
                      value={answers[index] ?? ''}
                      onChangeText={(answer) => setAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? answer : value))}
                      multiline
                      editable={!busy}
                      maxLength={4000}
                    />
                  )}
                </View>
              ))}
              <Button testID="language-placement-submit" label={copy('examiner.submit')} variant="ai" loading={busy} onPress={() => void submit()} />
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
