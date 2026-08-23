import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useTheme } from '../lib/design/theme';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Progress,
  SegmentedControl,
  Skeleton,
  Switch,
} from '../components/ds/core';
import {
  AIAction,
  AIExplanation,
  AIInsight,
  AIProgress,
  AIRecommendation,
  AITeacherMessage,
  AIWarning,
  PostureBadge,
} from '../components/ds/ai';
import {
  AnswerFeedback,
  ConceptCard,
  DifficultyIndicator,
  ExerciseCard,
  Flashcard,
  KnowledgeRelation,
  LessonStep,
  MasteryIndicator,
  RevisionIndicator,
} from '../components/ds/learning';
import {
  BilingualText,
  LanguageBadge,
  NativeLanguage,
  PronunciationIndicator,
  StudyLanguage,
  TranslationHint,
  VoiceState,
} from '../components/ds/language';
import { Avatar, Checkbox, RadioGroup, Select, Tabs } from '../components/ds/controls';
import { Dialog, Drawer, Sheet, Toast, Tooltip } from '../components/ds/overlays';
import { SpaceNav, type SpaceKey } from '../components/ds/navigation';
import { OnboardingPlayground } from '../components/onboarding/playground';
import { LearnPlayground } from '../components/learn/playground';
import { BrainPlayground } from '../components/brain/playground';
import { ReviewPlayground } from '../components/review/playground';
import { ProfilePlayground } from '../components/profile/playground';
import {
  radius as radiusTokens,
  spacing as spacingTokens,
  typography as typeTokens,
  typographyUsage,
  type ColorRole,
} from '../lib/design/tokens';

/**
 * 🎨 Design Playground (UI/UX Sprint 1, task UI-1.14).
 *
 * The internal gallery of the design language — tokens first, components as they
 * land. Validate the identity here before touching any business screen. Switch
 * the scheme with the toggle to check light + dark.
 */
