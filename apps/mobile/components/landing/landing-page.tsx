import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { LangPill } from '../auth/kit';

const k = (s: string) => s as TranslationKey;
const webOnly = (style: Record<string, unknown>): ViewStyle =>
  (Platform.OS === 'web' ? style : {}) as unknown as ViewStyle;

/** Locales that read right-to-left; the landing mirrors its layout for these. */
const RTL_LOCALES = new Set(['ar', 'fa', 'he', 'ur']);
function useRTL(): boolean {
  const { locale } = useI18n();
  return RTL_LOCALES.has(locale as string);
}

/** SaaS-desktop content width — wide enough to fill large screens without
 *  over-stretching lines (≈ Tailwind max-w-7xl, room to breathe up to 1440). */
const CONTENT_MAX = 1280;
/** Responsive gutter, mirroring `px-4 sm:px-6 lg:px-8`. */
function useGutter(): number {
  const { width } = useResponsive();
  return width >= 1024 ? 32 : width >= 640 ? 24 : 16;
}

/** Respect the OS "reduce motion" setting on web; assume motion allowed elsewhere. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/**
 * Public marketing landing page (route `/` for logged-out visitors).
 *
 * Tells the Second Brain story — "Activate your Digital Twin" — from capture to
 * progression, positioning the product as a Personal Learning OS rather than a
 * chatbot or note app. Theme-aware (light + dark) on the design tokens, fully
 * responsive, and every visible string flows through the i18n catalog
 * (`landing.*`). It never gates the app: both CTAs route to the existing auth
 * flow (`/sign-in`, which carries the register mode). No pricing, by design.
 */
export function LandingPage() {
  const { colors: c } = useTokens();
  const rtl = useRTL();
  const scrollRef = useRef<ScrollView>(null);
  const anchors = useRef<Record<string, number>>({});

  const onAnchor = (id: string) => (e: LayoutChangeEvent) => {
    anchors.current[id] = e.nativeEvent.layout.y;
  };
  const scrollTo = (id: string) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, (anchors.current[id] ?? 0) - 72), animated: true });
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={[{ flex: 1, backgroundColor: c.background }, webOnly({ direction: rtl ? 'rtl' : 'ltr' })]}
      contentContainerStyle={{ paddingBottom: 0 }}
      showsVerticalScrollIndicator={false}
    >
      <Header onNav={scrollTo} />
      <Hero onStart={undefined} onDiscover={() => scrollTo('features')} />

      <Anchored id="features" onAnchor={onAnchor}><Showcase /></Anchored>
      <Comparison />
      <Anchored id="how" onAnchor={onAnchor}><HowItWorks /></Anchored>
      <ContentToExperience />
      <Anchored id="professor" onAnchor={onAnchor}><Professor /></Anchored>
      <Anchored id="academic" onAnchor={onAnchor}><Academic /></Anchored>
      <Anchored id="languages" onAnchor={onAnchor}><Languages /></Anchored>
      <Kyc />
      <DigitalTwin />
      <Revision />
      <Pricing />
      <Anchored id="faq" onAnchor={onAnchor}><Faq /></Anchored>
      <FinalCta />
      <Footer />
    </ScrollView>
  );
}

function Anchored({ id, onAnchor, children }: { id: string; onAnchor: (id: string) => (e: LayoutChangeEvent) => void; children: ReactNode }) {
  return <View onLayout={onAnchor(id)}>{children}</View>;
}

// ── Shared layout primitives ─────────────────────────────────────────────────

function useGo() {
  const router = useRouter();
  return () => router.push('/sign-in');
}

