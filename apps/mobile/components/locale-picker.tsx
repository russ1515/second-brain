import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '@second-brain/shared';
import { localeName, supportedLocaleCodes, useI18n } from '../lib/i18n';
import { theme } from '../lib/theme';

/** Flag for a locale code, from the shared registry (blank for unknown codes). */
function flagOf(code: string): string {
  return SUPPORTED_LANGUAGES[code as SupportedLanguageCode]?.flag ?? '🏳️';
}
function englishNameOf(code: string): string {
  return SUPPORTED_LANGUAGES[code as SupportedLanguageCode]?.englishName ?? code.toUpperCase();
}

/**
 * Switch the app's own language (Scalable i18n). A clean current-language row
 * opens a modal listing every supported language (25+) with its flag and native
 * name. The choice drives BOTH the UI and the AI Professor's teaching language.
 * Content stays in whatever the teacher is teaching.
 */
export function LocalePicker({ label }: { label?: string }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const codes = supportedLocaleCodes();

  const choose = (code: string) => {
    setLocale(code);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label ?? t('app.language')}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={styles.current}
        testID="locale-current"
      >
        <Text style={styles.currentText}>
          {flagOf(locale)}  {localeName(locale)}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{t('app.language')}</Text>
            <FlatList
              data={codes}
              keyExtractor={(c) => c}
              style={styles.list}
              renderItem={({ item: code }) => {
                const active = code === locale;
                return (
                  <Pressable
                    onPress={() => choose(code)}
                    style={[styles.row, active && styles.rowActive]}
                    testID={`locale-${code}`}
                  >
                    <Text style={styles.flag}>{flagOf(code)}</Text>
                    <View style={styles.names}>
                      <Text style={styles.native}>{localeName(code)}</Text>
                      <Text style={styles.english}>{englishNameOf(code)}</Text>
                    </View>
                    {active ? <Text style={styles.check}>✓</Text> : null}
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

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.surface,
  },
  currentText: { fontSize: 15, color: theme.text, fontWeight: '600' },
  chevron: { fontSize: 14, color: theme.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  sheet: {
    backgroundColor: theme.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    padding: 16,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  rowActive: { backgroundColor: theme.surfaceAlt },
  flag: { fontSize: 22 },
  names: { flex: 1 },
  native: { fontSize: 15, color: theme.text, fontWeight: '600' },
  english: { fontSize: 12, color: theme.textMuted },
  check: { fontSize: 16, color: theme.accent, fontWeight: '800' },
});
