import { useEffect, useMemo, useState } from 'react';
import type { LanguageTrainingFormat, LessonExercise } from '@second-brain/shared';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { SpeakButton } from '../speak-button';
import { Button, Card } from '../ui';

const FORMAT_LABELS: Record<LanguageTrainingFormat, TranslationKey> = {
  'recognition-mcq': 'rlle.ui.training.format.recognition-mcq',
  'contextual-discrimination': 'rlle.ui.training.format.contextual-discrimination',
  'fill-blank-no-hint': 'rlle.ui.training.format.fill-blank-no-hint',
  'sentence-reconstruction': 'rlle.ui.training.format.sentence-reconstruction',
  'register-matching': 'rlle.ui.training.format.register-matching',
  'error-correction': 'rlle.ui.training.format.error-correction',
  'listening-discrimination': 'rlle.ui.training.format.listening-discrimination',
  'guided-writing': 'rlle.ui.training.format.guided-writing',
  'voice-pronunciation': 'rlle.ui.training.format.voice-pronunciation',
  'mini-dialogue': 'rlle.ui.training.format.mini-dialogue',
};

const OPTION_FORMATS = new Set<LanguageTrainingFormat>([
  'recognition-mcq',
  'contextual-discrimination',
  'register-matching',
  'listening-discrimination',
]);

export interface LanguagePracticeRunnerProps {
  index: number;
  exercise: LessonExercise;
  language?: string | null;
  busy?: boolean;
  voiceActive?: boolean;
  onSubmit: (answer: string) => void;
  onVoice?: () => void;
}

/**
 * Input-only renderer for language practice. Persistence, marking, evidence,
 * quota and progression remain the responsibility of the parent/API.
 */
