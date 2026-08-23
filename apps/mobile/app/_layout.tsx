import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth-context';
import { I18nProvider, useI18n } from '../lib/i18n';
import '../lib/locales'; // registers every generated UI dictionary (es/de/it/pt/hi/…)
import { QueryProvider } from '../lib/query';
import { ThemeProvider } from '../lib/design/theme';
import { theme } from '../lib/theme';

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
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.bg },
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
      <Stack.Screen name="library/[id]" options={{ title: t('header.document') }} />
      <Stack.Screen name="library/resource/[id]" options={{ title: t('header.resource') }} />
      <Stack.Screen name="library/workspace/[id]" options={{ title: t('header.workspace') }} />
      <Stack.Screen name="languages/index" options={{ title: t('header.languages') }} />
      <Stack.Screen name="languages/[id]" options={{ title: t('header.language') }} />
      <Stack.Screen name="scan" options={{ title: t('header.scan') }} />
      <Stack.Screen name="revision" options={{ title: t('header.revision') }} />
      <Stack.Screen name="progress" options={{ title: t('header.progress') }} />
      <Stack.Screen name="health" options={{ title: t('header.health') }} />
    </Stack>
  );
}
