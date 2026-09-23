import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import {
  CONTACT_TOPICS,
  FAQ_ITEMS,
  LANDING_NAV_ITEMS,
  PUBLIC_PLATFORMS,
  PUBLIC_PLAN_PRESENTATION,
  PUBLIC_SUPPORT_EMAIL,
  type LandingAnchor,
  type PublicPlatformId,
  type PublicPlanId,
} from './landing-content';
import {
  LandingButton,
  LandingKicker,
  LandingLead,
  LandingPill,
  LandingSection,
  LandingTitle,
  SectionHeading,
  webOnly,
} from './landing-foundation';

const k = (key: string) => key as TranslationKey;

export function HowItWorksSection() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const horizontal = width >= 900;
  const steps = ['goal', 'act', 'context', 'practice', 'consolidate', 'continue'];
  return (
    <LandingSection>
      <SectionHeading kicker={t('landing12.how.kicker')} title={t('landing12.how.title')} lead={t('landing12.how.lead')} />
      <View style={{ marginTop: 30, flexDirection: horizontal ? 'row' : 'column', gap: horizontal ? 0 : 10 }}>
        {steps.map((step, index) => (
          <View key={step} style={{ flex: 1, flexDirection: horizontal ? 'column' : 'row', alignItems: horizontal ? 'stretch' : 'center' }}>
            <View style={{ flex: 1, minHeight: horizontal ? 180 : 98, borderWidth: 1, borderColor: index === steps.length - 1 ? c.aiAccent : c.border, backgroundColor: index === steps.length - 1 ? c.aiAccentSoft : c.surface, borderRadius: radius.lg, padding: 15, gap: 8 }}>
              <Text accessible={false} style={{ color: c.aiAccent, fontSize: 11, fontWeight: '900' }}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '800' }}>{t(k(`landing12.how.${step}.title`))}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 17 }}>{t(k(`landing12.how.${step}.desc`))}</Text>
            </View>
            {index < steps.length - 1 ? <Text accessible={false} style={{ color: c.aiAccent, alignSelf: 'center', paddingHorizontal: horizontal ? 6 : 0, paddingVertical: horizontal ? 0 : 3, fontSize: 18, fontWeight: '900' }}>{horizontal ? '→' : '↓'}</Text> : null}
          </View>
        ))}
      </View>
      <NextBestActionDemo />
    </LandingSection>
  );
}

function NextBestActionDemo() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const actions = ['english', 'review', 'workspace', 'professor'];
  return (
    <View style={{ marginTop: 28, borderRadius: radius.xl, backgroundColor: c.textPrimary, padding: width >= 700 ? 26 : 18, flexDirection: width >= 860 ? 'row' : 'column', gap: 22 }}>
      <View style={{ flex: 0.8, gap: 9, justifyContent: 'center' }}>
        <LandingPill label={t('landing12.demo.label')} />
        <LandingKicker inverse>{t('landing12.nba.kicker')}</LandingKicker>
        <Text accessibilityRole="header" style={{ color: c.background, fontSize: 23, lineHeight: 30, fontWeight: '800' }}>{t('landing12.nba.title')}</Text>
        <Text style={{ color: c.border, fontSize: 13, lineHeight: 20 }}>{t('landing12.nba.lead')}</Text>
      </View>
      <View style={{ flex: 1.2, gap: 8 }}>
        {actions.map((action, index) => (
          <View key={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: radius.md, borderWidth: 1, borderColor: index === 0 ? c.aiAccent : c.borderStrong, backgroundColor: index === 0 ? c.aiAccentSoft : c.surface, paddingVertical: 10, paddingHorizontal: 12 }}>
            <Text accessible={false} style={{ color: index === 0 ? c.aiAccent : c.textMuted, fontSize: 14, fontWeight: '900' }}>{index === 0 ? '→' : '○'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 18, fontWeight: '800' }}>{t(k(`landing12.nba.${action}`))}</Text>
              {index === 0 ? <Text style={{ color: c.textSecondary, fontSize: 10, lineHeight: 15 }}>{t('landing12.nba.why')}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function DownloadSection({ onUseWeb }: { onUseWeb: () => void }) {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const desktop = width >= 900;
  return (
    <LandingSection tone="soft">
      <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 30, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', gap: 12 }}>
          <LandingKicker>{t('landing12.download.kicker')}</LandingKicker>
          <LandingTitle>{t('landing12.download.title')}</LandingTitle>
          <LandingLead>{t('landing12.download.lead')}</LandingLead>
          <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>{t('landing12.download.continuity')}</Text>
          <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {PUBLIC_PLATFORMS.map((platform) => (
              <PlatformAction key={platform.id} id={platform.id} status={platform.status} href={platform.href} onUseWeb={onUseWeb} />
            ))}
          </View>
        </View>
        <View style={{ flex: 1, width: '100%', minHeight: 340, alignItems: 'center', justifyContent: 'center' }}>
          <DeviceContinuityScene />
        </View>
      </View>
    </LandingSection>
  );
}

function PlatformAction({ id, status, href, onUseWeb }: { id: PublicPlatformId; status: 'available' | 'prepared' | 'coming-soon'; href: string | null; onUseWeb: () => void }) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const available = status === 'available' && Boolean(href);
  if (!available) {
    const platform = t(k(`landing12.platform.${id}`));
    const statusLabel = t(k(`landing12.platform.status.${status}`));
    return (
      <View
        accessible
        accessibilityLabel={`${platform}. ${statusLabel}`}
        style={{ minHeight: 48, minWidth: 132, justifyContent: 'center', borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface, paddingHorizontal: 13, paddingVertical: 7 }}
      >
        <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '800' }}>{platform}</Text>
        <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '600' }}>{statusLabel}</Text>
      </View>
    );
  }
  return (
    <LandingButton
      compact
      label={t('landing12.download.webAction')}
      onPress={() => {
        if (id === 'web') onUseWeb();
        else if (href) void Linking.openURL(href);
      }}
      variant="primary"
      icon="↗"
    />
  );
}

