import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type {
  ActionDestination,
  ContextItem,
  DocumentDetail,
  ExperienceSession,
  ExperienceSessionPage,
  HomeResumableSession,
  LearnReadyDecision,
  TutorSessionSummary,
  VoiceTurnResponse,
} from '@second-brain/shared';
import { resolveLearnComposition } from '@second-brain/shared';
import { useAuth } from '../../lib/auth-context';
import { api, apiUpload } from '../../lib/client';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { actionDestinationHref } from '../../lib/action-destination';
import { appendLearnDocument, isImageDocument } from '../../lib/learn/document-picker';
import { Alert, Button, Card, Skeleton } from '../../components/ds/core';
import { Page, Section } from '../../components/ds/layout';
import { ResumeSection } from '../../components/home/decision';
import {
  UniversalComposer,
  type LearnComposerExecutionResult,
  type LearnComposerPayload,
} from '../../components/learn/universal-composer';

const ADVANCED_MODES = [
  { key: 'explain', icon: '◇', route: '/tutor?mode=explain' },
  { key: 'teach', icon: '▤', route: '/lesson/new' },
  { key: 'guided', icon: '→', route: '/daily-session' },
  { key: 'oral', icon: '◉', route: '/tutor?mode=oral_exercise' },
  { key: 'exam', icon: '✓', route: '/tutor?mode=oral_exam' },
  { key: 'deep', icon: '⌕', route: '/research?depth=deep' },
] as const;

const SPACES = [
  { key: 'languages', icon: '文', route: '/languages' },
  { key: 'library', icon: '▤', route: '/library' },
  { key: 'workspace', icon: '▧', route: '/library/workspace' },
] as const;

