import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import {
  filterAndRankLanguages,
  SUPPORTED_LANGUAGE_CODES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguageCode,
  type VoiceExperienceState,
} from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { supportedLocaleCodes, useI18n } from '../../lib/i18n';
import { LanguageFlag } from './language-flag';

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

function uiLanguageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? meta(code)?.englishName ?? code.toUpperCase();
  } catch {
    return meta(code)?.englishName ?? code.toUpperCase();
  }
}

export type LanguageSelectorMode = 'ui' | 'learning';

/**
 * Searchable 34-language selector. The flag is decorative; native and UI names
 * carry the meaning. UI language and learning language are explicit modes.
 */
export function LanguageSelector({
  value,
  onChange,
  mode,
  label,
  codes,
  recentCodes = [],
  uiNameFor,
  compact = false,
}: {
  value: string | null;
  onChange: (code: string) => void;
  mode: LanguageSelectorMode;
  label?: string;
  codes?: readonly string[];
  recentCodes?: readonly string[];
  uiNameFor?: (code: string) => string;
  compact?: boolean;
}) {
  const { colors: c, radius, spacing, typography } = useTokens();
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const effectiveCodes = useMemo(
    () => codes ?? (mode === 'ui' ? supportedLocaleCodes() : SUPPORTED_LANGUAGE_CODES),
    [codes, mode],
  );
  const options = useMemo(() => {
    const source = effectiveCodes.map((code) => {
      const language = meta(code);
      return {
        code,
        nativeName: language?.name ?? code.toUpperCase(),
        displayName: uiNameFor?.(code) ?? uiLanguageName(code, locale),
        searchTerms: [language?.englishName ?? ''],
      };
    });
    return filterAndRankLanguages(source, query, value, recentCodes);
  }, [effectiveCodes, locale, query, recentCodes, uiNameFor, value]);
  const active = value ? meta(value) : null;
  const activeUiName = value ? (uiNameFor?.(value) ?? uiLanguageName(value, locale)) : null;
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const choose = (code: string) => {
    onChange(code);
    close();
  };
  const resolvedLabel = label ?? t(mode === 'ui' ? 'languageSelector.uiLabel' : 'languageSelector.learningLabel');

  return (
    <View style={{ gap: compact ? 0 : spacing.xs }}>
      {!compact ? <Text style={[typography.label, { color: c.textMuted }]}>{resolvedLabel}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={resolvedLabel}
        accessibilityHint={active?.name}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: compact ? 36 : 48,
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: compact ? radius.full : radius.sm,
          paddingVertical: compact ? 6 : spacing.xs,
          paddingHorizontal: compact ? 12 : spacing.sm,
          backgroundColor: c.surface,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {value && compact ? (
          <>
            <LanguageFlag code={value} size={14} />
            <Text
              numberOfLines={1}
              style={{ color: c.textSecondary, fontSize: 13, fontWeight: '700', maxWidth: 116 }}
            >
              {active?.name ?? value.toUpperCase()}
            </Text>
          </>
        ) : value ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm }}>
            <LanguageFlag code={value} size={18} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.title, { color: c.textPrimary }]}>{active?.name ?? value.toUpperCase()}</Text>
              {activeUiName && activeUiName !== active?.name ? <Text style={[typography.caption, { color: c.textSecondary }]}>{activeUiName}</Text> : null}
            </View>
          </View>
        ) : <Text style={[typography.body, { color: c.textMuted }]}>{t('languageSelector.choose')}</Text>}
        <Text accessible={false} style={{ color: c.textMuted }}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: spacing.lg }} onPress={close}>
          <Pressable
            accessibilityViewIsModal
            style={{ width: '100%', maxWidth: 560, maxHeight: '86%', alignSelf: 'center', backgroundColor: c.surfaceElevated, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}
            onPress={() => {}}
          >
            <View style={{ padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary, flex: 1 }]}>{resolvedLabel}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('app.dismiss')} onPress={close} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: c.textSecondary, fontSize: 20 }}>×</Text>
                </Pressable>
              </View>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('languageSelector.search')}
                placeholderTextColor={c.textMuted}
                autoCorrect={false}
                accessibilityLabel={t('languageSelector.search')}
                style={{ minHeight: 44, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, color: c.textPrimary, backgroundColor: c.surface }}
              />
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={[typography.body, { color: c.textMuted, padding: spacing.lg, textAlign: 'center' }]}>{t('languageSelector.noResults')}</Text>}
              renderItem={({ item }) => {
                const selected = item.code === value;
                const recent = recentCodes.includes(item.code) && !selected;
                return (
                  <Pressable
                    onPress={() => choose(item.code)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${item.nativeName}, ${item.displayName}`}
                    style={({ pressed }) => ({
                      minHeight: 58,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                      backgroundColor: selected ? c.aiAccentSoft : pressed ? c.surfaceSunken : c.surfaceElevated,
                      borderBottomWidth: 1,
                      borderBottomColor: c.borderSubtle,
                    })}
                  >
                    <LanguageFlag code={item.code} size={18} />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.title, { color: c.textPrimary }]}>{item.nativeName}</Text>
                      {item.displayName !== item.nativeName ? <Text style={[typography.caption, { color: c.textSecondary }]}>{item.displayName}</Text> : null}
                    </View>
                    {recent ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('languageSelector.recent')}</Text> : null}
                    {selected ? <Text style={{ color: c.primary, fontSize: 17, fontWeight: '800' }}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── LanguageBadge — flag + native name (decorative flag, name carries meaning) ─
export function LanguageBadge({ code }: { code: string }) {
  const { colors: c, radius } = useTokens();
  const m = meta(code);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
      <LanguageFlag code={code} size={14} />
      <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: '600', writingDirection: m?.rtl ? 'rtl' : 'ltr' }}>{m?.name ?? code.toUpperCase()}</Text>
    </View>
  );
}

// ── Native / Study language markers ──────────────────────────────────────────
export function NativeLanguage({ code }: { code: string }) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('languageSelector.nativeLabel')}</Text>
      <LanguageBadge code={code} />
    </View>
  );
}
export function StudyLanguage({ code }: { code: string }) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: c.aiAccent, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('languageSelector.learningLabel')}</Text>
      <LanguageBadge code={code} />
    </View>
  );
}

// ── BilingualText — study text with its native-language gloss ─────────────────
export function BilingualText({ text, gloss, languageCode }: { text: string; gloss: string; languageCode?: string }) {
  const { colors: c } = useTokens();
  const rtl = languageCode ? meta(languageCode)?.rtl : false;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: c.textPrimary, fontSize: 16, lineHeight: 23, writingDirection: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}>{text}</Text>
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

// ── Honest voice state machine — no generated waveform or fake progress. ─────
type LegacyVoiceKind = 'speaking' | 'listening' | 'recording';
export function VoiceState({ state, elapsedSeconds, transcript }: { state: VoiceExperienceState | LegacyVoiceKind; elapsedSeconds?: number; transcript?: string }) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const normalized: VoiceExperienceState = state === 'speaking'
    ? 'SPEAKING'
    : state === 'listening' || state === 'recording'
      ? 'LISTENING'
      : state;
  const map: Record<VoiceExperienceState, { icon: string; key: string; color: string }> = {
    READY: { icon: '🎤', key: 'voice11.state.ready', color: c.textSecondary },
    LISTENING: { icon: '●', key: 'voice11.state.listening', color: c.error },
    TRANSCRIPTION: { icon: '✎', key: 'voice11.state.transcription', color: c.info },
    THINKING: { icon: '✦', key: 'voice11.state.thinking', color: c.aiAccent },
    SPEAKING: { icon: '🔊', key: 'voice11.state.speaking', color: c.success },
    RESPONSE: { icon: '🔊', key: 'voice11.state.response', color: c.success },
    PAUSED: { icon: 'Ⅱ', key: 'voice11.state.paused', color: c.warning },
    ERROR: { icon: '!', key: 'voice11.state.error', color: c.error },
  };
  const m = map[normalized];
  const duration = elapsedSeconds === undefined ? '' : ` · ${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  const label = `${t(m.key as Parameters<typeof t>[0])}${duration}`;
  return (
    <View accessibilityLiveRegion="polite" accessibilityLabel={label} style={{ gap: 4, backgroundColor: c.surfaceSunken, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text accessible={false} style={{ fontSize: 15, color: m.color }}>{m.icon}</Text>
        <Text style={{ color: m.color, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      </View>
      {transcript ? <Text numberOfLines={2} style={{ color: c.textSecondary, fontSize: 13 }}>{transcript}</Text> : null}
    </View>
  );
}