function DeviceContinuityScene() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const compact = width < 520;
  return (
    <View accessible={false} style={{ width: '100%', maxWidth: 520, height: compact ? 300 : 330, position: 'relative' }}>
      <View style={{ position: 'absolute', left: compact ? 0 : 12, top: 10, width: compact ? '88%' : '82%', height: 235, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.surfaceElevated, padding: 13, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 5 }}>{[c.error, c.warning, c.success].map((color) => <View key={color} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />)}</View>
        <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
          <View style={{ width: '24%', backgroundColor: c.surfaceSunken, borderRadius: radius.sm }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 30, borderRadius: radius.sm, backgroundColor: c.aiAccentSoft }} />
            <View style={{ height: 65, borderRadius: radius.sm, backgroundColor: c.surfaceSunken }} />
            <View style={{ height: 48, borderRadius: radius.sm, backgroundColor: c.surfaceSunken }} />
          </View>
        </View>
      </View>
      <View style={{ position: 'absolute', right: 4, bottom: 8, width: compact ? 122 : 148, height: compact ? 218 : 252, borderWidth: 6, borderColor: c.textPrimary, borderRadius: 28, backgroundColor: c.surface, padding: 9, gap: 8 }}>
        <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: c.borderStrong }} />
        <View style={{ height: 55, borderRadius: radius.md, backgroundColor: c.aiAccentSoft }} />
        <View style={{ height: 35, borderRadius: radius.md, backgroundColor: c.surfaceSunken }} />
        <View style={{ height: 48, borderRadius: radius.md, backgroundColor: c.surfaceSunken }} />
        <Text style={{ color: c.aiAccent, fontSize: 9, lineHeight: 13, fontWeight: '800', textAlign: 'center' }}>{t('landing12.download.sameSession')}</Text>
      </View>
      <View style={{ position: 'absolute', left: compact ? 12 : 80, bottom: 8, borderRadius: radius.full, backgroundColor: c.successSoft, borderWidth: 1, borderColor: c.success, paddingVertical: 7, paddingHorizontal: 11 }}>
        <Text style={{ color: c.success, fontSize: 10, lineHeight: 14, fontWeight: '800' }}>{t('landing12.download.synced')}</Text>
      </View>
    </View>
  );
}

export function PrivacySection() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const controls = ['memory', 'export', 'documents', 'delete'];
  return (
    <LandingSection compact>
      <View style={{ flexDirection: width >= 860 ? 'row' : 'column', gap: 24, alignItems: width >= 860 ? 'center' : 'stretch' }}>
        <View style={{ flex: 1, gap: 10 }}>
          <LandingKicker>{t('landing12.privacy.kicker')}</LandingKicker>
          <LandingTitle>{t('landing12.privacy.title')}</LandingTitle>
          <LandingLead>{t('landing12.privacy.lead')}</LandingLead>
          <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t('landing12.privacy.scope')}</Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {controls.map((control) => (
            <View key={control} style={{ flexGrow: 1, flexBasis: width >= 600 ? '45%' : '100%', minHeight: 74, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.md, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text accessible={false} style={{ color: c.success, fontSize: 14, fontWeight: '900' }}>✓</Text>
              <Text style={{ flex: 1, color: c.textPrimary, fontSize: 12, lineHeight: 18, fontWeight: '700' }}>{t(k(`landing12.privacy.${control}`))}</Text>
            </View>
          ))}
        </View>
      </View>
    </LandingSection>
  );
}

