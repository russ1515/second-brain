import { ScrollView, Pressable, Text, View } from 'react-native';
import type { ContextItem } from '@second-brain/shared';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';

export function ContextBar({
  items,
  onRemove,
}: {
  items: readonly ContextItem[];
  onRemove?: (item: ContextItem) => void;
}) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  const visible = items.filter((item) => item.visibility !== 'hidden').slice(0, 5);
  if (visible.length === 0) return null;

  return (
    <View accessibilityRole="summary" style={{ gap: spacing.xs }}>
      <Text style={[typography.caption, { color: c.textMuted }]}>{t('learn5.context.active')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
        {visible.map((item) => (
          <View
            key={`${item.kind}-${item.id}`}
            style={{
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingLeft: spacing.sm,
              paddingRight: onRemove ? spacing.xxs : spacing.sm,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surfaceSunken,
            }}
          >
            <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]} numberOfLines={1}>
              {contextIcon(item.kind)} {item.label ?? t(`learn5.context.${item.kind}`)}
            </Text>
            {onRemove ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('learn5.context.remove').replace('{label}', item.label ?? item.kind)}
                onPress={() => onRemove(item)}
                hitSlop={8}
                style={{ width: 36, height: 42, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: c.textMuted, fontSize: 18 }}>×</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {items.length > visible.length ? (
          <View style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
            <Text style={[typography.bodySmall, { color: c.textMuted }]}>+{items.length - visible.length}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function contextIcon(kind: ContextItem['kind']): string {
  if (kind === 'document' || kind === 'document-collection') return '▤';
  if (kind === 'concept') return '◉';
  if (kind === 'goal') return '◎';
  if (kind === 'language') return '文';
  if (kind === 'workspace') return '▧';
  return '·';
}
