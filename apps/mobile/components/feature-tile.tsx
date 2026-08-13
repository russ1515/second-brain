import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { theme } from '../lib/theme';
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

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 16,
    minHeight: 112,
    gap: 6,
  },
  tileOff: { opacity: 0.55 },
  emoji: { fontSize: 26 },
  title: { fontSize: 15, fontWeight: '600', color: theme.text },
  subtitle: { fontSize: 12, color: theme.textMuted, lineHeight: 16 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    color: theme.textFaint,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
