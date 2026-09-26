import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import type {
  ContextItem,
  LearnDepth,
  LearnDraftOutcome,
  LearnIntent,
  LearnReadyDecision,
  LearnRouteDecision,
} from '@second-brain/shared';
import {
  LEARN_DEPTHS,
  LEARN_INTENTS,
  routeLearnIntent,
  shouldClearLearnDraft,
} from '@second-brain/shared';
import { ContextBar } from '../context/context-bar';
import { Alert, Badge, Button, Card } from '../ds/core';
import { Sheet } from '../ds/overlays';
import { createRecorder, RECORDING_SUPPORTED, type Recording, type Recorder } from '../../lib/recorder';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import {
  clearLearnDraft,
  loadLearnDraft,
  saveLearnDraft,
  type LearnDraftAttachment,
} from '../../lib/learn/composer-draft';
import {
  isImageDocument,
  pickLearnDocument,
  type PickedLearnDocument,
} from '../../lib/learn/document-picker';

export interface LearnComposerPayload {
  text: string;
  contexts: ContextItem[];
  attachment: PickedLearnDocument | null;
  recording?: Recording;
}

export interface LearnComposerExecutionResult {
  outcome: LearnDraftOutcome;
  destination?: string;
}

export function UniversalComposer({
  ownerUserId,
  initialContexts,
  onExecute,
  onNavigate,
}: {
  ownerUserId: string;
  initialContexts: readonly ContextItem[];
  onExecute: (decision: LearnReadyDecision, payload: LearnComposerPayload) => Promise<LearnComposerExecutionResult>;
  onNavigate: (destination: string) => void;
}) {
  const { formatLocale, t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  const initialContextSignature = initialContexts.map((item) => `${item.kind}:${item.id}:${item.label ?? ''}`).join('|');
  const stableInitialContexts = useMemo(() => [...initialContexts], [initialContextSignature]);
  const [text, setText] = useState('');
  const [intent, setIntent] = useState<LearnIntent | null>(null);
  const [depth, setDepth] = useState<LearnDepth>('standard');
  const [contexts, setContexts] = useState<ContextItem[]>([...initialContexts]);
  const [attachment, setAttachment] = useState<PickedLearnDocument | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [clarification, setClarification] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<LearnReadyDecision | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    let active = true;
    void loadLearnDraft(ownerUserId).then((draft) => {
      if (!active) return;
      if (draft) {
        setText(draft.text);
        setIntent(draft.selectedIntent);
        setDepth(draft.depth);
        setAttachment(draft.attachment);
        setContexts(mergeContexts(stableInitialContexts, draft.contexts));
        const initialKeys = new Set(stableInitialContexts.map((item) => `${item.kind}:${item.id}`));
        const hasRestoredContext = draft.contexts.some((item) => !initialKeys.has(`${item.kind}:${item.id}`));
        setRestored(!!draft.text || !!draft.attachment || !!draft.selectedIntent || draft.depth !== 'standard' || hasRestoredContext);
      }
      setHydrated(true);
    });
    return () => { active = false; };
  }, [ownerUserId, stableInitialContexts]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void saveLearnDraft(ownerUserId, {
        text,
        selectedIntent: intent,
        depth,
        contexts,
        attachment: attachment ? toDraftAttachment(attachment) : null,
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [attachment, contexts, depth, hydrated, intent, ownerUserId, text]);

  useEffect(() => () => recorder.current?.cancel(), []);

  const decision = useMemo(() => routeLearnIntent({
    text,
    selectedIntent: intent,
    modality: attachment ? 'import' : 'write',
    depth,
    contexts,
    hasAttachment: !!attachment,
    attachmentKind: attachment && isImageDocument(attachment) ? 'image' : 'document',
  }), [attachment, contexts, depth, intent, text]);
  const suggestedIntent = decision.status === 'ready' && decision.intent !== 'free' ? decision.intent : null;
  const researchActive = intent === 'research' || suggestedIntent === 'research';

  const resetCompletedDraft = async () => {
    setText('');
    setIntent(null);
    setDepth('standard');
    setAttachment(null);
    setClarification(false);
    setPendingConfirmation(null);
    setRestored(false);
    await clearLearnDraft(ownerUserId);
  };

  const run = async (next: LearnRouteDecision, extra?: { recording?: Recording }) => {
    if (next.status === 'clarification') {
      setClarification(true);
      return;
    }
    if (next.requiresConfirmation && pendingConfirmation !== next) {
      setPendingConfirmation(next);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onExecute(next, { text: text.trim(), contexts, attachment, ...extra });
      if (shouldClearLearnDraft(result.outcome)) await resetCompletedDraft();
      if (result.destination) onNavigate(result.destination);
    } catch (reason) {
      setError((reason as Error).message || t('learn5.error.generic'));
    } finally {
      setBusy(false);
    }
  };

  const chooseClarification = (selected: LearnIntent) => {
    setIntent(selected);
    setClarification(false);
    const next = routeLearnIntent({
      text,
      selectedIntent: selected,
      modality: attachment ? 'import' : 'write',
      depth,
      contexts,
      hasAttachment: !!attachment,
      attachmentKind: attachment && isImageDocument(attachment) ? 'image' : 'document',
    });
    void run(next);
  };

  const chooseFile = async () => {
    setError(null);
    try {
      const picked = await pickLearnDocument();
      if (picked) {
        setAttachment(picked);
        setPendingConfirmation(null);
        setCaptureOpen(false);
      }
    } catch (reason) {
      setError((reason as Error).message || t('learn5.attachment.error'));
    }
  };

  const openScan = () => {
    setCaptureOpen(false);
    void run(routeLearnIntent({ text, selectedIntent: intent, modality: 'capture', depth, contexts }));
  };

  const toggleVoice = async () => {
    if (!RECORDING_SUPPORTED || busy) return;
    setError(null);
    try {
      if (!recording) {
        recorder.current = createRecorder();
        await recorder.current.start();
        setRecording(true);
        return;
      }
      const audio = await recorder.current!.stop();
      recorder.current = null;
      setRecording(false);
      const voiceDecision = routeLearnIntent({ text, selectedIntent: intent, modality: 'speak', depth, contexts });
      await run(voiceDecision, { recording: audio });
    } catch (reason) {
      recorder.current?.cancel();
      recorder.current = null;
      setRecording(false);
      setError((reason as Error).message || t('learn5.voice.error'));
    }
  };

  const clearAll = () => {
    void resetCompletedDraft();
    setContexts([...stableInitialContexts]);
    setError(null);
  };

  return (
    <View style={{ gap: spacing.sm }} testID="universal-composer">
      <Card elevated style={{ gap: spacing.md, padding: spacing.lg, borderColor: c.aiAccent }}>
        <View style={{ gap: spacing.xs }}>
          <Badge tone="ai" label={t('learn5.composer.badge')} />
          <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{t('learn5.question')}</Text>
          <Text style={[typography.body, { color: c.textSecondary }]}>{t('learn5.composer.detail')}</Text>
        </View>

        <ContextBar
          items={contexts}
          onRemove={(item) => {
            setContexts((current) => current.filter((candidate) => candidate.id !== item.id || candidate.kind !== item.kind));
            setPendingConfirmation(null);
          }}
        />

        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setClarification(false);
            setPendingConfirmation(null);
          }}
          placeholder={t('learn5.composer.placeholder')}
          placeholderTextColor={c.textMuted}
          multiline
          textAlignVertical="top"
          accessibilityLabel={t('learn5.composer.inputLabel')}
          style={{
            minHeight: 132,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            padding: spacing.md,
            color: c.textPrimary,
            backgroundColor: c.surface,
            fontSize: 17,
            lineHeight: 25,
          }}
        />

        {!text && !attachment && !restored ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.caption, { color: c.textMuted }]}>{t('learn5.examples.label')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Button size="sm" variant="secondary" label={t('learn5.examples.understand')} onPress={() => { setIntent('understand'); setText(t('learn5.examples.understandPrompt')); }} />
              <Button size="sm" variant="secondary" label={t('learn5.examples.practice')} onPress={() => { setIntent('practice'); setText(t('learn5.examples.practicePrompt')); }} />
              <Button size="sm" variant="secondary" label={t('learn5.examples.scan')} onPress={() => setCaptureOpen(true)} />
              <Button size="sm" variant="secondary" label={t('learn5.examples.import')} onPress={() => setCaptureOpen(true)} />
            </View>
          </View>
        ) : null}

        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: c.textMuted }]}>{t('learn5.intent.label')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {LEARN_INTENTS.map((item) => {
              const selected = intent === item;
              const suggested = !intent && suggestedIntent === item;
              return (
                <Pressable
                  key={item}
                  testID={`intent-${item}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(`learn5.intent.${item}` as TranslationKey)}
                  onPress={() => {
                    setIntent(selected ? null : item);
                    setClarification(false);
                    setPendingConfirmation(null);
                  }}
                  style={{
                    minHeight: 44,
                    justifyContent: 'center',
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: selected ? c.aiAccent : suggested ? c.primary : c.border,
                    backgroundColor: selected ? c.aiAccentSoft : c.surface,
                  }}
                >
                  <Text style={[typography.bodySmall, { color: selected ? c.aiAccent : c.textPrimary, fontWeight: '700' }]}>
                    {t(`learn5.intent.${item}` as TranslationKey)}{suggested ? ` · ${t('learn5.intent.suggested')}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {researchActive ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.caption, { color: c.textMuted }]}>{t('learn5.depth.label')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {LEARN_DEPTHS.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: depth === item }}
                  onPress={() => { setDepth(item); setPendingConfirmation(null); }}
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: depth === item ? c.primary : c.surfaceSunken }}
                >
                  <Text style={[typography.bodySmall, { color: depth === item ? c.onPrimary : c.textPrimary, fontWeight: '700' }]}>{t(`learn5.depth.${item}` as TranslationKey)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {attachment ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: c.surfaceSunken }}>
            {isImageDocument(attachment) ? (
              <Image source={{ uri: attachment.uri }} accessibilityLabel={attachment.name} style={{ width: 52, height: 52, borderRadius: radius.xs, backgroundColor: c.surface }} />
            ) : <Text style={{ fontSize: 22 }}>▤</Text>}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]} numberOfLines={1}>{attachment.name}</Text>
              <Text style={[typography.caption, { color: c.textMuted }]}>{formatSize(attachment.size, formatLocale)} · {t('learn5.attachment.ready')}</Text>
            </View>
            <Button label={t('learn5.attachment.remove')} variant="ghost" size="sm" onPress={() => { setAttachment(null); setPendingConfirmation(null); }} />
          </View>
        ) : null}

        {decision.status === 'ready' && (text.trim() || attachment) ? (
          <Text accessibilityLiveRegion="polite" style={[typography.bodySmall, { color: c.textSecondary }]}>
            {t('learn5.route.prefix')} {t(`learn5.route.${decision.explanation}` as TranslationKey)}
          </Text>
        ) : null}

        {clarification ? (
          <View accessibilityLiveRegion="polite" style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.infoSoft }}>
            <Text style={[typography.title, { color: c.textPrimary }]}>{t('learn5.clarify.question')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {LEARN_INTENTS.map((item) => <Button key={item} size="sm" variant="secondary" label={t(`learn5.intent.${item}` as TranslationKey)} onPress={() => chooseClarification(item)} />)}
            </View>
          </View>
        ) : null}

        {pendingConfirmation ? (
          <Alert tone="warning" title={t('learn5.deep.confirmTitle')} detail={t('learn5.deep.confirmDetail')} />
        ) : null}
        {error ? <Alert tone="error" title={error} detail={t('learn5.error.preserved')} /> : null}
        {restored && !error ? <Alert tone="info" title={t('learn5.draft.restored')} detail={t('learn5.draft.restoredDetail')} /> : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
          <Button label={t('learn5.modality.write')} icon="✎" variant="ghost" onPress={() => inputRef.current?.focus()} />
          <Button
            label={recording ? t('learn5.voice.stop') : t('learn5.modality.speak')}
            icon={recording ? '■' : '◉'}
            variant={recording ? 'secondary' : 'ghost'}
            disabled={!RECORDING_SUPPORTED}
            onPress={() => void toggleVoice()}
          />
          {!RECORDING_SUPPORTED ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('learn5.voice.unavailable')}</Text> : null}
          <Button label={t('learn5.modality.capture')} icon="▣" variant="ghost" onPress={() => setCaptureOpen(true)} />
          <Button label={t('learn5.modality.import')} icon="＋" variant="ghost" onPress={() => setCaptureOpen(true)} />
          <View style={{ flex: 1 }} />
          {(text || attachment || intent || contexts.length > stableInitialContexts.length) ? <Button label={t('learn5.draft.clear')} variant="ghost" onPress={clearAll} /> : null}
          <Button
            testID="learn-composer-submit"
            label={pendingConfirmation ? t('learn5.deep.confirm') : attachment ? t('learn5.attachment.import') : t('learn5.composer.submit')}
            variant="ai"
            size="lg"
            loading={busy}
            disabled={!attachment && !text.trim()}
            onPress={() => void run(pendingConfirmation ?? decision)}
          />
        </View>
      </Card>

      <Sheet visible={captureOpen} onClose={() => setCaptureOpen(false)} title={t('learn5.capture.title')}>
        <Text style={[typography.body, { color: c.textSecondary }]}>{t('learn5.capture.detail')}</Text>
        <Button fullWidth label={t('learn5.capture.scan')} icon="▣" onPress={openScan} />
        <Button fullWidth label={t('learn5.capture.file')} icon="＋" variant="secondary" onPress={() => void chooseFile()} />
        <Button fullWidth label={t('learn5.cancel')} variant="ghost" onPress={() => setCaptureOpen(false)} />
      </Sheet>
    </View>
  );
}

function mergeContexts(initial: readonly ContextItem[], restored: readonly ContextItem[]): ContextItem[] {
  const merged = new Map<string, ContextItem>();
  for (const item of [...restored, ...initial]) merged.set(`${item.kind}:${item.id}`, item);
  return [...merged.values()].slice(0, 5);
}

function toDraftAttachment(value: PickedLearnDocument): LearnDraftAttachment {
  return { uri: value.uri, name: value.name, mimeType: value.mimeType, size: value.size };
}

function formatSize(size: number | null, formatLocale: string): string {
  if (size === null) return '—';
  const format = (value: number, maximumFractionDigits: number) => new Intl.NumberFormat(formatLocale, {
    maximumFractionDigits,
  }).format(value);
  if (size < 1_024) return `${format(size, 0)} B`;
  if (size < 1_048_576) return `${format(Math.round(size / 1_024), 0)} KB`;
  return `${format(size / 1_048_576, 1)} MB`;
}
