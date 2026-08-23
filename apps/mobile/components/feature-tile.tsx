import { useEffect, useRef, useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { columnBasis, useResponsive } from '../lib/responsive';

/**
 * One feature in a space's grid.
 *
 * `comingSoon` renders a dimmed, non-tappable tile with a badge — the honest way
 * to install the structure of a feature that is not built yet (per the sprint:
 * "structure first, Coming Soon is fine"). A tile with an `onPress` and no
 * `comingSoon` routes into a real, existing screen.
 */
export function FeatureTile({
  emoji,
  title,
  subtitle,
  onPress,
  comingSoon,
  testID,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  comingSoon?: boolean;
  testID?: string;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const { columns } = useResponsive();
  const disabled = comingSoon || !onPress;

  // Subtle entrance animation — a small rise on mount. Opacity stays 1 so the
  // tile is NEVER invisible even if the animation frame doesn't run (e.g. a
  // backgrounded/reduced-motion context); only the translate is animated.
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        flexGrow: 1,
        flexBasis: columnBasis(columns),
        minWidth: 150,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
        ],
      }}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        testID={testID}
        style={[styles.tile, disabled && styles.tileOff]}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        {comingSoon ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('soon.badge')}</Text>
          </View>
        ) : subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: 16,
    minHeight: 112,
    gap: 6,
  },
  tileOff: { opacity: 0.55 },
  emoji: { fontSize: 26 },
  title: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  subtitle: { fontSize: 12, color: c.textSecondary, lineHeight: 16 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: c.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    color: c.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
