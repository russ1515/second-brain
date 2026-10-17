import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { localeDirection, useI18n } from '../../lib/i18n';
import { LangPill } from '../auth/kit';
import { LandingHero } from './hero-section';
import { LanguageExperience } from './language-experience';
import {
  HEADER_NAV_ITEMS,
  ContactSection,
  DownloadSection,
  FaqSection,
  FinalCtaSection,
  LandingFooter,
  PricingSection,
  PrivacySection,
} from './supporting-sections';
import { ProductStory } from './product-story';
import {
  AcademicWorkspaceSection,
  BrainEvidenceSection,
  ProfessorJourneySection,
  ResearchEvidenceSection,
  ReviewNextActionSection,
} from './product-realignment-sections';
import { type LandingAnchor } from './landing-content';
import {
  LANDING_CONTENT_MAX,
  LandingButton,
  useLandingGutter,
  webLinkKeyboardProps,
  webOnly,
} from './landing-foundation';

export { BrainViz } from './brain-viz';

/** Public route `/` for visitors who are not signed in. */
export function LandingPage() {
  const { colors: c } = useTokens();
  const { locale, t } = useI18n();
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const requestedSection = Array.isArray(section) ? section[0] : section;
  const scrollRef = useRef<ScrollView>(null);
  const anchors = useRef<Partial<Record<LandingAnchor, number>>>({});
  const [activeAnchor, setActiveAnchor] = useState<LandingAnchor>('product');
  // Direction comes from the same 34-language registry as the root provider.
  // Keeping the Landing on that source of truth prevents its public shell from
  // disagreeing with <html dir> when the active locale changes.
  const rtl = localeDirection(locale) === 'rtl';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    const title = t('landing12.seo.title');
    const description = t('landing12.seo.description');
    document.title = title;
    const metadata: ReadonlyArray<readonly [string, string]> = [
      ['meta[name="description"]', description],
      ['meta[property="og:title"]', title],
      ['meta[property="og:description"]', description],
      ['meta[name="twitter:title"]', title],
      ['meta[name="twitter:description"]', description],
    ];
    for (const [selector, content] of metadata) {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content);
    }
  }, [locale, rtl, t]);

  const onAnchor = (id: LandingAnchor) => (event: LayoutChangeEvent) => {
    anchors.current[id] = event.nativeEvent.layout.y;
  };
  const scrollTo = useCallback((id: LandingAnchor) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const target = document.getElementById(`landing-${id}`);
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
        setActiveAnchor(id);
        return;
      }
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, (anchors.current[id] ?? 0) - 72), animated: true });
    setActiveAnchor(id);
  }, []);
  const scrollTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setActiveAnchor('product');
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y + 128;
    const visible = (Object.entries(anchors.current) as Array<[LandingAnchor, number]>)
      .filter((entry): entry is [LandingAnchor, number] => typeof entry[1] === 'number')
      .sort((a, b) => a[1] - b[1]);
    let current: LandingAnchor = 'product';
    for (const [id, offset] of visible) {
      if (offset <= y) current = id;
      else break;
    }
    setActiveAnchor((previous) => previous === current ? previous : current);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !requestedSection) return;
    const timer = window.setTimeout(() => scrollTo(requestedSection as LandingAnchor), 250);
    return () => window.clearTimeout(timer);
  }, [requestedSection, scrollTo]);
  const start = () => router.push('/signup');
  const signIn = () => router.push('/login');

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={[{ flex: 1, backgroundColor: c.background }, webOnly({ direction: rtl ? 'rtl' : 'ltr' })]}
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={100}
      >
        <LandingHeader activeAnchor={activeAnchor} onHome={scrollTop} onNav={scrollTo} onStart={start} onSignIn={signIn} />
        <LandingHero onStart={start} onHow={() => scrollTo('product')} />
        <Anchor id="product" onAnchor={onAnchor}><ProductStory /></Anchor>
        <Anchor id="academic" onAnchor={onAnchor}><AcademicWorkspaceSection /></Anchor>
        <Anchor id="professor" onAnchor={onAnchor}><ProfessorJourneySection /></Anchor>
        <Anchor id="research" onAnchor={onAnchor}><ResearchEvidenceSection /></Anchor>
        <Anchor id="languages" onAnchor={onAnchor}><LanguageExperience onStart={start} /></Anchor>
        <Anchor id="brain" onAnchor={onAnchor}><BrainEvidenceSection /></Anchor>
        <Anchor id="review" onAnchor={onAnchor}><ReviewNextActionSection /></Anchor>
        <Anchor id="download" onAnchor={onAnchor}><DownloadSection onUseWeb={start} /></Anchor>
        <Anchor id="privacy" onAnchor={onAnchor}><PrivacySection /></Anchor>
        <Anchor id="pricing" onAnchor={onAnchor}><PricingSection onStart={start} /></Anchor>
        <Anchor id="faq" onAnchor={onAnchor}><FaqSection /></Anchor>
        <Anchor id="contact" onAnchor={onAnchor}><ContactSection onAccount={signIn} /></Anchor>
        <FinalCtaSection onStart={start} onDemo={() => scrollTo('product')} />
        <LandingFooter onNav={scrollTo} onStart={start} onSignIn={signIn} />
      </ScrollView>
    </>
  );
}

