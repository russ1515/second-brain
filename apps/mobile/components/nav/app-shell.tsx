import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { RouteCategory, RouteMetadata } from '@second-brain/shared';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { primarySpace, routeTitleKey } from '../../lib/navigation';
import { PrimaryNavigation } from './responsive-tab-bar';
import { useIsRTL, useSidebar } from './sidebar-context';

export { SidebarProvider, useIsRTL, useSidebar } from './sidebar-context';

/**
 * Global App-Shell state (Desktop SaaS layout).
 *
 * The desktop sidebar can be expanded or collapsed. That single piece of state
 * is lifted here so BOTH the sidebar (which renders it) and the tabs layout
 * (which offsets the main workspace by the sidebar's width) stay in sync — the
 * main content always begins exactly where the sidebar ends, at either width.
 * The choice is persisted per browser so it survives navigation and reloads.
 */

/**
 * Stable root boundary: the Stack always remains at the same place in the React
 * tree while route chrome changes around it. This prevents shell transitions
 * (user → admin, enabled → rollback) from resetting navigation state.
 */
export function RouteShellBoundary({
  metadata,
  enabled,
  authenticated,
  children,
}: {
  metadata?: RouteMetadata;
  enabled: boolean;
  authenticated: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { colors: c } = useTokens();
  const { width } = useResponsive();
  const rtl = useIsRTL();
  const { width: sidebarWidth } = useSidebar();
  const userShell = Boolean(
    enabled
    && authenticated
    && metadata
    && (metadata.category === 'USER' || metadata.category === 'LEGACY')
    && metadata.path !== '/onboarding',
  );
  const internalShell = Boolean(
    enabled
    && authenticated
    && metadata
    && (metadata.category === 'ADMIN' || metadata.category === 'TECH' || metadata.category === 'DEMO'),
  );
  const desktop = width >= 1024;
  const showPrimaryNavigation = Boolean(userShell && (desktop || !metadata?.immersive));
  const sceneOffset = userShell && desktop
    ? rtl
      ? { paddingRight: sidebarWidth }
      : { paddingLeft: sidebarWidth }
    : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {internalShell && metadata ? <InternalChrome metadata={metadata} /> : null}
      <View style={[{ flex: 1, minWidth: 0 }, sceneOffset]}>
        {userShell && metadata && (metadata.shellMode === 'secondary' || metadata.shellMode === 'focused') ? (
          <RouteChrome metadata={metadata} />
        ) : null}
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      </View>
      {showPrimaryNavigation && metadata ? (
        <PrimaryNavigation
          activeSpace={metadata.parentSpace}
          onNavigate={(href) => router.navigate(href)}
        />
      ) : null}
    </View>
  );
}

function RouteChrome({ metadata }: { metadata: RouteMetadata }) {
  const router = useRouter();
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const { contentPadding, maxContentWidth, mode } = useResponsive();
  const rtl = useIsRTL();
  const parent = primarySpace(metadata.parentSpace);
  if (!parent) return null;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(parent.href);
  };
  const title = t(routeTitleKey(metadata));
  const parentLabel = t(parent.labelKey);

  return (
    <View style={{ backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}>
      <View
        style={{
          width: '100%',
          maxWidth: maxContentWidth,
          alignSelf: 'center',
          minHeight: 54,
          paddingHorizontal: contentPadding,
          paddingVertical: spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel={`${t('nav.back')} · ${parentLabel}`}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: c.textSecondary, fontSize: 20 }}>{rtl ? '→' : '←'}</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Pressable
            onPress={() => router.navigate(parent.href)}
            accessibilityRole="link"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={[typography.bodySmall, { color: c.primary, fontWeight: '700' }]} numberOfLines={1}>
              {parentLabel}
            </Text>
          </Pressable>
          <Text accessible={false} style={[typography.bodySmall, { color: c.textMuted }]}>{rtl ? '‹' : '›'}</Text>
          <Text
            accessibilityRole="header"
            style={[mode === 'compact' ? typography.bodySmall : typography.title, { color: c.textPrimary, flexShrink: 1 }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
}

const INTERNAL_LABELS: Record<Exclude<RouteCategory, 'USER' | 'LEGACY'>, 'shell.adminArea' | 'shell.technicalArea' | 'shell.demoArea'> = {
  ADMIN: 'shell.adminArea',
  TECH: 'shell.technicalArea',
  DEMO: 'shell.demoArea',
};

function InternalChrome({ metadata }: { metadata: RouteMetadata }) {
  const router = useRouter();
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  const { contentPadding, maxContentWidth, mode } = useResponsive();
  const labelKey = metadata.category === 'LEGACY' || metadata.category === 'USER'
    ? 'shell.legacyArea'
    : INTERNAL_LABELS[metadata.category];

  return (
    <View style={{ backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}>
      <View
        style={{
          width: '100%', maxWidth: maxContentWidth, alignSelf: 'center',
          paddingHorizontal: contentPadding, paddingVertical: spacing.sm,
          flexDirection: mode === 'compact' ? 'column' : 'row',
          alignItems: mode === 'compact' ? 'stretch' : 'center',
          justifyContent: 'space-between', gap: spacing.sm,
        }}
      >
        <View style={{ minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text style={[typography.label, { color: c.aiAccent }]}>{t(labelKey).toLocaleUpperCase()}</Text>
            <View style={{ width: 4, height: 4, borderRadius: radius.full, backgroundColor: c.borderStrong }} />
            <Text style={[typography.label, { color: c.textMuted }]}>SECOND BRAIN</Text>
          </View>
          <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]} numberOfLines={1}>
            {t(routeTitleKey(metadata))}
          </Text>
        </View>
        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="link"
          style={{ minHeight: 44, justifyContent: 'center', alignSelf: mode === 'compact' ? 'flex-start' : 'center' }}
        >
          <Text style={[typography.bodySmall, { color: c.primary, fontWeight: '700' }]}>{t('shell.backToApp')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