/** Learn is the intention-led entry point; existing engines remain behind it. */
export default function LearnScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{
    documentId?: string | string[];
    documentTitle?: string | string[];
    conceptId?: string | string[];
    conceptName?: string | string[];
    goalId?: string | string[];
    goalTitle?: string | string[];
    languageProfileId?: string | string[];
    languageName?: string | string[];
  }>();
  const { colors: c, spacing, typography, radius } = useTokens();
  const { width } = useResponsive();
  const composition = resolveLearnComposition(width);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const contexts = useMemo(() => contextFromParams(params, t), [params, t]);
  const resumable = useQuery<ExperienceSessionPage>({
    queryKey: ['learn', 'resumable', user?.id],
    queryFn: ({ signal }) => api<ExperienceSessionPage>('/experience-sessions/resumable?limit=3', { signal }),
    enabled: Boolean(user),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  const sessions = (resumable.data?.items ?? []).map(toResumableSession).filter(isPresent).slice(0, 3);
  const open = (destination: string | ActionDestination) => {
    router.push((typeof destination === 'string' ? destination : actionDestinationHref(destination)) as never);
  };

  const execute = async (decision: LearnReadyDecision, payload: LearnComposerPayload): Promise<LearnComposerExecutionResult> => {
    if (decision.execution === 'navigate') {
      return { outcome: 'navigated', destination: actionDestinationHref(decision.destination) };
    }

    if (decision.execution === 'upload') {
      if (!payload.attachment) throw new Error(t('learn5.attachment.missing'));
      const image = isImageDocument(payload.attachment);
      const form = new FormData();
      await appendLearnDocument(form, image ? 'images' : 'file', payload.attachment);
      const document = await apiUpload<DocumentDetail>(image ? '/documents/scan' : '/documents/upload', form);
      return { outcome: 'completed', destination: `/library/${document.id}` };
    }

    const concept = payload.contexts.find((item) => item.kind === 'concept' && item.referenceId);
    const document = payload.contexts.find((item) => item.kind === 'document' && item.referenceId);
    const goal = payload.contexts.find((item) => item.kind === 'goal' && item.referenceId);
    const language = payload.contexts.find((item) => item.kind === 'language' && item.referenceId);
    const session = await api<TutorSessionSummary>('/tutor/sessions', {
      method: 'POST',
      body: {
        ...(payload.text ? { title: payload.text.slice(0, 120) } : {}),
        ...(payload.text ? { objective: payload.text.slice(0, 500) } : {}),
        intent: decision.intent,
        mode: decision.tutorMode ?? 'conversation',
        inputModality: decision.execution === 'tutor-voice' ? 'voice' : 'text',
        activeContexts: payload.contexts,
        ...(concept?.referenceId ? { focusConceptId: concept.referenceId } : {}),
        ...(document?.referenceId ? { documentId: document.referenceId } : {}),
        ...(goal?.referenceId ? { goalId: goal.referenceId } : {}),
        ...(language?.referenceId ? { languageProfileId: language.referenceId } : {}),
      },
    });

    if (decision.execution === 'tutor-voice') {
      if (!payload.recording) throw new Error(t('learn5.voice.missing'));
      const form = new FormData();
      form.append('audio', payload.recording.blob, `learn-turn.${audioExtension(payload.recording.mimeType)}`);
      await apiUpload<VoiceTurnResponse>(`/tutor/sessions/${session.id}/voice`, form);
    } else {
      // Send the learner's own wording unchanged. The existing Tutor backend
      // applies the user/profile learning-language policy.
      await api(`/tutor/sessions/${session.id}/messages`, { method: 'POST', body: { content: payload.text } });
    }
    return { outcome: 'completed', destination: `/tutor/${session.id}` };
  };

  const composer = user ? (
    <UniversalComposer ownerUserId={user.id} initialContexts={contexts} onExecute={execute} onNavigate={open} />
  ) : null;
  const resume = resumable.isPending ? <ResumeSkeleton /> : (
    <ResumeSection sessions={sessions} onResume={(session) => open(session.destination)} />
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={resumable.isRefetching} onRefresh={() => { void resumable.refetch(); }} tintColor={c.primary} colors={[c.primary]} />}
    >
      <Page width="wide" style={{ gap: spacing.xl, paddingBottom: spacing.huge }} testID="learn-intention-surface">
        <View style={{ gap: spacing.xs, maxWidth: 760 }}>
          <Text style={[typography.label, { color: c.aiAccent }]}>{t('learn5.eyebrow')}</Text>
          <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('learn5.title')}</Text>
          <Text style={[typography.body, { color: c.textSecondary }]}>{t('learn5.subtitle')}</Text>
        </View>

        {composition === 'split' && sessions.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }}>
            <View style={{ flex: 1, minWidth: 0 }}>{composer}</View>
            <View style={{ width: 340, flexShrink: 0 }}>{resume}</View>
          </View>
        ) : (
          <>{composer}{resume}</>
        )}

        {resumable.error ? <Alert tone="info" title={t('learn5.resume.unavailable')} detail={t('learn5.resume.unavailableDetail')} /> : null}

        <Section title={t('learn5.spaces.title')} description={t('learn5.spaces.detail')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {SPACES.map((space) => (
              <Pressable
                key={space.key}
                accessibilityRole="button"
                onPress={() => open(space.route)}
                style={({ pressed }) => ({
                  flexGrow: 1,
                  flexBasis: width < 700 ? '100%' : 220,
                  minHeight: 92,
                  padding: spacing.md,
                  gap: spacing.xxs,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: pressed ? c.surfaceSunken : c.surface,
                })}
              >
                <Text style={{ color: c.aiAccent, fontSize: 20 }}>{space.icon}</Text>
                <Text style={[typography.title, { color: c.textPrimary }]}>{t(`learn5.spaces.${space.key}` as TranslationKey)}</Text>
                <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t(`learn5.spaces.${space.key}Detail` as TranslationKey)}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <View style={{ gap: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
            onPress={() => setAdvancedOpen((openValue) => !openValue)}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.h3, { color: c.textPrimary }]}>{t('learn5.advanced.title')}</Text>
              <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('learn5.advanced.detail')}</Text>
            </View>
            <Text style={{ color: c.textMuted, fontSize: 20 }}>{advancedOpen ? '−' : '+'}</Text>
          </Pressable>
          {advancedOpen ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {ADVANCED_MODES.map((mode) => (
                <Button key={mode.key} variant="secondary" icon={mode.icon} label={t(`learn5.advanced.${mode.key}` as TranslationKey)} onPress={() => open(mode.route)} />
              ))}
            </View>
          ) : null}
        </View>
      </Page>
    </ScrollView>
  );
}

