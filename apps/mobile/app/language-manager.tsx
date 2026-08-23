import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '@second-brain/shared';
import { localeCoverage, localeName, supportedLocaleCodes, useI18n } from '../lib/i18n';
import { theme } from '../lib/theme';

const flagOf = (code: string): string =>
  SUPPORTED_LANGUAGES[code as SupportedLanguageCode]?.flag ?? '🏳️';

/**
 * 🌍 Language Manager (Sprint 10.5). Every registered UI language, with how
 * complete its translation is (missing keys fall back to English) and which is
 * active. Switching also switches the AI teacher's language — the server-side
 * Learning Locale drives all generated content. New languages appear here
 * automatically once their resource is registered; the engine never changes.
 */
export default function LanguageManagerScreen() {
  const { t, locale, setLocale } = useI18n();
  const codes = supportedLocaleCodes();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🌍 {t('lm.title')}</Text>
        <Text style={styles.intro}>{t('lm.intro')}</Text>
      </View>

      {codes.map((code) => {
        const pct = Math.round(localeCoverage(code) * 100);
        const active = code === locale;
        return (
          <Pressable
            key={code}
            onPress={() => setLocale(code)}
            style={[styles.card, active && styles.cardActive]}
            testID={`lang-${code}`}
          >
            <View style={styles.head}>
              <Text style={styles.flag}>{flagOf(code)}</Text>
              <Text style={styles.name}>{localeName(code)}</Text>
              <Text style={styles.code}>{code.toUpperCase()}</Text>
              {active ? <Text style={styles.active}>✓ {t('lm.active')}</Text> : null}
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pct}%`, backgroundColor: pct >= 90 ? theme.ok : theme.accent },
                ]}
              />
            </View>
            <Text style={styles.coverage}>
              {pct}% {t('lm.translated')}
              {pct < 100 ? ` · ${t('lm.fallback')}` : ''}
            </Text>
          </Pressable>
        );
      })}

      <Text style={styles.note}>{t('lm.note')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4, marginBottom: 2 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: theme.textMuted, lineHeight: 21 },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardActive: { borderColor: theme.accent },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flag: { fontSize: 20 },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.text },
  code: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    letterSpacing: 1,
  },
  active: { fontSize: 12, fontWeight: '700', color: theme.accent },
  barTrack: { height: 6, borderRadius: 999, backgroundColor: theme.border, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999 },
  coverage: { fontSize: 12, color: theme.textMuted },
  note: { fontSize: 12, color: theme.textFaint, lineHeight: 17, marginTop: 4 },
});
