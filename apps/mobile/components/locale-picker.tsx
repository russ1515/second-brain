import { StyleSheet, Text, View } from 'react-native';
import { localeName, supportedLocaleCodes, useI18n } from '../lib/i18n';
import { theme } from '../lib/theme';

/** Switch the app's own language. Content stays in whatever the teacher teaches.
 *  Reads the live locale registry, so any registered language shows up here. */
export function LocalePicker({ label }: { label?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label ?? t('app.language')}</Text>
      <View style={styles.row}>
        {supportedLocaleCodes().map((l) => (
          <Text
            key={l}
            onPress={() => setLocale(l)}
            accessibilityRole="button"
            style={[styles.chip, l === locale && styles.chipOn]}
            testID={`locale-${l}`}
          >
            {localeName(l)}
          </Text>
        ))}
      </View>
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
  row: { flexDirection: 'row', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    color: theme.textMuted,
    fontSize: 13,
  },
  chipOn: { borderColor: theme.accent, backgroundColor: theme.accent, color: theme.text },
});