export default function DesignSystemScreen() {
  const t = useTheme();
  const c = t.colors;
  const [seg, setSeg] = useState<'day' | 'week' | 'month'>('week');
  const [sw, setSw] = useState(true);
  const [text, setText] = useState('');
  const [check, setCheck] = useState(true);
  const [radio, setRadio] = useState<'a' | 'b' | 'c'>('a');
  const [tab, setTab] = useState<'overview' | 'details'>('overview');
  const [sel, setSel] = useState<'fr' | 'en' | 'es' | null>(null);
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState(false);
  const [nav, setNav] = useState<SpaceKey>('home');

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.container}>
      {/* Masthead + scheme toggle */}
      <Text style={[typeTokens.label, { color: c.aiAccent }]}>SECOND BRAIN</Text>
      <Text style={[typeTokens.display, { color: c.textPrimary }]}>Design System</Text>
      <Text style={[typeTokens.body, { color: c.textSecondary, marginBottom: spacingTokens.md }]}>
        The official visual language. Tokens are the source of truth; every screen is built from them.
      </Text>
      <View style={styles.row}>
        {(['light', 'dark', 'system'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => t.setScheme(s)}
            style={[
              styles.toggle,
              { borderColor: c.border },
              t.scheme === s && { backgroundColor: c.primary, borderColor: c.primary },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: t.scheme === s }}
          >
            <Text style={{ color: t.scheme === s ? c.onPrimary : c.textSecondary, fontWeight: '600', fontSize: 13 }}>
              {s === 'light' ? '☀︎ Light' : s === 'dark' ? '☾ Dark' : '⚙︎ System'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Colors */}
      <Section title="Colors" subtitle={`Role → value, ${t.resolved} mode. Text roles meet WCAG AA on their backgrounds.`} c={c}>
        <View style={styles.swatchGrid}>
          {COLOR_ROLES.map((role) => (
            <View key={role} style={styles.swatchCell}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: c[role], borderColor: c.border },
                ]}
              />
              <Text style={[typeTokens.caption, { color: c.textSecondary }]} numberOfLines={1}>
                {role}
              </Text>
              <Text style={[typeTokens.caption, { color: c.textMuted }]} numberOfLines={1}>
                {c[role]}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      {/* AI gradient */}
      <Section title="AI Accent" subtitle="Reserved for the AI Professor — the indigo→violet mark of intelligence present." c={c}>
        <View style={[styles.aiBar, { backgroundColor: c.aiAccent }]}>
          <Text style={{ color: c.onAiAccent, fontWeight: '700' }}>🤖 AI Professor accent</Text>
        </View>
        <View style={styles.row}>
          <View style={[styles.aiHalf, { backgroundColor: t.aiGradient[0] }]} />
          <View style={[styles.aiHalf, { backgroundColor: t.aiGradient[1] }]} />
        </View>
      </Section>

      {/* Typography */}
      <Section title="Typography" subtitle="Hierarchy readable without colour or icons." c={c}>
        {(Object.keys(typeTokens) as (keyof typeof typeTokens)[]).map((name) => (
          <View key={name} style={{ marginBottom: spacingTokens.sm }}>
            <Text style={[typeTokens[name], { color: c.textPrimary }]}>{name}</Text>
            <Text style={[typeTokens.caption, { color: c.textMuted }]}>
              {typeTokens[name].fontSize}/{typeTokens[name].lineHeight} · {typeTokens[name].fontWeight} · {typographyUsage[name]}
            </Text>
          </View>
        ))}
      </Section>

      {/* Spacing */}
      <Section title="Spacing" subtitle="One 4-based scale; components use only these." c={c}>
        {(Object.entries(spacingTokens) as [string, number][]).map(([name, val]) => (
          <View key={name} style={[styles.row, { alignItems: 'center', marginBottom: 6 }]}>
            <Text style={[typeTokens.caption, { color: c.textSecondary, width: 64 }]}>{name} · {val}</Text>
            <View style={{ height: 12, width: Math.max(2, val), backgroundColor: c.primary, borderRadius: 3 }} />
          </View>
        ))}
      </Section>

      {/* Radius */}
      <Section title="Radius" c={c}>
        <View style={styles.row}>
          {(Object.entries(radiusTokens) as [string, number][]).map(([name, val]) => (
            <View key={name} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 52, height: 52, backgroundColor: c.surfaceSunken, borderWidth: 1, borderColor: c.border, borderRadius: Math.min(val, 26) }} />
              <Text style={[typeTokens.caption, { color: c.textMuted }]}>{name}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* Elevation */}
      <Section title="Elevation" subtitle="Used sparingly — no floating-card soup." c={c}>
        <View style={styles.row}>
          {(['none', 'low', 'medium', 'high'] as const).map((lvl) => (
            <View
              key={lvl}
              style={[
                styles.elevBox,
                { backgroundColor: c.surfaceElevated, borderColor: c.borderSubtle },
                t.elevation[lvl],
              ]}
            >
              <Text style={[typeTokens.caption, { color: c.textSecondary }]}>{lvl}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* Buttons */}
      <Section title="Buttons" subtitle="Variants + states. Focus ring is keyboard-visible; 44pt min target." c={c}>
        <View style={styles.row}>
          <Button label="Primary" onPress={() => {}} />
          <Button label="Secondary" variant="secondary" onPress={() => {}} />
          <Button label="Ghost" variant="ghost" onPress={() => {}} />
          <Button label="Danger" variant="danger" onPress={() => {}} />
          <Button label="AI Professor" variant="ai" icon="🤖" onPress={() => {}} />
        </View>
        <View style={[styles.row, { marginTop: 10 }]}>
          <Button label="Loading" loading onPress={() => {}} />
          <Button label="Disabled" disabled onPress={() => {}} />
          <Button label="Small" size="sm" onPress={() => {}} />
          <Button label="Large" size="lg" onPress={() => {}} />
          <IconButton icon="＋" label="Add" onPress={() => {}} />
        </View>
      </Section>

      {/* Badges */}
      <Section title="Badges" subtitle="Tone carries a label too — never colour alone." c={c}>
        <View style={styles.row}>
          <Badge label="Neutral" />
          <Badge label="Primary" tone="primary" />
          <Badge label="AI" tone="ai" />
          <Badge label="Success" tone="success" />
          <Badge label="Warning" tone="warning" />
          <Badge label="Error" tone="error" />
          <Badge label="Info" tone="info" />
        </View>
      </Section>

      {/* Controls */}
      <Section title="Controls" c={c}>
        <SegmentedControl options={['day', 'week', 'month'] as const} value={seg} onChange={setSeg} labelFor={(v) => v[0].toUpperCase() + v.slice(1)} />
        <View style={[styles.row, { marginTop: 12, alignItems: 'center' }]}>
          <Switch value={sw} onChange={setSw} label="Notifications" />
          <Text style={[typeTokens.body, { color: c.textSecondary }]}>Switch ({sw ? 'on' : 'off'})</Text>
        </View>
        <View style={{ marginTop: 12, gap: 8 }}>
          <Progress value={72} />
          <Progress value={45} tone="ai" />
          <Progress value={90} tone="success" />
        </View>
      </Section>

      {/* Input */}
      <Section title="Input" c={c}>
        <Input label="Your name" placeholder="Type here…" value={text} onChangeText={setText} />
        <View style={{ height: 12 }} />
        <Input label="Email" placeholder="you@example.com" error="That email looks invalid." value="" onChangeText={() => {}} />
      </Section>

      {/* Card + Alerts + States */}
      <Section title="Cards & Alerts" c={c}>
        <Card elevated style={{ marginBottom: 12 }}>
          <Text style={[typeTokens.h3, { color: c.textPrimary }]}>Elevated card</Text>
          <Text style={[typeTokens.body, { color: c.textSecondary }]}>Surface + subtle border + low elevation.</Text>
        </Card>
        <View style={{ gap: 10 }}>
          <Alert tone="info" title="Heads up" detail="An informational message." />
          <Alert tone="success" title="Saved" detail="Your changes were saved." />
          <Alert tone="warning" title="Careful" detail="This needs your attention." />
          <Alert tone="error" title="Something failed" detail="Retry when ready." />
        </View>
      </Section>

      {/* Loading / Empty states */}
      <Section title="Loading & Empty states" c={c}>
        <View style={{ gap: 8, marginBottom: 12 }}>
          <Skeleton height={20} width={'60%'} />
          <Skeleton height={14} />
          <Skeleton height={14} width={'80%'} />
        </View>
        <Card>
          <EmptyState icon="🗂️" title="Nothing here yet" detail="Content will appear once you start." />
        </Card>
      </Section>

      {/* AI Design Language ⭐ */}
      <Section title="AI Design Language ⭐" subtitle="The AI Professor as a present voice — recommends, explains, warns, acts." c={c}>
        <View style={{ gap: 12 }}>
          <AIRecommendation
            title="Révision prioritaire : ADN"
            body="J'ai analysé ta progression — ta maîtrise commence à baisser. 10 min suffisent pour la consolider."
            action={<AIAction label="Commencer" onPress={() => {}} />}
          />
          <AIInsight text="Tu es le plus performant le matin — planifie le travail difficile à ce moment." />
          <AIExplanation text="La photosynthèse convertit la lumière en énergie chimique. Imagine une usine qui transforme le soleil en sucre." />
          <AIWarning text="Tu travailles beaucoup, mais l'effort ne se convertit pas en maîtrise — changeons de méthode." />
          <AIProgress label="Maîtrise moyenne cette semaine" value={62} />
        </View>
      </Section>

      {/* Three postures */}
      <Section title="Postures du Professeur" subtitle="Icône + label + couleur — compréhensible sans perception des couleurs." c={c}>
        <View style={[styles.row, { marginBottom: 12 }]}>
          <PostureBadge posture="supportive" />
          <PostureBadge posture="challenging" />
          <PostureBadge posture="examiner" />
        </View>
        <View style={{ gap: 12 }}>
          <AITeacherMessage posture="supportive" text="Bravo, tu progresses vraiment. Continuons sur cette lancée." />
          <AITeacherMessage posture="challenging" text="Tu peux faire mieux. Reprenons cet exercice avec plus de rigueur." />
          <AITeacherMessage posture="examiner" text="Question 3 : définis la mitose et ses phases. Je t'écoute." />
        </View>
      </Section>

      {/* Learning components */}
      <Section title="Learning components" subtitle="Reused across Apprendre, Mon Cerveau, Réviser. State via shape+label, not colour alone." c={c}>
        <View style={{ gap: 12 }}>
          <View style={styles.row}>
            <MasteryIndicator mastery={0.92} />
            <MasteryIndicator mastery={0.55} />
            <MasteryIndicator mastery={0.2} />
            <MasteryIndicator mastery={null} />
          </View>
          <View style={styles.row}>
            <DifficultyIndicator level="beginner" />
            <DifficultyIndicator level="intermediate" />
            <DifficultyIndicator level="advanced" />
            <RevisionIndicator dueCount={7} />
            <RevisionIndicator dueCount={0} />
          </View>
          <ConceptCard name="La photosynthèse" mastery={0.62} dueCount={3} onPress={() => {}} />
          <View style={{ gap: 8 }}>
            <LessonStep index={1} title="Explication" done />
            <LessonStep index={2} title="Question" active />
            <LessonStep index={3} title="Exercice" />
          </View>
          <Flashcard front="Qu'est-ce que la mitose ?" back="La division d'une cellule en deux cellules identiques." />
          <ExerciseCard kind="Exercice" prompt="Cite les trois états de la matière." action={<AIAction label="Répondre" onPress={() => {}} />} />
          <AnswerFeedback correct score={1} correction="Parfait — solide, liquide, gazeux." />
          <AnswerFeedback correct={false} score={0.3} correction="Presque : il manquait l'état gazeux." />
          <KnowledgeRelation from="Molécules" to="ADN" relation="prerequisite" />
        </View>
      </Section>

      {/* Language components */}
      <Section title="Language components" subtitle="Hold 25+ languages without breaking layout." c={c}>
        <View style={[styles.row, { marginBottom: 12 }]}>
          <LanguageBadge code="fr" />
          <LanguageBadge code="en" />
          <LanguageBadge code="ja" />
          <LanguageBadge code="ar" />
        </View>
        <View style={[styles.row, { marginBottom: 12, gap: 24 }]}>
          <NativeLanguage code="fr" />
          <StudyLanguage code="en" />
        </View>
        <View style={{ gap: 10 }}>
          <BilingualText text="The mitochondria is the powerhouse of the cell." gloss="La mitochondrie est la centrale énergétique de la cellule." />
          <TranslationHint term="powerhouse" translation="centrale énergétique" />
          <PronunciationIndicator ipa="ˌmaɪtəˈkɒndrɪə" accuracy={0.86} />
          <View style={styles.row}>
            <VoiceState state="speaking" />
            <VoiceState state="listening" />
            <VoiceState state="recording" />
          </View>
        </View>
      </Section>

      {/* Form controls */}
      <Section title="Form controls" c={c}>
        <View style={{ gap: 14 }}>
          <Checkbox checked={check} onChange={setCheck} label="Enable spaced repetition" />
          <RadioGroup options={['a', 'b', 'c'] as const} value={radio} onChange={setRadio} labelFor={(v) => ({ a: 'Guidance', b: 'Assisted', c: 'Full solution' }[v])} />
          <Tabs options={['overview', 'details'] as const} value={tab} onChange={setTab} labelFor={(v) => v[0].toUpperCase() + v.slice(1)} />
          <View style={{ maxWidth: 280 }}>
            <Select value={sel} options={['fr', 'en', 'es'] as const} onChange={setSel} labelFor={(v) => ({ fr: 'Français', en: 'English', es: 'Español' }[v])} placeholder="Choose a language…" />
          </View>
          <View style={styles.row}>
            <Avatar name="Russell King" />
            <Avatar emoji="🧑‍🎓" />
            <Avatar emoji="🤖" ai size={48} />
          </View>
        </View>
      </Section>

      {/* Overlays */}
      <Section title="Overlays" subtitle="Modal · Sheet · Drawer · Toast · Tooltip — dismissable, reduce-motion aware." c={c}>
        <View style={styles.row}>
          <Button label="Dialog" variant="secondary" onPress={() => setDialog(true)} />
          <Button label="Sheet" variant="secondary" onPress={() => setSheet(true)} />
          <Button label="Drawer" variant="secondary" onPress={() => setDrawer(true)} />
          <Button label="Toast" variant="secondary" onPress={() => setToast(true)} />
          <Tooltip text="I explain something useful.">
            <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 }}>
              <Text style={{ color: c.textSecondary }}>Tooltip ⓘ</Text>
            </View>
          </Tooltip>
        </View>
      </Section>

      {/* Navigation */}
      <Section title="Navigation — the 5 spaces" subtitle="Same behaviour; sidebar on desktop/tablet, bottom nav on mobile." c={c}>
        <Text style={[typeTokens.caption, { color: c.textMuted, marginBottom: 6 }]}>Sidebar (desktop/tablet)</Text>
        <View style={{ height: 300, borderWidth: 1, borderColor: c.borderSubtle, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          <SpaceNav variant="sidebar" active={nav} onSelect={setNav} />
        </View>
        <Text style={[typeTokens.caption, { color: c.textMuted, marginBottom: 6 }]}>Bottom navigation (mobile)</Text>
        <View style={{ borderWidth: 1, borderColor: c.borderSubtle, borderRadius: 14, overflow: 'hidden' }}>
          <SpaceNav variant="bottom" active={nav} onSelect={setNav} />
        </View>
      </Section>

      <Section title="Onboarding — Universal KYC ⭐" subtitle="UI/UX Sprint 2. Interactive gallery of every step; the live flow is at /onboarding." c={c}>
        <OnboardingPlayground />
      </Section>

      <Section title="Apprendre — Learn workspace ⭐" subtitle="UI/UX Sprint 4. Reusable pedagogical components; the live hub is the Apprendre tab." c={c}>
        <LearnPlayground />
      </Section>

      <Section title="Mon Cerveau — Digital Twin ⭐" subtitle="UI/UX Sprint 5. Knowledge graph + cognitive panels; the live space is the Mon Cerveau tab." c={c}>
        <BrainPlayground />
      </Section>

      <Section title="Réviser — FSRS & Smart Cards ⭐" subtitle="UI/UX Sprint 6. FSRS hub, smart card reader + prediction widgets; the live space is the Réviser tab." c={c}>
        <ReviewPlayground />
      </Section>

      <Section title="Profil / KYC & Responsive Native ⭐" subtitle="UI/UX Sprint 7. Universal KYC (identity, academic path, goals, languages, AI teacher) + responsive nav (sidebar / bottom), split-view & 2×2." c={c}>
        <ProfilePlayground />
      </Section>

      <Text style={[typeTokens.caption, { color: c.textMuted, marginTop: spacingTokens.lg }]}>
        Second Brain Design System — one language for every space.
      </Text>

      {/* Overlay instances (rendered above everything) */}
      <Dialog
        visible={dialog}
        onClose={() => setDialog(false)}
        title="Delete this deck?"
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setDialog(false)} />
            <Button label="Delete" variant="danger" onPress={() => setDialog(false)} />
          </>
        }
      >
        <Text style={[typeTokens.body, { color: c.textSecondary }]}>This can't be undone. The cards will be removed from your reviews.</Text>
      </Dialog>
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Quick actions">
        <Text style={[typeTokens.body, { color: c.textSecondary }]}>A bottom sheet for contextual actions.</Text>
        <Button label="Close" variant="secondary" onPress={() => setSheet(false)} />
      </Sheet>
      <Drawer visible={drawer} onClose={() => setDrawer(false)}>
        <Text style={[typeTokens.h3, { color: c.textPrimary }]}>Menu</Text>
        <Text style={[typeTokens.body, { color: c.textSecondary }]}>A side drawer for secondary navigation.</Text>
        <Button label="Close" variant="ghost" onPress={() => setDrawer(false)} />
      </Drawer>
      <Toast visible={toast} onHide={() => setToast(false)} message="Saved to your library" tone="success" />
    </ScrollView>
  );
}