export function LanguagePracticeRunner({
  index,
  exercise,
  language,
  busy = false,
  voiceActive = false,
  onSubmit,
  onVoice,
}: LanguagePracticeRunnerProps) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [answer, setAnswer] = useState('');
  const [selectedTokenIndexes, setSelectedTokenIndexes] = useState<number[]>([]);

  const format = exercise.languageFormat
    ?? (exercise.type === 'qcm' ? 'recognition-mcq' : 'guided-writing');
  const options = exercise.options ?? [];
  const tokens = exercise.tokens ?? [];

  useEffect(() => {
    setAnswer('');
    setSelectedTokenIndexes([]);
  }, [index, exercise.question, format]);

  const changeAnswer = (value: string) => {
    setAnswer(value);
    setSelectedTokenIndexes([]);
  };

  const chooseToken = (tokenIndex: number) => {
    if (busy) return;
    setSelectedTokenIndexes((current) => {
      const next = current.includes(tokenIndex)
        ? current.filter((value) => value !== tokenIndex)
        : [...current, tokenIndex];
      setAnswer(next.map((value) => tokens[value]).join(' '));
      return next;
    });
  };

  const submit = () => {
    const submittedAnswer = answer.trim();
    if (!busy && submittedAnswer) onSubmit(submittedAnswer);
  };

  const renderTextAnswer = (multiline: boolean) => (
    <TextInput
      accessibilityLabel={t('rlle.ui.training.answer')}
      editable={!busy}
      multiline={multiline}
      onChangeText={changeAnswer}
      placeholder={t('rlle.ui.training.answer')}
      placeholderTextColor={c.textMuted}
      returnKeyType={multiline ? 'default' : 'done'}
      onSubmitEditing={multiline ? undefined : submit}
      style={[styles.answer, multiline && styles.longAnswer]}
      testID={`language-answer-${index}`}
      value={answer}
    />
  );

  const renderOptions = () => options.length >= 2 ? (
    <View style={styles.options} accessibilityRole="radiogroup">
      {options.map((option, optionIndex) => {
        const selected = answer === option;
        return (
          <Pressable
            key={`${optionIndex}-${option}`}
            accessibilityRole="radio"
            accessibilityLabel={option}
            accessibilityState={{ checked: selected, disabled: busy }}
            disabled={busy}
            focusable={!busy}
            onPress={() => setAnswer(option)}
            style={[styles.option, selected && styles.optionSelected]}
            testID={`language-option-${index}-${optionIndex}`}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  ) : renderTextAnswer(false);

  const renderReconstruction = () => (
    <View style={styles.activity}>
      <Text style={styles.supportLabel}>{t('rlle.ui.training.tokenBank')}</Text>
      <View style={styles.tokenBank} accessibilityLabel={t('rlle.ui.training.tokenBank')}>
        {tokens.map((token, tokenIndex) => {
          const selected = selectedTokenIndexes.includes(tokenIndex);
          return (
            <Pressable
              key={`${tokenIndex}-${token}`}
              accessibilityRole="button"
              accessibilityLabel={token}
              accessibilityState={{ selected, disabled: busy }}
              disabled={busy}
              focusable={!busy}
              onPress={() => chooseToken(tokenIndex)}
              style={[styles.token, selected && styles.tokenSelected]}
              testID={`language-token-${index}-${tokenIndex}`}
            >
              <Text style={[styles.tokenText, selected && styles.tokenTextSelected]}>{token}</Text>
            </Pressable>
          );
        })}
      </View>
      {renderTextAnswer(false)}
    </View>
  );

  const renderActivity = () => {
    if (OPTION_FORMATS.has(format)) {
      return (
        <View style={styles.activity}>
          {format === 'listening-discrimination' && exercise.audioText ? (
            <SpeakButton
              text={exercise.audioText}
              language={language ?? undefined}
              label={t('lesson.readAloud')}
            />
          ) : null}
          {renderOptions()}
        </View>
      );
    }

    switch (format) {
      case 'fill-blank-no-hint':
        return renderTextAnswer(false);
      case 'sentence-reconstruction':
        return renderReconstruction();
      case 'error-correction':
      case 'guided-writing':
        return renderTextAnswer(true);
      case 'voice-pronunciation':
        return (
          <View style={styles.activity}>
            {exercise.audioText ? (
              <SpeakButton
                text={exercise.audioText}
                language={language ?? undefined}
                label={t('lesson.readAloud')}
              />
            ) : null}
            <Button
              label={voiceActive ? t('lang.stopCoaching') : t('rlle.ui.training.voice')}
              onPress={() => onVoice?.()}
              disabled={busy || !onVoice}
              variant="ghost"
              testID={`language-voice-${index}`}
            />
          </View>
        );
      case 'mini-dialogue':
        return (
          <View style={styles.activity}>
            {exercise.dialogueTurns?.map((turn, turnIndex) => (
              <Text key={`${turnIndex}-${turn}`} style={styles.dialogueTurn}>
                {turn}
              </Text>
            ))}
            {renderTextAnswer(true)}
          </View>
        );
      default:
        return renderTextAnswer(exercise.type !== 'qcm');
    }
  };

  return (
    <Card style={styles.card} testID={`language-practice-${index}`}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t(FORMAT_LABELS[format])}</Text>
      </View>
      <Text style={styles.question} testID={`language-question-${index}`}>
        {index + 1}. {exercise.question}
      </Text>

      {renderActivity()}

      {format !== 'voice-pronunciation' ? (
        <Button
          label={t('lesson.submit')}
          onPress={submit}
          busy={busy}
          disabled={busy || !answer.trim()}
          testID={`language-submit-${index}`}
        />
      ) : null}
    </Card>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  card: { gap: 12 },
  activity: { gap: 10 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: c.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: c.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  question: { color: c.textPrimary, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  options: { gap: 8 },
  option: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSelected: { backgroundColor: c.primary, borderColor: c.primary },
  optionText: { color: c.textPrimary, fontSize: 15 },
  optionTextSelected: { color: c.onPrimary, fontWeight: '600' },
  answer: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderRadius: 10,
    borderWidth: 1,
    color: c.textPrimary,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  longAnswer: { minHeight: 112, textAlignVertical: 'top' },
  supportLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  tokenBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  token: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tokenSelected: { backgroundColor: c.primary, borderColor: c.primary },
  tokenText: { color: c.textPrimary, fontSize: 15 },
  tokenTextSelected: { color: c.onPrimary, fontWeight: '600' },
  dialogueTurn: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 10,
    color: c.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    padding: 10,
  },
});
