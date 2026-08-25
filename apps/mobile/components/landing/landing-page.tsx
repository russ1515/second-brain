import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';

/**
 * Public marketing landing page (UI/UX Sprint 8, route `/` for logged-out
 * visitors). Theme-aware (light + dark) on the design system. It never gates the
 * app — the CTAs route to the auth flow (/sign-in), which keeps OTP/2FA intact:
 * `/` → /sign-in → OTP → /onboarding → home.
 */
export function LandingPage() {
  const { colors: c, radius, spacing } = useTokens();
  const { width, maxContentWidth } = useResponsive();
  const router = useRouter();
  const wide = width >= 900;
  const go = () => router.push('/sign-in');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* soft glow */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -140, left: '30%', width: 460, height: 460, borderRadius: 230, backgroundColor: c.aiAccent, opacity: 0.14, ...(Platform.OS === 'web' ? ({ filter: 'blur(110px)' } as unknown as ViewStyle) : {}) }} />

      <View style={{ maxWidth: maxContentWidth, width: '100%', alignSelf: 'center', paddingHorizontal: spacing.lg }}>
        {/* Nav */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md }}>
          <Text style={{ color: c.aiAccent, fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>🧠 SECOND BRAIN</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={go} accessibilityRole="button"><Text style={{ color: c.textSecondary, fontSize: 14, fontWeight: '700' }}>Se connecter</Text></Pressable>
        </View>

        {/* Hero */}
        <View style={{ alignItems: 'center', gap: 16, paddingTop: spacing.xl, paddingBottom: spacing.lg }}>
          <BrainViz color={c.aiAccent} nodeColor={c.primary} />
          <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>TON SYSTÈME D’APPRENTISSAGE PERSONNEL PROPULSÉ PAR L’IA</Text>
          <Text style={{ color: c.textPrimary, fontSize: wide ? 48 : 34, fontWeight: '900', textAlign: 'center', lineHeight: wide ? 54 : 40 }}>SECOND BRAIN</Text>
          <Text style={{ color: c.textPrimary, fontSize: wide ? 22 : 18, fontWeight: '700', textAlign: 'center' }}>Apprends plus intelligemment. Retiens plus longtemps. Maîtrise plus vite.</Text>
          <Text style={{ color: c.textSecondary, fontSize: 15, textAlign: 'center', maxWidth: 560, lineHeight: 22 }}>
            Un professeur particulier propulsé par l’IA qui construit ton cerveau numérique, se souvient de tout, et t’enseigne exactement ce dont tu as besoin, au bon moment.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
            <Pressable onPress={go} accessibilityRole="button" style={{ backgroundColor: c.primary, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 24, minHeight: 50, justifyContent: 'center' }}>
              <Text style={{ color: c.onPrimary, fontSize: 16, fontWeight: '800' }}>Commencer gratuitement</Text>
            </Pressable>
            <Pressable onPress={go} accessibilityRole="button" style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 24, minHeight: 50, justifyContent: 'center' }}>
              <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>Découvrir Second Brain</Text>
            </Pressable>
          </View>
        </View>

        {/* Why — value chain */}
        <Section c={c} title="Pourquoi Second Brain ?">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {[
              { icon: '📚', label: 'Apprentissage' },
              { icon: '🤖', label: 'IA' },
              { icon: '🧠', label: 'Mémoire' },
              { icon: '📈', label: 'Progression' },
            ].map((s, i, arr) => (
              <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ alignItems: 'center', gap: 4, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: c.surface }}>
                  <Text style={{ fontSize: 24 }}>{s.icon}</Text>
                  <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: '700' }}>{s.label}</Text>
                </View>
                {i < arr.length - 1 ? <Text style={{ color: c.aiAccent, fontSize: 18 }}>→</Text> : null}
              </View>
            ))}
          </View>
        </Section>

        {/* 5 pillars / features */}
        <Section c={c} title="Tes espaces intelligents">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {[
              { icon: '🧠', name: 'Mon Cerveau', d: 'Ton Digital Twin visuel : graphe de connaissances, forces et fragilités.' },
              { icon: '👨‍🏫', name: 'Professeur IA', d: 'Conversation, oral, examen — enseigne à ton niveau exact.' },
              { icon: '📚', name: 'Bibliothèque & OCR', d: 'PDF, photos, scans multi-pages → cours enseignables.' },
              { icon: '📅', name: 'Réviser (FSRS)', d: 'Répétition espacée qui ancre ce que tu apprends au bon moment.' },
              { icon: '🌍', name: 'Langues & Immersion', d: 'Vocabulaire, prononciation, Voice Shadowing, mobilité.' },
              { icon: '🎓', name: 'Academic Workspace', d: 'TP, devoirs, rapports — guidage, résolution, solution expliquée.' },
            ].map((f) => (
              <View key={f.name} style={{ width: wide ? '31%' : '100%', flexGrow: 1, minWidth: 240, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: spacing.md, gap: 6, backgroundColor: c.surface }}>
                <Text style={{ fontSize: 26 }}>{f.icon}</Text>
                <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '800' }}>{f.name}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>{f.d}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Pricing */}
        <Section c={c} title="Des offres pour chaque apprenant">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {[
              { name: 'Free', price: '0 €', d: 'Pour découvrir', feats: ['1 espace', 'Prof IA limité', 'Révisions FSRS'], hi: false },
              { name: 'Pro', price: '9 €', d: 'Pour progresser', feats: ['Tout illimité', 'Voice Shadowing', 'OCR multi-pages'], hi: true },
              { name: 'Pro Max', price: '19 €', d: 'Pour exceller', feats: ['Modèles avancés', 'Deep Search', 'Priorité IA'], hi: false },
              { name: 'Team', price: '29 €', d: 'Pour les groupes', feats: ['Espaces partagés', 'Suivi collectif', 'Admin'], hi: false },
              { name: 'School', price: 'Sur devis', d: 'Établissements', feats: ['Classes', 'Tableau de bord', 'SSO'], hi: false },
              { name: 'Enterprise', price: 'Sur devis', d: 'Grandes organisations', feats: ['SLA', 'Sécurité avancée', 'API'], hi: false },
            ].map((p) => (
              <View key={p.name} style={{ width: wide ? '31%' : '100%', flexGrow: 1, minWidth: 240, borderWidth: p.hi ? 2 : 1, borderColor: p.hi ? c.aiAccent : c.border, borderRadius: radius.lg, padding: spacing.md, gap: 8, backgroundColor: p.hi ? c.aiAccentSoft : c.surface }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: c.textPrimary, fontSize: 17, fontWeight: '800' }}>{p.name}</Text>
                  {p.hi ? <View style={{ backgroundColor: c.aiAccent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: c.onAiAccent, fontSize: 10, fontWeight: '800' }}>POPULAIRE</Text></View> : null}
                </View>
                <Text style={{ color: c.textPrimary, fontSize: 24, fontWeight: '900' }}>{p.price}<Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>{p.price.includes('€') && p.price !== '0 €' ? ' /mois' : ''}</Text></Text>
                <Text style={{ color: c.textMuted, fontSize: 13 }}>{p.d}</Text>
                <View style={{ gap: 4, marginTop: 4 }}>
                  {p.feats.map((ft) => <Text key={ft} style={{ color: c.textSecondary, fontSize: 13 }}>✓ {ft}</Text>)}
                </View>
                <Pressable onPress={go} style={{ marginTop: 6, backgroundColor: p.hi ? c.primary : 'transparent', borderWidth: p.hi ? 0 : 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ color: p.hi ? c.onPrimary : c.textPrimary, fontSize: 14, fontWeight: '700' }}>Choisir</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Section>

        {/* Footer */}
        <View style={{ borderTopWidth: 1, borderTopColor: c.borderSubtle, marginTop: spacing.xl, paddingTop: spacing.lg, gap: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {['Documentation', 'Blog', 'Support', 'CGU', 'Confidentialité', 'API', 'Carrières'].map((l) => (
              <Text key={l} style={{ color: c.textMuted, fontSize: 13 }}>{l}</Text>
            ))}
          </View>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>© 2026 Second Brain — Ton système d’exploitation d’apprentissage personnel propulsé par l’IA.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Section({ c, title, children }: { c: ReturnType<typeof useTokens>['colors']; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 14, paddingVertical: 28 }}>
      <Text style={{ color: c.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      {children}
    </View>
  );
}

// ── Interactive/evolving digital-brain visualization (Canvas-free) ───────────
export function BrainViz({ color, nodeColor }: { color: string; nodeColor: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const nodes = [
    { x: 90, y: 20 }, { x: 40, y: 60 }, { x: 140, y: 55 }, { x: 70, y: 100 }, { x: 120, y: 105 }, { x: 90, y: 62 },
  ];
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <View style={{ width: 200, height: 140 }}>
      {nodes.map((n, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: n.x - 7, top: n.y - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: i === 5 ? color : nodeColor, opacity, transform: [{ scale: i === 5 ? scale : 1 }] }} />
      ))}
      {/* central glow node */}
      <Animated.View style={{ position: 'absolute', left: 90 - 22, top: 62 - 22, width: 44, height: 44, borderRadius: 22, backgroundColor: color, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] }), transform: [{ scale }] }} />
    </View>
  );
}