export function PricingSection({ onStart }: { onStart: () => void }) {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const desktop = width >= 850;
  return (
    <LandingSection tone="soft">
      <SectionHeading kicker={t('landing12.pricing.kicker')} title={t('landing12.pricing.title')} lead={t('landing12.pricing.lead')} align="center" />
      <View style={{ marginTop: 28, flexDirection: desktop ? 'row' : 'column', gap: 14, alignItems: 'stretch' }}>
        {PUBLIC_PLAN_PRESENTATION.map((plan) => <PlanCard key={plan.id} id={plan.id} pending={plan.commercialDetails === 'pending-public-beta'} onStart={onStart} />)}
      </View>
      <View style={{ marginTop: 16, alignItems: 'center' }}>
        <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17, maxWidth: 760, textAlign: 'center' }}>{t('landing12.pricing.sourceNote')}</Text>
      </View>
    </LandingSection>
  );
}

function PlanCard({ id, pending, onStart }: { id: PublicPlanId; pending: boolean; onStart: () => void }) {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  return (
    <View style={{ flex: width >= 850 ? 1 : undefined, minWidth: 230, borderWidth: id === 'free' ? 1.5 : 1, borderColor: id === 'free' ? c.aiAccent : c.border, backgroundColor: id === 'free' ? c.aiAccentSoft : c.surface, borderRadius: radius.xl, padding: 21, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text accessible={false} style={{ color: id === 'free' ? c.aiAccent : c.textMuted, fontSize: 18, fontWeight: '900' }}>{id === 'free' ? '○' : id === 'pro' ? '◇' : '◆'}</Text>
        <Text style={{ color: c.textPrimary, fontSize: 21, lineHeight: 28, fontWeight: '900' }}>{t(k(`landing12.pricing.${id}.name`))}</Text>
      </View>
      <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20, minHeight: 61 }}>{t(k(`landing12.pricing.${id}.desc`))}</Text>
      <View style={{ alignSelf: 'flex-start' }}>
        <LandingPill label={t(pending ? 'landing12.pricing.pending' : 'landing12.pricing.freeStatus')} tone={pending ? 'neutral' : 'success'} />
      </View>
      <View style={{ flex: 1 }} />
      {!pending ? <LandingButton label={t('landing12.cta.start')} onPress={onStart} variant="primary" /> : null}
    </View>
  );
}

export function FaqSection() {
  const { t } = useI18n();
  return (
    <LandingSection>
      <SectionHeading kicker={t('landing12.faq.kicker')} title={t('landing12.faq.title')} lead={t('landing12.faq.lead')} />
      <View style={{ marginTop: 26, gap: 9 }}>
        {FAQ_ITEMS.map((index) => <FaqItem key={index} question={t(k(`landing12.faq.q${index}`))} answer={t(k(`landing12.faq.a${index}`))} />)}
      </View>
    </LandingSection>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const { colors: c, radius } = useTokens();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderWidth: 1, borderColor: open ? c.aiAccent : c.border, backgroundColor: open ? c.aiAccentSoft : c.surface, borderRadius: radius.md, overflow: 'hidden' }}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        accessibilityLabel={question}
        style={({ pressed }) => [
          { minHeight: 54, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 },
          webOnly({ cursor: 'pointer' }),
        ]}
      >
        <Text style={{ flex: 1, color: c.textPrimary, fontSize: 14, lineHeight: 21, fontWeight: '800' }}>{question}</Text>
        <Text accessible={false} style={{ color: c.aiAccent, fontSize: 18, fontWeight: '900' }}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 }}>{answer}</Text> : null}
    </View>
  );
}

export function ContactSection({ onAccount }: { onAccount: () => void }) {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const canEmail = Boolean(PUBLIC_SUPPORT_EMAIL);
  const openEmail = () => {
    if (!PUBLIC_SUPPORT_EMAIL) return;
    void Linking.openURL(`mailto:${PUBLIC_SUPPORT_EMAIL}?subject=${encodeURIComponent(t('landing12.contact.subject'))}`);
  };
  return (
    <LandingSection tone="soft" compact>
      <View style={{ flexDirection: width >= 850 ? 'row' : 'column', gap: 26 }}>
        <View style={{ flex: 0.85, gap: 10 }}>
          <LandingKicker>{t('landing12.contact.kicker')}</LandingKicker>
          <LandingTitle>{t('landing12.contact.title')}</LandingTitle>
          <LandingLead>{t('landing12.contact.lead')}</LandingLead>
          <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {canEmail ? <LandingButton label={t('landing12.contact.write')} onPress={openEmail} icon="↗" /> : null}
            <LandingButton label={t('landing12.contact.account')} onPress={onAccount} variant={canEmail ? 'secondary' : 'primary'} />
          </View>
          {!canEmail ? <Text style={{ color: c.warning, fontSize: 11, lineHeight: 17 }}>{t('landing12.contact.notConfigured')}</Text> : null}
        </View>
        <View style={{ flex: 1.15, flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {CONTACT_TOPICS.map((topic) => (
            <View key={topic} style={{ flexGrow: 1, flexBasis: width >= 600 ? '45%' : '100%', borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.md, padding: 13, gap: 4 }}>
              <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 18, fontWeight: '800' }}>{t(k(`landing12.contact.${topic}`))}</Text>
              <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 15 }}>{t(k(`landing12.contact.${topic}.desc`))}</Text>
            </View>
          ))}
        </View>
      </View>
    </LandingSection>
  );
}