function Shell({ children, tone }: { children: ReactNode; tone?: 'alt' }) {
  const { colors: c } = useTokens();
  const { width } = useResponsive();
  const gutter = useGutter();
  return (
    <View style={{ width: '100%', backgroundColor: tone === 'alt' ? c.surfaceSunken : 'transparent' }}>
      <View style={{ maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center', paddingHorizontal: gutter, paddingVertical: width >= 900 ? 72 : 48 }}>
        {children}
      </View>
    </View>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  const { colors: c } = useTokens();
  return <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' }}>{children}</Text>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  const { colors: c } = useTokens();
  const { width } = useResponsive();
  return <Text style={{ color: c.textPrimary, fontSize: width >= 900 ? 32 : 26, fontWeight: '900', lineHeight: width >= 900 ? 38 : 32 }}>{children}</Text>;
}

function Lead({ children }: { children: ReactNode }) {
  const { colors: c } = useTokens();
  return <Text style={{ color: c.textSecondary, fontSize: 16, lineHeight: 24, maxWidth: 640 }}>{children}</Text>;
}

function Chip({ label }: { label: string }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14 }}>
      <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** A horizontal (or wrapping) rail of labelled steps joined by arrows. */
function Rail({ steps, accent }: { steps: string[]; accent?: boolean }) {
  const { colors: c, radius } = useTokens();
  const rtl = useRTL();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {steps.map((s, i) => (
        <View key={`${s}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ borderWidth: 1, borderColor: accent ? c.aiAccent : c.border, backgroundColor: accent ? c.aiAccentSoft : c.surface, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12 }}>
            <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: '700' }}>{s}</Text>
          </View>
          {i < steps.length - 1 ? <Text style={{ color: accent ? c.aiAccent : c.textMuted, fontSize: 15, fontWeight: '800' }}>{rtl ? '←' : '→'}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function PrimaryCta({ label, compact }: { label: string; compact?: boolean }) {
  const { colors: c, radius } = useTokens();
  const go = useGo();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      onPress={go}
      accessibilityRole="button"
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{ backgroundColor: hover ? c.primaryHover : c.primary, borderRadius: radius.md, paddingVertical: compact ? 10 : 14, paddingHorizontal: compact ? 14 : 24, minHeight: compact ? 40 : 50, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text style={{ color: c.onPrimary, fontSize: compact ? 14 : 16, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function GhostCta({ label, onPress }: { label: string; onPress?: () => void }) {
  const { colors: c, radius } = useTokens();
  const go = useGo();
  return (
    <Pressable onPress={onPress ?? go} accessibilityRole="button" style={{ borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 24, minHeight: 50, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

// ── Header (sticky on web) ───────────────────────────────────────────────────

function Header({ onNav }: { onNav: (id: string) => void }) {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const gutter = useGutter();
  const { t } = useI18n();
  const go = useGo();
  const [menuOpen, setMenuOpen] = useState(false);
  const wide = width >= 900;
  // The centre nav + sign-in only appear once there is real room for all six
  // links beside the logo and the CTA; the signature needs even more. Below
  // that they hide (rather than crushing the logo block) — the CTA stays. At
  // tablet / small-desktop widths a ☰ menu keeps the nav reachable.
  const roomy = width >= 1080;
  const showSig = width >= 1240;
  const showBurger = width >= 768 && !roomy;
  const nav: [string, string][] = [
    ['features', 'landing.nav.features'],
    ['how', 'landing.nav.how'],
    ['professor', 'landing.nav.professor'],
    ['academic', 'landing.nav.academic'],
    ['languages', 'landing.nav.languages'],
    ['faq', 'landing.nav.faq'],
  ];
  return (
    <View style={[{ width: '100%', backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.borderSubtle, zIndex: 50 }, webOnly({ position: 'sticky', top: 0, backdropFilter: 'saturate(140%) blur(8px)' })]}>
      <View style={{ maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center', paddingHorizontal: wide ? gutter : 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: wide ? 16 : 6 }}>
        <View style={{ flexShrink: 1 }}>
          <Text numberOfLines={1} style={{ color: c.aiAccent, fontSize: wide ? 16 : 15, fontWeight: '900', letterSpacing: 0.3 }}>🧠 {t(k('landing.brand'))}</Text>
          {showSig ? <Text numberOfLines={1} style={{ color: c.textMuted, fontSize: 11, fontWeight: '600' }}>{t(k('landing.signature'))}</Text> : null}
        </View>
        <View style={{ flex: 1, minWidth: 6 }} />
        {roomy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            {nav.map(([id, key]) => (
              <Pressable key={id} onPress={() => onNav(id)} accessibilityRole="link">
                <Text numberOfLines={1} style={{ color: c.textSecondary, fontSize: 14, fontWeight: '600' }}>{t(k(key))}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={{ width: roomy ? 18 : 0 }} />
        <LangPill />
        {showBurger ? (
          <Pressable onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel={t(k('landing.nav.menu'))} style={{ paddingHorizontal: 8, paddingVertical: 8, minHeight: 40, justifyContent: 'center' }}>
            <Text style={{ color: c.textPrimary, fontSize: 20 }}>☰</Text>
          </Pressable>
        ) : null}
        {roomy ? (
          <Pressable onPress={go} accessibilityRole="button"><Text style={{ color: c.textSecondary, fontSize: 14, fontWeight: '700' }}>{t(k('landing.cta.signin'))}</Text></Pressable>
        ) : null}
        <PrimaryCta compact={!wide} label={t(k(wide ? 'landing.cta.start' : 'landing.cta.startShort'))} />
      </View>

      {/* ☰ menu drawer — keeps the nav reachable at tablet / small-desktop widths */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel={t(k('landing.nav.menu'))}>
          <Pressable
            onPress={() => {}}
            style={[{ marginTop: 60, marginHorizontal: 16, alignSelf: 'flex-end', minWidth: 240, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 8 }, webOnly({ boxShadow: '0 24px 60px -30px rgba(0,0,0,0.5)' })]}
          >
            {nav.map(([id, key]) => (
              <Pressable key={id} onPress={() => { setMenuOpen(false); onNav(id); }} accessibilityRole="link" style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.sm, minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '600' }}>{t(k(key))}</Text>
              </Pressable>
            ))}
            <View style={{ height: 1, backgroundColor: c.borderSubtle, marginVertical: 4 }} />
            <Pressable onPress={() => { setMenuOpen(false); go(); }} accessibilityRole="button" style={{ paddingVertical: 12, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: c.aiAccent, fontSize: 15, fontWeight: '700' }}>{t(k('landing.cta.signin'))}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ onDiscover }: { onStart?: () => void; onDiscover: () => void }) {
  const { colors: c } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const rtl = useRTL();
  const wide = width >= 900;
  const heroAlign = wide ? (rtl ? 'right' : 'left') : 'center';
  const gutter = useGutter();
  const reassure = [1, 2, 3, 4].map((n) => t(k(`landing.hero.reassure${n}`)));
  return (
    <View style={{ width: '100%', overflow: 'hidden' }}>
      {/* ambient glow */}
      <View pointerEvents="none" style={[{ position: 'absolute', top: -180, alignSelf: 'center', width: 660, height: 660, borderRadius: 330, backgroundColor: c.aiAccent, opacity: 0.12 }, webOnly({ filter: 'blur(150px)' })]} />
      <View style={{ maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center', paddingHorizontal: gutter, paddingTop: wide ? 84 : 44, paddingBottom: wide ? 72 : 40, flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 56 : 36 }}>
        <View style={{ flex: wide ? 1.05 : undefined, width: '100%', gap: 22, alignItems: wide ? 'flex-start' : 'center' }}>
          <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 }}>
            <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>✦ {t(k('landing.signature'))}</Text>
          </View>
          <Text style={{ color: c.textPrimary, fontSize: wide ? 56 : 36, fontWeight: '900', lineHeight: wide ? 62 : 42, textAlign: heroAlign }}>{t(k('landing.hero.title'))}</Text>
          <Text style={{ color: c.textSecondary, fontSize: wide ? 20 : 17, lineHeight: wide ? 30 : 25, maxWidth: 560, textAlign: heroAlign }}>{t(k('landing.hero.subtitle'))}</Text>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: wide ? 'flex-start' : 'center' }}>
            <PrimaryCta label={t(k('landing.cta.start'))} />
            <GhostCta label={t(k('landing.cta.discover'))} onPress={onDiscover} />
          </View>
          {/* reassurance signals */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: wide ? 'flex-start' : 'center' }}>
            {reassure.map((r) => (
              <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: c.success, fontSize: 13, fontWeight: '800' }}>✓</Text>
                <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }}>{r}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flex: wide ? 1 : undefined, width: '100%', maxWidth: wide ? undefined : 480, alignSelf: 'center' }}>
          <OsMockup />
        </View>
      </View>
    </View>
  );
}

/** The large "Second Brain OS" product window — the hero's visual anchor.
 *  Suggests the Digital Twin, Knowledge Graph, AI Professor and progression at
 *  once, with restrained motion (node/typing pulse) that honours reduced-motion. */
function OsMockup() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(anim, { toValue: 0, duration: 1400, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, reduced]);

  return (
    <View style={[{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.xl, overflow: 'hidden' }, webOnly({ boxShadow: '0 40px 90px -50px rgba(0,0,0,0.55)' })]}>
      {/* window title bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.borderSubtle, backgroundColor: c.surfaceSunken }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((col) => (
            <View key={col} style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: col }} />
          ))}
        </View>
        <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginStart: 12 }}>{t(k('landing.mock.os'))}</Text>
      </View>
      <View style={{ padding: 16, gap: 14 }}>
        {/* My Brain — knowledge graph */}
        <View style={{ borderWidth: 1, borderColor: c.borderSubtle, backgroundColor: c.surface, borderRadius: radius.lg, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 15 }}>🧠</Text>
            <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: '800' }}>{t(k('landing.mock.brain'))}</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700' }}>{t(k('landing.flow.graph'))}</Text>
          </View>
          <MiniGraph anim={anim} reduced={reduced} />
        </View>
        {/* AI Professor — chat */}
        <View style={{ borderWidth: 1, borderColor: c.borderSubtle, backgroundColor: c.surface, borderRadius: radius.lg, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 15 }}>👨‍🏫</Text>
            <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: '800' }}>{t(k('landing.mock.professor'))}</Text>
          </View>
          <View style={{ alignSelf: 'flex-start', maxWidth: '90%', backgroundColor: c.aiAccentSoft, borderColor: c.aiAccent, borderWidth: 1, borderRadius: radius.lg, paddingVertical: 9, paddingHorizontal: 12 }}>
            <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 19 }}>{t(k('landing.mock.msg'))}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingStart: 2 }}>
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: c.aiAccent,
                  opacity: reduced
                    ? 0.5
                    : anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: i === 1 ? [0.3, 1, 0.3] : [1, 0.3, 1] }),
                }}
              />
            ))}
          </View>
        </View>
        {/* memory / progress / mastery */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatBar label={t(k('landing.mock.memory'))} value={0.82} color={c.aiAccent} />
          <StatBar label={t(k('landing.mock.progress'))} value={0.64} color={c.primary} />
          <StatBar label={t(k('landing.mock.mastery'))} value={0.73} color={c.success} />
        </View>
      </View>
    </View>
  );
}

/** Small animated knowledge graph (nodes + edges) for the OS mockup. */
function MiniGraph({ anim, reduced }: { anim: Animated.Value; reduced: boolean }) {
  const { colors: c } = useTokens();
  const H = 118;
  const nodes = [
    { x: 34, y: 60, r: 9, accent: true },
    { x: 104, y: 26, r: 7 },
    { x: 116, y: 96, r: 7 },
    { x: 186, y: 52, r: 8 },
    { x: 250, y: 88, r: 6 },
    { x: 244, y: 22, r: 6 },
  ];
  const edges: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]];
  return (
    <View style={{ width: '100%', maxWidth: 280, height: H, alignSelf: 'center', position: 'relative', overflow: 'hidden' }}>
      {edges.map(([a, b], i) => {
        const n1 = nodes[a];
        const n2 = nodes[b];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const len = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        return (
          <View
            key={i}
            style={{ position: 'absolute', left: (n1.x + n2.x) / 2 - len / 2, top: (n1.y + n2.y) / 2 - 1, width: len, height: 2, backgroundColor: c.border, transform: [{ rotate: `${ang}rad` }] }}
          />
        );
      })}
      {nodes.map((n, i) => (
        <Animated.View
          key={i}
          style={{ position: 'absolute', left: n.x - n.r, top: n.y - n.r, width: n.r * 2, height: n.r * 2, borderRadius: n.r, backgroundColor: n.accent ? c.aiAccent : c.primary, opacity: reduced ? 0.9 : anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }}
        />
      ))}
    </View>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors: c } = useTokens();
  const pct = `${Math.round(value * 100)}%` as `${number}%`;
  return (
    <View style={{ flex: 1, gap: 5 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700' }}>{pct}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceSunken, overflow: 'hidden' }}>
        <View style={{ width: pct, height: '100%', backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

// ── "What changes" comparison ────────────────────────────────────────────────

function Comparison() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const wide = width >= 820;
  const classic = ['landing.compare.classic1', 'landing.compare.classic2', 'landing.compare.classic3', 'landing.compare.classic4', 'landing.compare.classic5'];
  const sb = ['landing.compare.sb1', 'landing.compare.sb2', 'landing.compare.sb3', 'landing.compare.sb4', 'landing.compare.sb5', 'landing.compare.sb6'];
  return (
    <Shell tone="alt">
      <View style={{ gap: 8, marginBottom: 20 }}>
        <Kicker>{t(k('landing.compare.title'))}</Kicker>
        <SectionTitle>{t(k('landing.compare.message'))}</SectionTitle>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.lg, padding: 18, gap: 10 }}>
          <Text style={{ color: c.textMuted, fontSize: 15, fontWeight: '800' }}>{t(k('landing.compare.classicTitle'))}</Text>
          {classic.map((key) => (
            <View key={key} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>•</Text>
              <Text style={{ color: c.textSecondary, fontSize: 14 }}>{t(k(key))}</Text>
            </View>
          ))}
          <View style={{ marginTop: 6 }}><Rail steps={t(k('landing.compare.classicFlow')).split(' → ')} /></View>
        </View>
        <View style={{ flex: 1, borderWidth: 2, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.lg, padding: 18, gap: 10 }}>
          <Text style={{ color: c.aiAccent, fontSize: 15, fontWeight: '900' }}>{t(k('landing.compare.sbTitle'))}</Text>
          {sb.map((key) => (
            <View key={key} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text style={{ color: c.aiAccent, fontSize: 14, fontWeight: '800' }}>✓</Text>
              <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: '600' }}>{t(k(key))}</Text>
            </View>
          ))}
          <View style={{ marginTop: 6 }}><Rail steps={t(k('landing.compare.sbFlow')).split(' → ')} accent /></View>
        </View>
      </View>
    </Shell>
  );
}

// ── How it works (5 steps) ───────────────────────────────────────────────────

function HowItWorks() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const cols = width >= 1000 ? 5 : width >= 640 ? 3 : 1;
  const steps = [1, 2, 3, 4, 5];
  const icons = ['📥', '🧩', '👨‍🏫', '🧠', '📈'];
  return (
    <Shell>
      <View style={{ gap: 8, marginBottom: 20 }}>
        <Kicker>{t(k('landing.nav.how'))}</Kicker>
        <SectionTitle>{t(k('landing.how.title'))}</SectionTitle>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {steps.map((n, i) => (
          <View key={n} style={{ width: cols === 1 ? '100%' : undefined, flexGrow: 1, flexBasis: cols === 1 ? '100%' : cols === 3 ? '30%' : '17%', minWidth: cols === 1 ? undefined : 160, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, padding: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 22 }}>{icons[i]}</Text>
              <Text style={{ color: c.aiAccent, fontSize: 13, fontWeight: '900' }}>0{n}</Text>
            </View>
            <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '800' }}>{t(k(`landing.how.s${n}.title`))}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>{t(k(`landing.how.s${n}.desc`))}</Text>
          </View>
        ))}
      </View>
    </Shell>
  );
}

// ── One content → a learning experience ──────────────────────────────────────

function ContentToExperience() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const steps = ['landing.exp.s1', 'landing.exp.s2', 'landing.exp.s3', 'landing.exp.s4', 'landing.exp.s5', 'landing.exp.s6', 'landing.exp.s7', 'landing.exp.s8'].map((key) => t(k(key)));
  return (
    <Shell tone="alt">
      <View style={{ gap: 8, marginBottom: 20 }}>
        <Kicker>{t(k('landing.exp.title'))}</Kicker>
        <Lead>{t(k('landing.exp.lead'))}</Lead>
      </View>
      <Rail steps={steps} accent />
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
        <View style={{ borderWidth: 2, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 18 }}>
          <Text style={{ color: c.aiAccent, fontSize: 14, fontWeight: '800' }}>▶ {t(k('landing.exp.actionLearn'))}</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 18 }}>
          <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: '700' }}>🤝 {t(k('landing.exp.actionSolve'))}</Text>
        </View>
      </View>
    </Shell>
  );
}

// ── Interactive product showcase (scrollable tabs) ───────────────────────────

function Showcase() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const tabs = [
    { id: 'brain', tab: 'landing.showcase.brain.tab', title: 'landing.showcase.brain.title', desc: 'landing.showcase.brain.desc' },
    { id: 'professor', tab: 'landing.showcase.professor.tab', title: 'landing.showcase.professor.title', desc: 'landing.showcase.professor.desc' },
    { id: 'search', tab: 'landing.showcase.search.tab', title: 'landing.showcase.search.title', desc: 'landing.showcase.search.desc' },
    { id: 'documents', tab: 'landing.showcase.documents.tab', title: 'landing.showcase.documents.title', desc: 'landing.showcase.documents.desc' },
    { id: 'voice', tab: 'landing.showcase.voice.tab', title: 'landing.showcase.voice.title', desc: 'landing.showcase.voice.desc' },
    { id: 'academic', tab: 'landing.showcase.academic.tab', title: 'landing.showcase.academic.title', desc: 'landing.showcase.academic.desc' },
    { id: 'revise', tab: 'landing.showcase.revise.tab', title: 'landing.showcase.revise.title', desc: 'landing.showcase.revise.desc' },
  ];
  const [active, setActive] = useState(0);
  const cur = tabs[active];
  return (
    <Shell>
      <View style={{ gap: 8, marginBottom: 18 }}>
        <Kicker>{t(k('landing.nav.features'))}</Kicker>
        <SectionTitle>{t(k('landing.showcase.title'))}</SectionTitle>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {tabs.map((tb, i) => {
          const on = i === active;
          return (
            <Pressable key={tb.id} onPress={() => setActive(i)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ borderWidth: 1, borderColor: on ? c.aiAccent : c.border, backgroundColor: on ? c.aiAccentSoft : c.surfaceElevated, borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' }}>
              <Text style={{ color: on ? c.aiAccent : c.textSecondary, fontSize: 13, fontWeight: '700' }}>{t(k(tb.tab))}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ marginTop: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, padding: 22, gap: 10, minHeight: 150 }}>
        <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{t(k(cur.title))}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 23, maxWidth: 640 }}>{t(k(cur.desc))}</Text>
      </View>
    </Shell>
  );
}

// ── AI Professor ─────────────────────────────────────────────────────────────

function Professor() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const adapts = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => t(k(`landing.professor.a${n}`)));
  const modes = [1, 2, 3, 4, 5, 6].map((n) => t(k(`landing.professor.m${n}`)));
  return (
    <Shell tone="alt">
      <View style={{ gap: 8, marginBottom: 18 }}>
        <Kicker>{t(k('landing.nav.professor'))}</Kicker>
        <SectionTitle>{t(k('landing.professor.title'))}</SectionTitle>
        <Lead>{t(k('landing.professor.lead'))}</Lead>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {adapts.map((a) => <Chip key={a} label={a} />)}
      </View>
      <View style={{ marginTop: 22, gap: 10 }}>
        <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>{t(k('landing.professor.modesTitle'))}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {modes.map((m) => (
            <View key={m} style={{ borderWidth: 1, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14 }}>
              <Text style={{ color: c.aiAccent, fontSize: 13, fontWeight: '700' }}>{m}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 8 }}><Rail steps={t(k('landing.professor.flow')).split(' → ')} /></View>
      </View>
    </Shell>
  );
}

// ── Academic Workspace ───────────────────────────────────────────────────────

function Academic() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const wide = width >= 820;
  const works = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => t(k(`landing.academic.w${n}`)));
  const modes = [1, 2, 3];
  return (
    <Shell>
      <View style={{ gap: 8, marginBottom: 16 }}>
        <View style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
          <Text style={{ color: c.aiAccent, fontSize: 11, fontWeight: '800' }}>{t(k('landing.academic.badge'))}</Text>
        </View>
        <SectionTitle>{t(k('landing.academic.title'))}</SectionTitle>
        <Lead>{t(k('landing.academic.lead'))}</Lead>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {works.map((w) => <Chip key={w} label={w} />)}
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14 }}>
        {modes.map((n) => (
          <View key={n} style={{ flex: 1, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, padding: 16, gap: 6 }}>
            <Text style={{ color: c.aiAccent, fontSize: 13, fontWeight: '900' }}>0{n}</Text>
            <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '800' }}>{t(k(`landing.academic.mode${n}.title`))}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>{t(k(`landing.academic.mode${n}.desc`))}</Text>
          </View>
        ))}
      </View>
    </Shell>
  );
}

// ── Languages & immersion ────────────────────────────────────────────────────

function Languages() {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const chips = [1, 2, 3, 4, 5, 6, 7].map((n) => t(k(`landing.languages.l${n}`)));
  const mob = [1, 2, 3, 4, 5].map((n) => t(k(`landing.languages.mob${n}`)));
  return (
    <Shell tone="alt">
      <View style={{ gap: 8, marginBottom: 18 }}>
        <Kicker>{t(k('landing.nav.languages'))}</Kicker>
        <SectionTitle>{t(k('landing.languages.title'))}</SectionTitle>
        <Lead>{t(k('landing.languages.lead'))}</Lead>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {chips.map((c2) => <Chip key={c2} label={c2} />)}
      </View>
      <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{t(k('landing.languages.mobilityTitle'))}</Text>
      <Rail steps={mob} accent />
    </Shell>
  );
}

// ── KYC — adaptation engine ──────────────────────────────────────────────────

function Kyc() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const cols = width >= 1000 ? 5 : width >= 640 ? 3 : 1;
  const profiles = [1, 2, 3, 4, 5];
  const icons = ['🎒', '🎓', '🔬', '📚', '🌍'];
  return (
    <Shell>
      <View style={{ gap: 8, marginBottom: 20 }}>
        <Kicker>KYC</Kicker>
        <SectionTitle>{t(k('landing.kyc.title'))}</SectionTitle>
        <Lead>{t(k('landing.kyc.lead'))}</Lead>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {profiles.map((n, i) => (
          <View key={n} style={{ width: cols === 1 ? '100%' : undefined, flexGrow: 1, flexBasis: cols === 1 ? '100%' : cols === 3 ? '30%' : '17%', minWidth: cols === 1 ? undefined : 160, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, padding: 16, gap: 6 }}>
            <Text style={{ fontSize: 22 }}>{icons[i]}</Text>
            <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '800' }}>{t(k(`landing.kyc.p${n}.title`))}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 12.5, lineHeight: 18 }}>{t(k(`landing.kyc.p${n}.desc`))}</Text>
          </View>
        ))}
      </View>
    </Shell>
  );
}

// ── Digital Twin ─────────────────────────────────────────────────────────────

function DigitalTwin() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const rtl = useRTL();
  const wide = width >= 820;
  const inputs = [1, 2, 3, 4, 5].map((n) => t(k(`landing.twin.i${n}`)));
  const tree: { label: string; depth: number }[] = [
    { label: 'Mathematics', depth: 0 },
    { label: 'Algebra', depth: 1 },
    { label: 'Equations', depth: 2 },
    { label: 'Functions', depth: 2 },
    { label: 'Geometry', depth: 1 },
    { label: 'Theorems', depth: 2 },
  ];
  return (
    <Shell tone="alt">
      <View style={{ gap: 8, marginBottom: 20 }}>
        <Kicker>{t(k('landing.flow.twin'))}</Kicker>
        <SectionTitle>{t(k('landing.twin.title'))}</SectionTitle>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 8 }}>
          {inputs.map((inp) => (
            <View key={inp} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14 }}>
              <Text style={{ color: c.aiAccent, fontSize: 14, fontWeight: '800' }}>+</Text>
              <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: '600' }}>{inp}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: c.aiAccent, fontSize: 24, fontWeight: '800' }}>{wide ? (rtl ? '←' : '→') : '↓'}</Text>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.xl, padding: 28, gap: 10, minHeight: 180 }}>
          <BrainViz color={c.aiAccent} nodeColor={c.primary} />
          <Text style={{ color: c.aiAccent, fontSize: 20, fontWeight: '900' }}>{t(k('landing.twin.result'))}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>{t(k('landing.twin.lead'))}</Text>
        </View>
      </View>

      {/* Knowledge Graph — folded into the Digital Twin: the twin's concepts
          form a living, connected map rather than a separate section. */}
      <View style={{ gap: 6, marginTop: 26 }}>
        <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>{t(k('landing.graph.title'))}</Text>
        <Lead>{t(k('landing.graph.lead'))}</Lead>
      </View>
      <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, padding: 18, gap: 8, marginTop: 10 }}>
        {tree.map((n) => (
          <View key={n.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginStart: n.depth * 22 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.depth === 0 ? c.aiAccent : n.depth === 1 ? c.primary : c.textMuted }} />
            <Text style={{ color: n.depth === 0 ? c.textPrimary : c.textSecondary, fontSize: 14, fontWeight: n.depth === 0 ? '800' : '600' }}>{n.label}</Text>
          </View>
        ))}
      </View>
    </Shell>
  );
}

// ── Smart revision ───────────────────────────────────────────────────────────

function Revision() {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const chips = [1, 2, 3, 4, 5, 6].map((n) => t(k(`landing.revision.c${n}`)));
  return (
    <Shell tone="alt">
      <View style={{ gap: 8, marginBottom: 18 }}>
        <Kicker>{t(k('landing.revision.title'))}</Kicker>
        <SectionTitle>{t(k('landing.revision.message'))}</SectionTitle>
        <Lead>{t(k('landing.revision.lead'))}</Lead>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((c2) => <Chip key={c2} label={c2} />)}
      </View>
    </Shell>
  );
}

// ── Subscriptions (Free / Pro / Max) ─────────────────────────────────────────

type Tier = { id: 'free' | 'pro' | 'max'; emoji: string; accent: boolean; primary: boolean };

/** Marketing subscription section — presents the Free → Pro → Max progression.
 *  No prices, no feature matrix, no billing logic: CTAs route to the existing
 *  auth flow. The monthly/annual toggle is visual-only (ready to receive a
 *  billingCycle later) — it never shows a fabricated price. */
function Pricing() {
  const { colors: c } = useTokens();
  const { width } = useResponsive();
  const gutter = useGutter();
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const wide = width >= 768;
  const [annual, setAnnual] = useState(false);
  const tiers: Tier[] = [
    { id: 'free', emoji: '🌱', accent: false, primary: false },
    { id: 'pro', emoji: '⚡', accent: true, primary: true },
    { id: 'max', emoji: '🚀', accent: false, primary: true },
  ];
  return (
    <View style={{ width: '100%' }}>
      <View style={{ maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center', paddingHorizontal: gutter, paddingVertical: wide ? 72 : 48, gap: 28 }}>
        <View style={{ gap: 12, alignItems: 'center' }}>
          <Text style={{ color: c.textPrimary, fontSize: wide ? 32 : 26, fontWeight: '900', textAlign: 'center', lineHeight: wide ? 38 : 32 }}>{t(k('landing.pricing.title'))}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 15, textAlign: 'center', maxWidth: 560 }}>{t(k('landing.pricing.subtitle'))}</Text>
          <BillingToggle annual={annual} onChange={setAnnual} />
        </View>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'stretch' }}>
          {tiers.map((tier) => (
            <PriceCard key={tier.id} tier={tier} reduced={reduced} />
          ))}
        </View>
      </View>
    </View>
  );
}

function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (v: boolean) => void }) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const Opt = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={{ borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 18, minHeight: 40, justifyContent: 'center', backgroundColor: active ? c.primary : 'transparent' }}>
      <Text style={{ color: active ? c.onPrimary : c.textSecondary, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.full, padding: 4 }}>
        <Opt label={t(k('landing.pricing.billing.monthly'))} active={!annual} onPress={() => onChange(false)} />
        <Opt label={t(k('landing.pricing.billing.annual'))} active={annual} onPress={() => onChange(true)} />
      </View>
      {annual ? (
        <View style={{ borderWidth: 1, borderColor: c.success, backgroundColor: c.successSoft, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: 10 }}>
          <Text style={{ color: c.success, fontSize: 11, fontWeight: '800' }}>{t(k('landing.pricing.billing.saving'))}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PriceCard({ tier, reduced }: { tier: Tier; reduced: boolean }) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const go = useGo();
  const [hover, setHover] = useState(false);
  const accent = tier.accent;
  const name = t(k(`landing.pricing.${tier.id}.name`));
  const desc = t(k(`landing.pricing.${tier.id}.description`));
  const cta = t(k(`landing.pricing.${tier.id}.cta`));
  const lift = hover && !reduced;
  return (
    <Pressable
      onPress={go}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityRole="button"
      accessibilityLabel={`${name} — ${cta}`}
      style={[
        {
          flex: 1,
          minWidth: 240,
          borderWidth: accent ? 2 : 1,
          borderColor: accent ? c.aiAccent : hover ? c.borderStrong : c.border,
          backgroundColor: accent ? c.aiAccentSoft : c.surfaceElevated,
          borderRadius: radius.xl,
          padding: 24,
          gap: 12,
          transform: lift ? [{ translateY: -3 }] : undefined,
        },
        webOnly({
          transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
          boxShadow: accent ? '0 26px 60px -32px rgba(0,0,0,0.5)' : hover ? '0 18px 44px -28px rgba(0,0,0,0.4)' : 'none',
        }),
      ]}
    >
      {accent ? (
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, backgroundColor: c.aiAccent, paddingVertical: 4, paddingHorizontal: 10 }}>
          <Text style={{ color: c.onAiAccent, fontSize: 11, fontWeight: '800' }}>★ {t(k('landing.pricing.pro.badge'))}</Text>
        </View>
      ) : null}
      <Text style={{ fontSize: 26 }}>{tier.emoji}</Text>
      <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '900' }}>{name}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 21 }}>{desc}</Text>
      <View style={{ flex: 1, minHeight: 12 }} />
      <View
        style={{
          borderRadius: radius.md,
          minHeight: 48,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 18,
          backgroundColor: tier.primary ? c.primary : 'transparent',
          borderWidth: tier.primary ? 0 : 1,
          borderColor: c.borderStrong,
        }}
      >
        <Text style={{ color: tier.primary ? c.onPrimary : c.textPrimary, fontSize: 15, fontWeight: '800' }}>{cta}</Text>
      </View>
    </Pressable>
  );
}

// ── FAQ accordion ────────────────────────────────────────────────────────────

function Faq() {
  const { t } = useI18n();
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return (
    <Shell tone="alt">
      <View style={{ gap: 8, marginBottom: 18 }}>
        <Kicker>{t(k('landing.nav.faq'))}</Kicker>
        <SectionTitle>{t(k('landing.faq.title'))}</SectionTitle>
      </View>
      <View style={{ gap: 10 }}>
        {items.map((n) => (
          <FaqItem key={n} q={t(k(`landing.faq.q${n}`))} a={t(k(`landing.faq.a${n}`))} />
        ))}
      </View>
    </Shell>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const { colors: c, radius } = useTokens();
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.md, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 }}>{q}</Text>
        <Text style={{ color: c.aiAccent, fontSize: 18, fontWeight: '800' }}>{open ? '−' : '+'}</Text>
      </View>
      {open ? <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 21 }}>{a}</Text> : null}
    </Pressable>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  return (
    <View style={{ width: '100%' }}>
      <View style={{ maxWidth: 900, width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 72, alignItems: 'center', gap: 18 }}>
        <View style={{ borderWidth: 1, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.xl, padding: width >= 700 ? 40 : 24, alignItems: 'center', gap: 16, width: '100%' }}>
          <Text style={{ color: c.textPrimary, fontSize: width >= 700 ? 34 : 26, fontWeight: '900', textAlign: 'center', lineHeight: width >= 700 ? 40 : 32 }}>{t(k('landing.final.title'))}</Text>
          <Text style={{ color: c.aiAccent, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>{t(k('landing.final.subtitle'))}</Text>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
            <PrimaryCta label={t(k('landing.cta.start'))} />
            <GhostCta label={t(k('landing.cta.discover'))} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const { colors: c } = useTokens();
  const { width } = useResponsive();
  const gutter = useGutter();
  const { t } = useI18n();
  const cols: { title: string; items: string[] }[] = [
    { title: 'landing.footer.product', items: ['landing.footer.product1', 'landing.footer.product2', 'landing.footer.product3', 'landing.footer.product4', 'landing.footer.product5'] },
    { title: 'landing.footer.learn', items: ['landing.footer.learn1', 'landing.footer.learn2', 'landing.footer.learn3', 'landing.footer.learn4'] },
    { title: 'landing.footer.resources', items: ['landing.footer.resources1', 'landing.footer.resources2', 'landing.footer.resources3'] },
    { title: 'landing.footer.company', items: ['landing.footer.company1', 'landing.footer.company2'] },
    { title: 'landing.footer.legal', items: ['landing.footer.legal1', 'landing.footer.legal2', 'landing.footer.legal3'] },
  ];
  return (
    <View style={{ width: '100%', borderTopWidth: 1, borderTopColor: c.borderSubtle, backgroundColor: c.surfaceSunken }}>
      <View style={{ maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center', paddingHorizontal: gutter, paddingVertical: 40, gap: 24 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: c.aiAccent, fontSize: 16, fontWeight: '900' }}>🧠 {t(k('landing.brand'))}</Text>
          <Text style={{ color: c.textMuted, fontSize: 13, maxWidth: 320 }}>{t(k('landing.footer.tagline'))}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: width >= 700 ? 48 : 24 }}>
          {cols.map((col) => (
            <View key={col.title} style={{ gap: 8, minWidth: 120 }}>
              <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: '800' }}>{t(k(col.title))}</Text>
              {col.items.map((it) => (
                <Text key={it} style={{ color: c.textMuted, fontSize: 13 }}>{t(k(it))}</Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={{ color: c.textMuted, fontSize: 12, borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: 16 }}>{t(k('landing.footer.copy'))}</Text>
      </View>
    </View>
  );
}

// ── Interactive digital-brain visualization (Canvas-free) ────────────────────

export function BrainViz({ color, nodeColor }: { color: string; nodeColor: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  const nodes = [
    { x: 90, y: 20 }, { x: 40, y: 60 }, { x: 140, y: 55 }, { x: 70, y: 100 }, { x: 120, y: 105 }, { x: 90, y: 62 },
  ];
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <View style={{ width: 200, height: 140 }}>
      {nodes.map((n, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: n.x - 7, top: n.y - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: i === 5 ? color : nodeColor, opacity: reduced ? 0.8 : opacity, transform: [{ scale: i === 5 && !reduced ? scale : 1 }] }} />
      ))}
      <Animated.View style={{ position: 'absolute', left: 90 - 22, top: 62 - 22, width: 44, height: 44, borderRadius: 22, backgroundColor: color, opacity: reduced ? 0.2 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] }), transform: [{ scale: reduced ? 1 : scale }] }} />
    </View>
  );
}
