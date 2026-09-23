import { useEffect, useRef, useState, type ReactNode } from 'react';
import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { useI18n } from '../../lib/i18n';
import { LangPill } from '../auth/kit';
import { CapabilityExperience, PersonalIntelligenceSection } from './feature-experience';
import { LandingHero } from './hero-section';
import { LanguageExperience } from './language-experience';
import {
  HEADER_NAV_ITEMS,
  ContactSection,
  DownloadSection,
  FaqSection,
  FinalCtaSection,
  HowItWorksSection,
  LandingFooter,
  PricingSection,
  PrivacySection,
} from './supporting-sections';
import { ProductStory } from './product-story';
import { type LandingAnchor } from './landing-content';
import {
  LANDING_CONTENT_MAX,
  LandingButton,
  useLandingGutter,
  webOnly,
} from './landing-foundation';

export { BrainViz } from './brain-viz';

const RTL_LOCALES = new Set(['ar', 'fa', 'he', 'ur']);

/** Public route `/` for visitors who are not signed in. */
export function LandingPage() {
  const { colors: c } = useTokens();
  const { locale, t } = useI18n();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const anchors = useRef<Partial<Record<LandingAnchor, number>>>({});
  const rtl = RTL_LOCALES.has(locale);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [locale, rtl]);

  const onAnchor = (id: LandingAnchor) => (event: LayoutChangeEvent) => {
    anchors.current[id] = event.nativeEvent.layout.y;
  };
  const scrollTo = (id: LandingAnchor) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const target = document.getElementById(`landing-${id}`);
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
        return;
      }
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, (anchors.current[id] ?? 0) - 72), animated: true });
  };
  const openAuth = (mode: 'login' | 'register') => {
    router.push({ pathname: '/sign-in', params: { mode } });
  };
  const start = () => openAuth('register');
  const signIn = () => openAuth('login');

  return (
    <>
      {Platform.OS === 'web' ? (
        <Head>
          <title>{t('landing12.seo.title')}</title>
          <meta name="description" content={t('landing12.seo.description')} />
          <meta name="robots" content="index,follow" />
          <meta name="theme-color" content={c.background} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={t('landing12.seo.title')} />
          <meta property="og:description" content={t('landing12.seo.description')} />
          <meta property="og:site_name" content="Second Brain" />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={t('landing12.seo.title')} />
          <meta name="twitter:description" content={t('landing12.seo.description')} />
        </Head>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={[{ flex: 1, backgroundColor: c.background }, webOnly({ direction: rtl ? 'rtl' : 'ltr' })]}
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LandingHeader onNav={scrollTo} onStart={start} onSignIn={signIn} />
        <LandingHero onStart={start} onHow={() => scrollTo('product')} onDownload={() => scrollTo('download')} />
        <Anchor id="product" onAnchor={onAnchor}><ProductStory /></Anchor>
        <Anchor id="features" onAnchor={onAnchor}><CapabilityExperience /></Anchor>
        <Anchor id="languages" onAnchor={onAnchor}><LanguageExperience onStart={start} /></Anchor>
        <Anchor id="how" onAnchor={onAnchor}><HowItWorksSection /></Anchor>
        <Anchor id="brain" onAnchor={onAnchor}><PersonalIntelligenceSection /></Anchor>
        <Anchor id="download" onAnchor={onAnchor}><DownloadSection onUseWeb={start} /></Anchor>
        <Anchor id="privacy" onAnchor={onAnchor}><PrivacySection /></Anchor>
        <Anchor id="pricing" onAnchor={onAnchor}><PricingSection onStart={start} /></Anchor>
        <Anchor id="faq" onAnchor={onAnchor}><FaqSection /></Anchor>
        <Anchor id="contact" onAnchor={onAnchor}><ContactSection onAccount={signIn} /></Anchor>
        <FinalCtaSection onStart={start} onDownload={() => scrollTo('download')} />
        <LandingFooter onNav={scrollTo} onStart={start} onSignIn={signIn} />
      </ScrollView>
    </>
  );
}

function Anchor({ id, onAnchor, children }: { id: LandingAnchor; onAnchor: (id: LandingAnchor) => (event: LayoutChangeEvent) => void; children: ReactNode }) {
  return <View nativeID={`landing-${id}`} onLayout={onAnchor(id)} style={webOnly({ scrollMarginTop: 72 })}>{children}</View>;
}

function LandingHeader({ onNav, onStart, onSignIn }: { onNav: (id: LandingAnchor) => void; onStart: () => void; onSignIn: () => void }) {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const gutter = useLandingGutter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingAnchor, setPendingAnchor] = useState<LandingAnchor | null>(null);
  const desktop = width >= 1180;
  const tiny = width < 430;

  useEffect(() => {
    if (menuOpen || !pendingAnchor) return;
    onNav(pendingAnchor);
    setPendingAnchor(null);
  }, [menuOpen, onNav, pendingAnchor]);

  const go = (id: LandingAnchor) => {
    setPendingAnchor(id);
    setMenuOpen(false);
  };

  return (
    <View style={[{ width: '100%', zIndex: 100, borderBottomWidth: 1, borderBottomColor: c.borderSubtle, backgroundColor: c.background }, webOnly({ position: 'sticky', top: 0, backdropFilter: 'blur(12px) saturate(135%)' })]}>
      <View style={{ width: '100%', maxWidth: LANDING_CONTENT_MAX, minHeight: 68, alignSelf: 'center', paddingHorizontal: tiny ? 10 : gutter, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: tiny ? 7 : 11 }}>
        <Pressable onPress={() => onNav('product')} accessibilityRole="link" accessibilityLabel={t('landing12.brand')} style={({ pressed }) => ({ flexShrink: 1, opacity: pressed ? 0.7 : 1 })}>
          <Text numberOfLines={1} style={{ color: c.aiAccent, fontSize: tiny ? 14 : 16, lineHeight: 21, fontWeight: '900', letterSpacing: 0.2 }}>◉ {t('landing12.brand')}</Text>
          {width >= 1370 ? <Text numberOfLines={1} style={{ color: c.textMuted, fontSize: 9, lineHeight: 13, fontWeight: '700' }}>{t('landing12.signature')}</Text> : null}
        </Pressable>
        <View style={{ flex: 1 }} />
        {desktop ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
            {HEADER_NAV_ITEMS.map((item) => (
              <Pressable key={item.id} onPress={() => onNav(item.id)} accessibilityRole="link" accessibilityLabel={t(item.labelKey)} style={({ pressed }) => ({ minHeight: 38, justifyContent: 'center', opacity: pressed ? 0.62 : 1 })}>
                <Text numberOfLines={1} style={{ color: c.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '700' }}>{t(item.labelKey)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={{ width: desktop ? 8 : 0 }} />
        {!tiny || desktop ? <LangPill /> : null}
        {desktop ? (
          <Pressable onPress={onSignIn} accessibilityRole="link" accessibilityLabel={t('landing12.cta.signin')} style={({ pressed }) => ({ minHeight: 42, justifyContent: 'center', paddingHorizontal: 5, opacity: pressed ? 0.62 : 1 })}>
            <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '800' }}>{t('landing12.cta.signin')}</Text>
          </Pressable>
        ) : null}
        <LandingButton compact label={t(tiny ? 'landing12.cta.startShort' : 'landing12.cta.start')} onPress={onStart} />
        {!desktop ? (
          <Pressable onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel={t('landing12.nav.menu')} accessibilityState={{ expanded: menuOpen }} aria-expanded={menuOpen} style={({ pressed }) => ({ minWidth: 42, minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Text accessible={false} style={{ color: c.textPrimary, fontSize: 18, fontWeight: '800' }}>☰</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.overlay, padding: 14, alignItems: 'flex-end' }}>
          <Pressable onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel={t('landing12.nav.close')} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 }} />
          <View accessibilityViewIsModal style={[{ position: 'relative', zIndex: 1, marginTop: 54, width: '100%', maxWidth: 360, maxHeight: '88%', borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.xl, overflow: 'hidden' }, webOnly({ boxShadow: '0 28px 70px -32px rgba(0,0,0,0.55)' })]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: c.borderSubtle, padding: 14 }}>
              <Text style={{ flex: 1, color: c.textPrimary, fontSize: 14, fontWeight: '900' }}>◉ {t('landing12.brand')}</Text>
              {tiny ? <LangPill /> : null}
              <Pressable onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel={t('landing12.nav.close')} style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
                <Text accessible={false} style={{ color: c.textSecondary, fontSize: 22 }}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 8 }}>
              {HEADER_NAV_ITEMS.map((item) => (
                <Pressable key={item.id} onPress={() => go(item.id)} accessibilityRole="link" accessibilityLabel={t(item.labelKey)} style={({ pressed }) => ({ minHeight: 46, justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: 12, backgroundColor: pressed ? c.surfaceSunken : 'transparent' })}>
                  <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{t(item.labelKey)}</Text>
                </Pressable>
              ))}
              <View style={{ height: 1, backgroundColor: c.borderSubtle, marginVertical: 7 }} />
              <Pressable onPress={() => { setMenuOpen(false); onSignIn(); }} accessibilityRole="link" accessibilityLabel={t('landing12.cta.signin')} style={{ minHeight: 46, justifyContent: 'center', paddingHorizontal: 12 }}>
                <Text style={{ color: c.aiAccent, fontSize: 14, fontWeight: '800' }}>{t('landing12.cta.signin')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