function Anchor({ id, onAnchor, children }: { id: LandingAnchor; onAnchor: (id: LandingAnchor) => (event: LayoutChangeEvent) => void; children: ReactNode }) {
  return <View nativeID={`landing-${id}`} onLayout={onAnchor(id)} style={webOnly({ scrollMarginTop: 72 })}>{children}</View>;
}

function LandingHeader({ activeAnchor, onHome, onNav, onStart, onSignIn }: { activeAnchor: LandingAnchor; onHome: () => void; onNav: (id: LandingAnchor) => void; onStart: () => void; onSignIn: () => void }) {
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
        <Pressable {...webLinkKeyboardProps(onHome)} onPress={onHome} accessibilityRole="link" accessibilityLabel={t('landing12.brand')} style={({ pressed }) => ({ flexShrink: 1, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
            <Text numberOfLines={1} style={{ color: c.aiAccent, fontSize: tiny ? 14 : 16, lineHeight: 21, fontWeight: '900', letterSpacing: 0.2 }}>◉ {t('landing12.brand')}</Text>
            {!tiny ? <View style={{ borderWidth: 1, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 7 }}><Text style={{ color: c.aiAccent, fontSize: 8, lineHeight: 12, fontWeight: '900', textTransform: 'uppercase' }}>{t('landing12.footer.beta').split('·')[0].trim()}</Text></View> : null}
          </View>
          {width >= 1370 ? <Text numberOfLines={1} style={{ color: c.textMuted, fontSize: 9, lineHeight: 13, fontWeight: '700' }}>{t('landing12.signature')}</Text> : null}
        </Pressable>
        <View style={{ flex: 1 }} />
        {desktop ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
            {HEADER_NAV_ITEMS.map((item) => (
              <Pressable key={item.id} {...webLinkKeyboardProps(() => onNav(item.id), activeAnchor === item.id)} onPress={() => onNav(item.id)} accessibilityRole="link" accessibilityLabel={t(item.labelKey)} accessibilityState={{ selected: activeAnchor === item.id }} style={({ pressed }) => ({ minHeight: 38, justifyContent: 'center', borderBottomWidth: activeAnchor === item.id ? 2 : 0, borderBottomColor: c.aiAccent, opacity: pressed ? 0.62 : 1 })}>
                <Text numberOfLines={1} style={{ color: activeAnchor === item.id ? c.aiAccent : c.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '700' }}>{t(item.labelKey)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={{ width: desktop ? 8 : 0 }} />
        {!tiny || desktop ? <LangPill /> : null}
        {desktop ? (
          <Pressable {...webLinkKeyboardProps(onSignIn)} onPress={onSignIn} accessibilityRole="link" accessibilityLabel={t('landing12.cta.signin')} style={({ pressed }) => ({ minHeight: 42, justifyContent: 'center', paddingHorizontal: 5, opacity: pressed ? 0.62 : 1 })}>
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
                <Pressable key={item.id} {...webLinkKeyboardProps(() => go(item.id), activeAnchor === item.id)} onPress={() => go(item.id)} accessibilityRole="link" accessibilityLabel={t(item.labelKey)} accessibilityState={{ selected: activeAnchor === item.id }} style={({ pressed }) => ({ minHeight: 46, justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: 12, backgroundColor: pressed || activeAnchor === item.id ? c.aiAccentSoft : 'transparent' })}>
                  <Text style={{ color: activeAnchor === item.id ? c.aiAccent : c.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{t(item.labelKey)}</Text>
                </Pressable>
              ))}
              <View style={{ height: 1, backgroundColor: c.borderSubtle, marginVertical: 7 }} />
              <Pressable {...webLinkKeyboardProps(() => { setMenuOpen(false); onSignIn(); })} onPress={() => { setMenuOpen(false); onSignIn(); }} accessibilityRole="link" accessibilityLabel={t('landing12.cta.signin')} style={{ minHeight: 46, justifyContent: 'center', paddingHorizontal: 12 }}>
                <Text style={{ color: c.aiAccent, fontSize: 14, fontWeight: '800' }}>{t('landing12.cta.signin')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
