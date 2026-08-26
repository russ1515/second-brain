import { Platform, Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { ThemeToggle, LangPill } from '../auth/kit';
import { useSidebar, useIsRTL } from './app-shell';

/**
 * Responsive navigation for the FIVE spaces (UI/UX Sprint 7 — responsive native).
 *
 * ONE component, two forms, same 5-tab architecture:
 *  • Desktop (≥1024px): a permanent, collapsible vertical sidebar. Its width is
 *    lifted into the shell (useSidebar) so the workspace offset always tracks it,
 *    and it mirrors to the right edge under RTL.
 *  • Tablet / mobile (<1024px): the bottom navigation bar.
 * Driven by the real navigation state, so it stays in sync with routing.
 */
const META: Record<string, { icon: string; key: TranslationKey }> = {
  index: { icon: '🏠', key: 'tab.home' },
  learn: { icon: '📚', key: 'tab.learn' },
  brain: { icon: '🧠', key: 'tab.brain' },
  study: { icon: '📅', key: 'tab.study' },
  profile: { icon: '👤', key: 'tab.profile' },
};

export function ResponsiveTabBar(props: BottomTabBarProps) {
  const { width } = useResponsive();
  return width >= 1024 ? <Sidebar {...props} /> : <BottomBar {...props} />;
}

function items(props: BottomTabBarProps) {
  return props.state.routes
    .filter((r) => META[r.name])
    .map((route) => ({
      route,
      active: props.state.routes[props.state.index].key === route.key,
      meta: META[route.name],
      onPress: () => {
        const event = props.navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        const focused = props.state.routes[props.state.index].key === route.key;
        if (!focused && !event.defaultPrevented) props.navigation.navigate(route.name);
      },
    }));
}

// ── Desktop: collapsible sidebar ─────────────────────────────────────────────
function Sidebar(props: BottomTabBarProps) {
  const { colors: c, radius, spacing } = useTokens();
  const { t } = useI18n();
  const rtl = useIsRTL();
  const { collapsed, toggle, width } = useSidebar();
  const edge = rtl
    ? { right: 0 as const, borderLeftWidth: 1, borderLeftColor: c.borderSubtle }
    : { left: 0 as const, borderRightWidth: 1, borderRightColor: c.borderSubtle };
  return (
    <View
      accessibilityRole="tablist"
      style={{ position: 'absolute', top: 0, bottom: 0, width, backgroundColor: c.surface, padding: spacing.sm, gap: 4, zIndex: 10, ...edge }}
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={t(collapsed ? 'nav.expand' : 'nav.collapse')}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, minHeight: 44 }}
      >
        <Text style={{ fontSize: 18, color: c.textSecondary }}>{collapsed ? '☰' : rtl ? '⟩' : '⟨'}</Text>
        {!collapsed ? <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>SECOND BRAIN</Text> : null}
      </Pressable>

      {items(props).map(({ route, active, meta, onPress }) => (
        <Pressable
          key={route.key}
          onPress={onPress}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          accessibilityLabel={t(meta.key)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 12, paddingVertical: 11, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: active ? c.aiAccentSoft : 'transparent', minHeight: 44 }}
        >
          <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
          {!collapsed ? (
            <Text style={{ color: active ? c.aiAccent : c.textSecondary, fontSize: 15, fontWeight: active ? '700' : '500' }} numberOfLines={1}>
              {t(meta.key)}
            </Text>
          ) : null}
        </Pressable>
      ))}

      {/* bottom utility zone — reuses existing controls (§6) */}
      <View style={{ flex: 1 }} />
      <View style={{ gap: 8, alignItems: collapsed ? 'center' : 'stretch', borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: spacing.sm }}>
        {!collapsed ? <LangPill /> : null}
        <ThemeToggle />
      </View>
    </View>
  );
}

// ── Mobile / tablet: bottom bar ──────────────────────────────────────────────
function BottomBar(props: BottomTabBarProps) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingBottom: Platform.OS === 'ios' ? 22 : 8, paddingTop: 8 }}
    >
      {items(props).map(({ route, active, meta, onPress }) => (
        <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t(meta.key)}
          style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4, minHeight: 48, justifyContent: 'center' }}>
          <Text style={{ fontSize: 20, opacity: active ? 1 : 0.6 }}>{meta.icon}</Text>
          <Text style={{ color: active ? c.aiAccent : c.textMuted, fontSize: 10, fontWeight: active ? '700' : '500' }} numberOfLines={1}>{t(meta.key)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
