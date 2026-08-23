import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { LearningCategory, OnboardingState } from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import {
  CAPABILITIES,
  MODES,
  START_ENTRIES,
  learnPersona,
  type CapabilityKey,
} from '../../lib/learn/catalog';
import {
  CapabilityCard,
  LearningModeSelector,
  UniversalStartBar,
} from '../../components/learn/components';

/**
 * 📚 Apprendre — the intelligent pedagogical workspace (UI/UX Sprint 4).
 *
 * The visible heart of Second Brain: everything a learner wants to learn,
 * understand or work on can begin here. It presents the SIX capabilities
 * (Conversation, Langues, Cours, Bibliothèque, Travaux/Academic Workspace,
 * Évaluations) — never a seventh main tab — the pedagogical MODES, and a
 * universal entry that converges any input onto the AI teacher. Order and tone
 * adapt to the KYC persona (Sprint 2). It routes into existing engines; no new
 * business logic lives here.
 */
export default function LearnScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { colors: c } = useTokens();
  const { width, maxContentWidth } = useResponsive();
  const [category, setCategory] = useState<LearningCategory | undefined>(undefined);
  const [mode, setMode] = useState<(typeof MODES)[number]['key'] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      api<OnboardingState>('/onboarding')
        .then((s) => { if (!cancelled) setCategory(s.answers.education?.category ?? undefined); })
        .catch(() => undefined);
      return () => { cancelled = true; };
    }, [user]),
  );

  const persona = learnPersona(category ?? null);
  const wide = width >= 760;

  // Capabilities in the persona's priority order.
  const byKey = new Map<CapabilityKey, (typeof CAPABILITIES)[number]>(CAPABILITIES.map((cap) => [cap.key, cap]));
  const ordered = persona.order.map((k) => byKey.get(k)!).filter(Boolean);
  // Lead the mode selector with the persona's primary mode.
  const modes = [...MODES].sort((a, b) => (a.key === persona.primaryMode ? -1 : b.key === persona.primaryMode ? 1 : 0));

  const openCapability = (route: string) => router.push(route as never);
  const selectMode = (m: (typeof MODES)[number]) => {
    setMode(m.key);
    router.push({ pathname: m.route as never, params: { mode: m.mode } as never });
  };
  const onText = (text: string) => router.push({ pathname: '/tutor' as never, params: { q: text } as never });
  const onPick = (e: (typeof START_ENTRIES)[number]) => router.push(e.route as never);

  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.textPrimary, fontSize: 30, fontWeight: '800' }}>📚 Apprendre</Text>
        <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 22 }}>{persona.intro}</Text>
      </View>

      {/* Convergence — everything can begin here */}
      <UniversalStartBar entries={START_ENTRIES} onText={onText} onPick={onPick} />

      {/* Pedagogical modes (4.1) */}
      <View style={{ gap: 10 }}>
        <SectionLabel>{t('learn.section.modes')}</SectionLabel>
        <LearningModeSelector modes={modes} value={mode} onSelect={selectMode} />
      </View>

      {/* The six capabilities — order adapts to the KYC persona */}
      <View style={{ gap: 10 }}>
        <SectionLabel>Tes capacités d’apprentissage</SectionLabel>
        {wide ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {ordered.map((cap) => (
              <View key={cap.key} style={{ width: '48%', flexGrow: 1 }}>
                <CapabilityCard capability={cap} onOpen={() => openCapability(cap.route)} />
              </View>
            ))}
          </View>
        ) : (
          ordered.map((cap) => <CapabilityCard key={cap.key} capability={cap} onOpen={() => openCapability(cap.route)} />)
        )}
      </View>

      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
        Academic Workspace, langues, évaluations et bibliothèque vivent ici, dans Apprendre.
      </Text>
    </ScrollView>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  const { colors: c } = useTokens();
  return (
    <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, width: '100%', alignSelf: 'center', paddingBottom: 48 },
});