const COLOR_ROLES: ColorRole[] = [
  'primary', 'primaryHover', 'aiAccent', 'aiAccentSoft',
  'success', 'warning', 'error', 'info',
  'successSoft', 'warningSoft', 'errorSoft', 'infoSoft',
  'background', 'surface', 'surfaceElevated', 'surfaceSunken',
  'textPrimary', 'textSecondary', 'textMuted',
  'border', 'borderSubtle', 'borderStrong', 'focus',
];

function Section({
  title,
  subtitle,
  c,
  children,
}: {
  title: string;
  subtitle?: string;
  c: ReturnType<typeof useTheme>['colors'];
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { borderTopColor: c.borderSubtle }]}>
      <Text style={[typeTokens.h3, { color: c.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[typeTokens.bodySmall, { color: c.textMuted, marginBottom: spacingTokens.sm }]}>{subtitle}</Text> : <View style={{ height: spacingTokens.xs }} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 4, maxWidth: 900, width: '100%', alignSelf: 'center', paddingBottom: 64 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' },
  toggle: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  section: { marginTop: 28, paddingTop: 20, borderTopWidth: 1, gap: 4 },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchCell: { width: 96, gap: 3 },
  swatch: { height: 48, borderRadius: 10, borderWidth: 1 },
  aiBar: { borderRadius: 14, padding: 16, marginBottom: 10 },
  aiHalf: { flex: 1, height: 40, borderRadius: 10, minWidth: 120 },
  elevBox: { width: 90, height: 70, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
