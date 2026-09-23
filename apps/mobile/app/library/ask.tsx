import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createContext,
  type AskRequest,
  type Collection,
  type ContextItem,
  type LibraryDocument,
  type LibraryPage,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useTokens } from '../../lib/design/theme';
import { useI18n } from '../../lib/i18n';
import { useResponsive } from '../../lib/responsive';
import { Alert, Badge, Button, Card, SegmentedControl } from '../../components/ds/core';
import { SmartLoadingState } from '../../components/ds/states';
import { GroundedAsk } from '../../components/document/grounded-ask';

type ScopeMode = 'all' | 'collection' | 'selected';

export default function AskLibraryScreen() {
  const params = useLocalSearchParams<{ documentId?: string; title?: string; q?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useResponsive();
  const desktop = width >= 1024;
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  const initialDocument = typeof params.documentId === 'string' ? params.documentId : null;
  const [mode, setMode] = useState<ScopeMode>(initialDocument ? 'selected' : 'all');
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialDocument ? [initialDocument] : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api<LibraryPage>('/library/paged?filter=all&sort=newest&limit=50'),
      api<Collection[]>('/library/collections'),
    ]).then(([page, nextCollections]) => {
      setDocuments(page.items.filter((document) => document.status === 'ready'));
      setCollections(nextCollections);
      setLoading(false);
    }).catch((caught) => { setError((caught as Error).message); setLoading(false); });
  }, []);

  const scope = useMemo<Omit<AskRequest, 'question'>>(() => {
    if (mode === 'collection' && collectionId) return { collectionId };
    if (mode === 'selected') return { documentIds: selectedIds };
    return {};
  }, [collectionId, mode, selectedIds]);

  const contexts = useMemo<ContextItem[]>(() => {
    if (!user) return [];
    if (mode === 'collection' && collectionId) {
      const collection = collections.find((item) => item.id === collectionId);
      return createContext(user.id, [{ id: `collection:${collectionId}`, kind: 'document-collection', scope: 'active-object', referenceId: collectionId, label: collection?.name, priority: 100, visibility: 'visible' }]).items;
    }
    if (mode === 'selected') {
      return createContext(user.id, selectedIds.map((id, index) => ({ id: `document:${id}`, kind: 'document' as const, scope: 'active-object' as const, referenceId: id, label: documents.find((item) => item.id === id)?.title ?? (id === initialDocument ? params.title : undefined), priority: 100 - index, visibility: 'visible' as const }))).items;
    }
    return createContext(user.id, [{ id: 'research:library', kind: 'research', scope: 'space', referenceId: 'library', label: t('lib.ask.all'), priority: 80, visibility: 'visible' }]).items;
  }, [collectionId, collections, documents, initialDocument, mode, params.title, selectedIds, t, user]);

  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 20 ? [...current, id] : current);
  const ready = mode === 'all' || (mode === 'collection' && Boolean(collectionId)) || (mode === 'selected' && selectedIds.length > 0);

  return (
    <ScrollView contentContainerStyle={{ padding: desktop ? 28 : 16, gap: spacing.lg, maxWidth: 1280, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.overline, { color: c.primary }]}>{t('library7.ask.ownedSources')}</Text>
        <Text accessibilityRole="header" style={[typography.headline, { color: c.textPrimary }]}>{t('library7.ask.title')}</Text>
        <Text style={[typography.body, { color: c.textSecondary }]}>{t('library7.ask.detail')}</Text>
      </View>
      {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
      {loading ? <SmartLoadingState /> : (
        <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: 'flex-start', gap: spacing.lg }}>
          <Card style={{ width: desktop ? 320 : '100%', gap: spacing.md }}>
            <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('lib.ask.scope')}</Text>
            <SegmentedControl options={['all', 'collection', 'selected'] as const} value={mode} onChange={setMode} labelFor={(value) => t(`library7.ask.scope.${value}`)} />
            {mode === 'collection' ? <View style={{ gap: spacing.xs }}>
              {collections.length ? collections.map((collection) => <ScopeRow key={collection.id} label={collection.name} detail={t('library7.documentsCount').replace('{n}', String(collection.documentCount))} selected={collection.id === collectionId} onPress={() => setCollectionId(collection.id)} />) : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('library7.ask.noCollections')}</Text>}
            </View> : null}
            {mode === 'selected' ? <View style={{ gap: spacing.xs }}>
              <Badge label={t('library7.ask.selectedCount').replace('{n}', String(selectedIds.length))} tone={selectedIds.length ? 'primary' : 'warning'} />
              {documents.map((document) => <ScopeRow key={document.id} label={document.title} detail={document.subject ?? document.source.toUpperCase()} selected={selectedIds.includes(document.id)} onPress={() => toggle(document.id)} />)}
            </View> : null}
          </Card>
          <View style={{ flex: 1, width: '100%' }}>
            {ready ? <GroundedAsk key={JSON.stringify(scope)} scope={scope} contexts={contexts} initialQuestion={params.q ?? ''} onOpenDocument={(documentId) => router.push(`/library/${documentId}`)} onOpenUsage={() => router.push('/usage')} /> : <Alert tone="info" title={t('library7.ask.chooseScope')} detail={t('library7.ask.chooseScopeDetail')} />}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function ScopeRow({ label, detail, selected, onPress }: { label: string; detail: string; selected: boolean; onPress: () => void }) {
  const { colors: c, radius, spacing, typography } = useTokens();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={{ minHeight: 52, borderWidth: 1, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.surfaceSunken : c.surface, borderRadius: radius.sm, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
    <Text style={{ color: selected ? c.primary : c.textMuted, fontSize: 18 }}>{selected ? '✓' : '○'}</Text>
    <View style={{ flex: 1 }}><Text numberOfLines={1} style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{label}</Text><Text style={[typography.caption, { color: c.textMuted }]}>{detail}</Text></View>
  </Pressable>;
}
