import { Redirect, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet } from 'react-native';
import { routeMetadataFor } from '@second-brain/shared';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { I18nProvider, useI18n } from '../lib/i18n';
import '../lib/locales'; // registers every generated UI dictionary (es/de/it/pt/hi/…)
import { QueryProvider } from '../lib/query';
import { ThemeProvider, useTokens } from '../lib/design/theme';
import { Button, Empty } from '../components/ui';
import { SmartLoadingState } from '../components/ds/states';
import { RouteShellBoundary, SidebarProvider } from '../components/nav/app-shell';
import { newAppShellEnabledForPath } from '../lib/navigation';
import { setSafeCurrentRoute } from '../lib/client-diagnostics';

// Zero-blank-page (§35): any render error in any screen falls back to a
// localized, on-brand recovery UI with a working retry — never a white screen.
export { AppErrorBoundary as ErrorBoundary } from '../components/error-boundary';

export default function RootLayout() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <Navigator />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

/** Split out so the header titles can read the current locale via useI18n —
 *  the hook must run under I18nProvider, which RootLayout itself renders. */
function Navigator() {
  const { t } = useI18n();
  const { colors: c } = useTokens();
  const pathname = usePathname();
  const metadata = routeMetadataFor(pathname);
  const shellEnabled = newAppShellEnabledForPath(pathname);
  const { user, loading, offline, onboarded, retry, logout } = useAuth();

  // Keeps only a normalized route name for safe client diagnostics. It never
  // stores query values or dynamic resource identifiers.
  useEffect(() => {
    setSafeCurrentRoute(pathname);
  }, [pathname]);

  if (shellEnabled && metadata?.requiresAuth && loading) {
    return <SmartLoadingState title={t('classroom.opening')} />;
  }

  // A stored session remains intact while the API is unreachable. This guard
  // now also protects direct links outside the five-tab navigator.
  const routeCanUseCache = pathname === '/library' || pathname === '/brain';
  if (shellEnabled && metadata?.requiresAuth && offline && !routeCanUseCache) {
    return (
      <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.offline}>
        <Empty title={t('classroom.offlineTitle')} detail={t('classroom.offlineDetail')} />
        <Button label={t('app.tryAgain')} onPress={retry} />
        <Button variant="ghost" label={t('app.signOut')} onPress={logout} />
      </ScrollView>
    );
  }

  if (shellEnabled && metadata?.requiresAuth && !user) {
    return <Redirect href={{ pathname: '/sign-in', params: { returnTo: pathname } }} />;
  }

  const userExperience = metadata?.category === 'USER' || metadata?.category === 'LEGACY';
  if (shellEnabled && user && userExperience && onboarded === false && metadata?.path !== '/onboarding') {
    return <Redirect href={{ pathname: '/onboarding', params: { returnTo: pathname } }} />;
  }

  return (
    <SidebarProvider>
      <RouteShellBoundary metadata={metadata} enabled={shellEnabled} authenticated={Boolean(user)}>
        <Stack
          screenOptions={{
            ...(shellEnabled ? { headerShown: false } : {}),
            headerStyle: { backgroundColor: c.background },
            headerTintColor: c.textPrimary,
            contentStyle: { backgroundColor: c.background },
          }}
        >
          {/* The five spaces. They own their own headers, so no outer one. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Full-screen, outside the tabs. Brand name — not translated. */}
          <Stack.Screen name="sign-in" options={{ title: 'Second Brain' }} />
          {/* Universal KYC / onboarding (UI/UX Sprint 2). Owns its own chrome. */}
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          {/* Detail screens pushed on top of a space (tab bar hidden). */}
          <Stack.Screen name="lesson/[id]" options={{ title: t('header.lesson') }} />
          <Stack.Screen name="lesson/new" options={{ title: t('header.newLesson') }} />
          <Stack.Screen name="tutor/index" options={{ title: t('header.aiTeacher') }} />
          <Stack.Screen name="tutor/[id]" options={{ title: t('header.teacher') }} />
          <Stack.Screen name="homework/[lessonId]" options={{ title: t('header.homework') }} />
          <Stack.Screen name="session/[id]" options={{ title: t('header.session') }} />
          <Stack.Screen name="twin-profile" options={{ title: t('header.twin') }} />
          <Stack.Screen name="memory" options={{ title: t('header.memory') }} />
          <Stack.Screen name="mastery" options={{ title: t('header.mastery') }} />
          <Stack.Screen name="graph" options={{ title: t('header.graph') }} />
          <Stack.Screen name="strengths" options={{ title: t('header.strengths') }} />
          <Stack.Screen name="insights" options={{ title: t('header.insights') }} />
          <Stack.Screen name="recommendations" options={{ title: t('header.recommend') }} />
          <Stack.Screen name="revision-engine" options={{ title: t('header.revEngine') }} />
          <Stack.Screen name="planner" options={{ title: t('header.planner') }} />
          <Stack.Screen name="daily-session" options={{ title: t('header.daily') }} />
          <Stack.Screen name="calendar" options={{ title: t('header.calendar') }} />
          <Stack.Screen name="predictions" options={{ title: t('header.predictions') }} />
          <Stack.Screen name="notifications" options={{ title: t('header.notifications') }} />
          <Stack.Screen name="adaptive-path" options={{ title: t('header.adaptivePath') }} />
          <Stack.Screen name="goals" options={{ title: t('header.goals') }} />
          <Stack.Screen name="exams" options={{ title: t('header.exams') }} />
          <Stack.Screen name="library" options={{ title: t('header.library') }} />
          <Stack.Screen name="library/ask" options={{ title: t('header.ask') }} />
          <Stack.Screen name="research" options={{ title: t('research10.title') }} />
          <Stack.Screen name="library/[id]" options={{ title: t('header.document') }} />
          <Stack.Screen name="library/resource/[id]" options={{ title: t('header.resource') }} />
          <Stack.Screen name="library/workspace/[id]" options={{ title: t('header.workspace') }} />
          <Stack.Screen name="library/workspace/index" options={{ title: t('header.workspace') }} />
          <Stack.Screen name="languages/index" options={{ title: t('header.languages') }} />
          <Stack.Screen name="languages/[id]" options={{ title: t('header.language') }} />
          <Stack.Screen name="languages/[id]/course/index" options={{ title: t('header.language') }} />
          <Stack.Screen name="languages/[id]/course/lesson" options={{ title: t('header.language') }} />
          <Stack.Screen name="languages/[id]/course/missions" options={{ title: t('header.language') }} />
          <Stack.Screen name="languages/[id]/course/can-do" options={{ title: t('header.language') }} />
          <Stack.Screen name="scan" options={{ title: t('header.scan') }} />
          <Stack.Screen name="revision" options={{ title: t('header.revision') }} />
          <Stack.Screen name="progress" options={{ title: t('header.progress') }} />
          <Stack.Screen name="health" options={{ title: t('header.health') }} />
          <Stack.Screen name="report-problem" options={{ title: t('report.title') }} />
        </Stack>
      </RouteShellBoundary>
    </SidebarProvider>
  );
}

const styles = StyleSheet.create({
  offline: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 12,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
});
