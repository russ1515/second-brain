import { Pressable, Text, View } from 'react-native';
import type { Citation, ResearchCitation } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { useI18n } from '../../lib/i18n';
import { Badge, Card } from './core';
import { Button } from './core';

export type SourceKind = 'document' | 'brain' | 'web' | 'external';

export interface SourceCitationProps {
  title?: string;
  citation?: ResearchCitation;
  kind?: SourceKind;
  index?: number;
  provider?: string;
  onPress?: () => void;
  compact?: boolean;
}

function sourceIcon(kind: SourceKind): string {
  if (kind === 'brain') return '🧠';
  if (kind === 'web' || kind === 'external') return '🌐';
  return '📄';
}

/** One accessible citation vocabulary for documents, Brain and external sources. */
export function SourceCitation({
  title,
  citation,
  kind = citation ? 'web' : 'document',
  index,
  provider,
  onPress,
  compact = true,
}: SourceCitationProps) {
  const { colors: c, radius, spacing, typography } = useTokens();
  const resolvedTitle = citation?.title ?? title ?? '';
  const external = kind === 'web' || kind === 'external';
  const content = (
    <>
      {index !== undefined ? <Text style={[typography.caption, { color: c.textMuted }]}>{index}</Text> : null}
      <Text accessible={false} style={{ fontSize: compact ? 12 : 15 }}>{sourceIcon(kind)}</Text>
      <Text numberOfLines={compact ? 1 : 2} style={[compact ? typography.caption : typography.bodySmall, { color: c.textSecondary, flexShrink: 1 }]}>
        {resolvedTitle}
      </Text>
      {external ? <Badge label={provider ?? citation?.provider ?? 'Web'} tone="info" /> : null}
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: external ? c.info : c.border,
    borderRadius: radius.sm,
    paddingVertical: compact ? 6 : 9,
    paddingHorizontal: compact ? 10 : 12,
    alignSelf: 'flex-start' as const,
    minHeight: compact ? 32 : 44,
    maxWidth: '100%' as const,
  };
  if (!onPress) return <View accessibilityLabel={resolvedTitle} style={style}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={resolvedTitle}
      style={({ pressed }) => [style, { opacity: pressed ? 0.75 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

export function SourcePreview({
  citation,
  documentCitation,
  title,
  snippet,
  location,
  kind = documentCitation ? 'document' : 'web',
  onOpen,
  onClose,
}: {
  citation?: ResearchCitation;
  documentCitation?: Citation;
  title?: string;
  snippet?: string | null;
  location?: string | null;
  kind?: SourceKind;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  const resolvedTitle = documentCitation?.documentTitle ?? citation?.title ?? title ?? '';
  const resolvedSnippet = snippet ?? documentCitation?.content ?? citation?.excerpt;
  const resolvedLocation = location ?? (documentCitation
    ? t('source.passage').replace('{n}', String(documentCitation.chunkIndex + 1))
    : citation?.publishedAt);
  return (
    <Card style={{ gap: spacing.sm }} testID="source-preview">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <SourceCitation title={resolvedTitle} citation={citation} kind={kind} provider={citation?.provider} onPress={onOpen} compact={false} />
        {onClose ? <Button label={t('source.close')} variant="ghost" size="sm" onPress={onClose} /> : null}
      </View>
      {resolvedLocation ? <Text style={[typography.caption, { color: c.textMuted }]}>{resolvedLocation}</Text> : null}
      {resolvedSnippet ? (
        <Text selectable style={[typography.bodySmall, { color: c.textSecondary }]}>{resolvedSnippet}</Text>
      ) : null}
      {onOpen ? <Button label={t('source.openDocument')} variant="secondary" size="sm" onPress={onOpen} /> : null}
    </Card>
  );
}