export function FinalCtaSection({ onStart, onDownload }: { onStart: () => void; onDownload: () => void }) {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  return (
    <LandingSection>
      <View style={{ overflow: 'hidden', borderRadius: radius.xl, backgroundColor: c.textPrimary, padding: width >= 760 ? 46 : 26, alignItems: 'center', gap: 14 }}>
        <View pointerEvents="none" style={[{ position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: c.aiAccent, opacity: 0.15, top: -260, right: -80 }, webOnly({ filter: 'blur(90px)' })]} />
        <LandingKicker inverse>{t('landing12.final.kicker')}</LandingKicker>
        <LandingTitle inverse align="center">{t('landing12.final.title')}</LandingTitle>
        <LandingLead inverse align="center">{t('landing12.final.lead')}</LandingLead>
        <View style={{ marginTop: 8, flexDirection: width < 480 ? 'column' : 'row', width: width < 480 ? '100%' : undefined, gap: 10 }}>
          <LandingButton label={t('landing12.cta.start')} onPress={onStart} variant="inverse" />
          <LandingButton label={t('landing12.cta.download')} onPress={onDownload} variant="secondary" />
        </View>
      </View>
    </LandingSection>
  );
}

export function LandingFooter({
  onNav,
  onStart,
  onSignIn,
}: {
  onNav: (id: LandingAnchor) => void;
  onStart: () => void;
  onSignIn: () => void;
}) {
  const { colors: c } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const productLinks: readonly LandingAnchor[] = ['features', 'brain', 'languages', 'pricing', 'download'];
  const resourceLinks: readonly LandingAnchor[] = ['how', 'faq', 'contact'];
  return (
    <LandingSection tone="soft" compact>
      <View style={{ flexDirection: width >= 780 ? 'row' : 'column', gap: 32 }}>
        <View style={{ flex: 1.15, gap: 7 }}>
          <Text style={{ color: c.aiAccent, fontSize: 17, lineHeight: 23, fontWeight: '900' }}>◉ {t('landing12.brand')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18, maxWidth: 330 }}>{t('landing12.footer.tagline')}</Text>
          <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 15 }}>{t('landing12.footer.beta')}</Text>
        </View>
        <FooterColumn title={t('landing12.footer.product')} items={productLinks.map((id) => ({ id, label: t(k(`landing12.footer.${id}`)) }))} onNav={onNav} />
        <FooterColumn title={t('landing12.footer.resources')} items={resourceLinks.map((id) => ({ id, label: t(k(`landing12.footer.${id}`)) }))} onNav={onNav} />
        <View style={{ flex: 0.7, minWidth: 150, gap: 8 }}>
          <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '800' }}>{t('landing12.footer.account')}</Text>
          <FooterAction label={t('landing12.cta.signin')} onPress={onSignIn} />
          <FooterAction label={t('landing12.cta.start')} onPress={onStart} />
          <FooterAction label={t('landing12.footer.privacy')} onPress={() => onNav('privacy')} />
        </View>
      </View>
      <View style={{ marginTop: 28, paddingTop: 17, borderTopWidth: 1, borderTopColor: c.borderSubtle, flexDirection: width >= 600 ? 'row' : 'column', gap: 6, justifyContent: 'space-between' }}>
        <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 15 }}>{t('landing12.footer.copy')}</Text>
        <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 15 }}>{t('landing12.footer.noTracking')}</Text>
      </View>
    </LandingSection>
  );
}

function FooterColumn({ title, items, onNav }: { title: string; items: readonly { id: LandingAnchor; label: string }[]; onNav: (id: LandingAnchor) => void }) {
  const { colors: c } = useTokens();
  return (
    <View style={{ flex: 0.8, minWidth: 150, gap: 8 }}>
      <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '800' }}>{title}</Text>
      {items.map((item) => <FooterAction key={item.id} label={item.label} onPress={() => onNav(item.id)} />)}
    </View>
  );
}

function FooterAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors: c } = useTokens();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label} style={({ pressed }) => ({ minHeight: 30, justifyContent: 'center', opacity: pressed ? 0.62 : 1 })}>
      <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 16 }}>{label}</Text>
    </Pressable>
  );
}

/** Used by the header to keep all requested public destinations reachable. */
export const HEADER_NAV_ITEMS = LANDING_NAV_ITEMS;