type Translate = (key: TranslationKey) => string;

function contextFromParams(params: Record<string, string | string[] | undefined>, t: Translate): ContextItem[] {
  const now = new Date().toISOString();
  const documentId = first(params.documentId);
  const conceptId = first(params.conceptId);
  const goalId = first(params.goalId);
  const languageId = first(params.languageProfileId);
  const items: ContextItem[] = [];
  if (documentId) items.push(contextItem('document', documentId, first(params.documentTitle) || t('learn5.context.document'), now));
  if (conceptId) items.push(contextItem('concept', conceptId, first(params.conceptName) || t('learn5.context.concept'), now));
  if (goalId) items.push(contextItem('goal', goalId, first(params.goalTitle) || t('learn5.context.goal'), now));
  if (languageId) items.push(contextItem('language', languageId, first(params.languageName) || t('learn5.context.language'), now));
  return items;
}

function contextItem(kind: ContextItem['kind'], referenceId: string, label: string, addedAt: string): ContextItem {
  return { id: `${kind}:${referenceId}`, kind, referenceId, label, scope: 'active-object', priority: 80, visibility: 'visible', addedAt };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toResumableSession(session: ExperienceSession): HomeResumableSession | null {
  if (session.status !== 'active' && session.status !== 'paused') return null;
  const destination = resumeDestination(session);
  if (!destination) return null;
  const production = session.productions[0];
  const source = session.sourceReferences[0];
  return {
    id: session.id,
    type: session.type,
    status: session.status,
    title: session.title,
    contextLabels: session.activeContexts.items.filter((item) => item.visibility !== 'hidden' && item.label).slice(0, 3).map((item) => item.label as string),
    updatedAt: session.updatedAt,
    progress: session.progress,
    artifact: production
      ? { kind: production.kind, id: production.referenceId ?? production.id, title: production.title ?? null }
      : source ? { kind: source.kind, id: source.id, title: source.title ?? null } : null,
    destination,
  };
}

function resumeDestination(session: ExperienceSession): ActionDestination | null {
  if (session.resumeTarget) return session.resumeTarget;
  if (session.links.tutorSessionId) return { kind: 'experience-session', id: session.id, path: `/tutor/${session.links.tutorSessionId}`, params: { experienceSessionId: session.id } };
  if (session.links.studySessionId) return { kind: 'experience-session', id: session.id, path: `/session/${session.links.studySessionId}`, params: { experienceSessionId: session.id } };
  if (session.links.lessonId) return { kind: 'experience-session', id: session.id, path: `/lesson/${session.links.lessonId}`, params: { experienceSessionId: session.id } };
  if (session.links.documentId) return { kind: 'experience-session', id: session.id, path: `/library/${session.links.documentId}`, params: { experienceSessionId: session.id } };
  if (session.links.languageProfileId) return { kind: 'experience-session', id: session.id, path: `/languages/${session.links.languageProfileId}`, params: { experienceSessionId: session.id } };
  if (session.links.workspaceRef) return { kind: 'experience-session', id: session.id, path: `/library/workspace/${session.links.workspaceRef}`, params: { experienceSessionId: session.id } };
  return null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function audioExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

function ResumeSkeleton() {
  const { spacing } = useTokens();
  return (
    <Card style={{ gap: spacing.sm }}>
      <Skeleton height={20} width="45%" />
      <Skeleton height={56} />
      <Skeleton height={44} />
    </Card>
  );
}
