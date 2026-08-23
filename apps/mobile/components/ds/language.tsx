import { Text, View } from 'react-native';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';

/**
 * Language components (UI/UX Sprint 1, task UI-1.9).
 *
 * The multilingual UI primitives. Built to hold 25+ languages without breaking
 * layout (native names wrap, flags are decorative). Native vs study language,
 * bilingual text, pronunciation and voice states are all first-class.
 */

function meta(code: string) {
  return SUPPORTED_LANGUAGES[code as SupportedLanguageCode];
}

// ── LanguageBadge — flag + native name (decorative flag, name carries meaning) ─
export function LanguageBadge({ code }: { code: string }) {
  const { colors: c, radius } = useTokens();
  const m = meta(code);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontSize: 13 }}>{m?.flag ?? '🏳️'}</Text>
      <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: '600' }}>{m?.name ?? code.toUpperCase()}</Text>
    </View>
  );
}

// ── Native / Study language markers ──────────────────────────────────────────
export function NativeLanguage({ code }: { code: string }) {
  const { colors: c } = useTokens();
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Native</Text>
      <LanguageBadge code={code} />
    </View>
  );
}
export function StudyLanguage({ code }: { code: string }) {
  const { colors: c } = useTokens();
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: c.aiAccent, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Learning</Text>
      <LanguageBadge code={code} />
    </View>
  );
}

// ── BilingualText — study text with its native-language gloss ─────────────────
export function BilingualText({ text, gloss }: { text: string; gloss: string }) {
  const { colors: c } = useTokens();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: c.textPrimary, fontSize: 16, lineHeight: 23 }}>{text}</Text>
      <Text style={{ color: c.textMuted, fontSize: 13, fontStyle: 'italic' }}>{gloss}</Text>
    </View>
  );
}

// ── TranslationHint — an inline, dismissible-looking translation aid ──────────
export function TranslationHint({ term, translation }: { term: string; translation: string }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.infoSoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.textPrimary, fontWeight: '600', fontSize: 13 }}>{term}</Text>
      <Text style={{ color: c.info, fontSize: 13 }}>→ {translation}</Text>
    </View>
  );
}

// ── PronunciationIndicator — IPA + accuracy ──────────────────────────────────
export function PronunciationIndicator({ ipa, accuracy }: { ipa: string; accuracy?: number }) {
  const { colors: c, radius } = useTokens();
  const tone = accuracy === undefined ? c.textMuted : accuracy >= 0.8 ? c.success : accuracy >= 0.5 ? c.warning : c.error;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ color: c.textSecondary, fontSize: 14, fontFamily: 'monospace' }}>/{ipa}/</Text>
      {accuracy !== undefined ? (
        <View style={{ backgroundColor: c.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: tone, fontSize: 12, fontWeight: '700' }}>{Math.round(accuracy * 100)}%</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Voice states — speaking / listening / recording ──────────────────────────
type VoiceKind = 'speaking' | 'listening' | 'recording';
export function VoiceState({ state }: { state: VoiceKind }) {
  const { colors: c, radius } = useTokens();
  const map: Record<VoiceKind, { icon: string; label: string; color: string }> = {
    speaking: { icon: '🔊', label: 'Speaking…', color: c.aiAccent },
    listening: { icon: '👂', label: 'Listening…', color: c.info },
    recording: { icon: '🎤', label: 'Recording…', color: c.error },
  };
  const m = map[state];
  return (
    <View accessibilityLabel={m.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 15 }}>{m.icon}</Text>
      <Text style={{ color: m.color, fontSize: 14, fontWeight: '600' }}>{m.label}</Text>
    </View>
  );
}
