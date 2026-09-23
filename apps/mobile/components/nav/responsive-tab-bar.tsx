import { Platform, Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ParentSpace } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { PRIMARY_SPACES } from '../../lib/navigation';
import { ThemeToggle, LangPill } from '../auth/kit';
import { useSidebar, useIsRTL } from './sidebar-context';

interface NavigationItem {
  key: string;
  icon: string;
  labelKey: TranslationKey;
  active: boolean;
  onPress: () => void;
}

const TAB_META: Record<string, { space: ParentSpace; icon: string; labelKey: TranslationKey }> = {
  index: { space: 'home', icon: '🏠', labelKey: 'tab.home' },
  learn: { space: 'learn', icon: '📚', labelKey: 'tab.learn' },
  brain: { space: 'brain', icon: '🧠', labelKey: 'tab.brain' },
  study: { space: 'study', icon: '📅', labelKey: 'tab.study' },
  profile: { space: 'profile', icon: '👤', labelKey: 'tab.profile' },
};

/** Existing Tabs adapter. Kept intact as the instant per-route rollback path. */
export function ResponsiveTabBar(props: BottomTabBarProps) {
  const currentKey = props.state.routes[props.state.index]?.key;
  const items = props.state.routes.flatMap((route): NavigationItem[] => {
    const meta = TAB_META[route.name];
    if (!meta) return [];
    return [{
      key: route.key,
      icon: meta.icon,
      labelKey: meta.labelKey,
      active: currentKey === route.key,
      onPress: () => {
        const event = props.navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (currentKey !== route.key && !event.defaultPrevented) props.navigation.navigate(route.name);
      },
    }];
  });
  return <ResponsiveNavigation items={items} />;
}

/** Route-aware navigation shared by every user experience in the new shell. */
export function PrimaryNavigation({
  activeSpace,
  onNavigate,
}: {
  activeSpace: ParentSpace | null;
  onNavigate: (href: string) => void;
}) {
  const items: NavigationItem[] = PRIMARY_SPACES.map((entry) => ({
    key: entry.space,
    icon: entry.icon,
    labelKey: entry.labelKey,
    active: entry.space === activeSpace,
    onPress: () => onNavigate(entry.href),
  }));
  return <ResponsiveNavigation items={items} />;
}

function ResponsiveNavigation({ items }: { items: NavigationItem[] }) {
  const { width } = useResponsive();
  return width >= 1024 ? <Sidebar items={items} /> : <BottomBar items={items} />;
}

function Sidebar({ items }: { items: NavigationItem[] }) {
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

      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.active }}
          accessibilityLabel={t(item.labelKey)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 12, paddingVertical: 11, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: item.active ? c.aiAccentSoft : 'transparent', minHeight: 44 }}
        >
          <Text accessible={false} style={{ fontSize: 18 }}>{item.icon}</Text>
          {!collapsed ? (
            <Text style={{ color: item.active ? c.aiAccent : c.textSecondary, fontSize: 15, fontWeight: item.active ? '700' : '500' }} numberOfLines={1}>
              {t(item.labelKey)}
            </Text>
          ) : null}
        </Pressable>
      ))}

      <View style={{ flex: 1 }} />
      <View style={{ gap: 8, alignItems: collapsed ? 'center' : 'stretch', borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: spacing.sm }}>
        {!collapsed ? <LangPill /> : null}
        <ThemeToggle />
      </View>
    </View>
  );
}

function BottomBar({ items }: { items: NavigationItem[] }) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingBottom: Platform.OS === 'ios' ? 22 : 8, paddingTop: 8 }}
    >
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.active }}
          accessibilityLabel={t(item.labelKey)}
          style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4, minHeight: 48, justifyContent: 'center' }}
        >
          <Text accessible={false} style={{ fontSize: 20, opacity: item.active ? 1 : 0.6 }}>{item.icon}</Text>
          <Text style={{ color: item.active ? c.aiAccent : c.textMuted, fontSize: 10, fontWeight: item.active ? '700' : '500' }} numberOfLines={1}>
            {t(item.labelKey)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
