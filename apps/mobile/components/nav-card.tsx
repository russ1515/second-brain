import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from './ui';
import { theme } from '../lib/theme';

/** A tappable row that routes into an existing screen. The building block of the
 *  Learn / My Brain / Study / Profile spaces — navigation only, no logic. */
export function NavCard({
  emoji,
  title,
  detail,
  onPress,
  testID,
}: {
  emoji: string;
  title: string;
  detail: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID}>
      <Card style={styles.card}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  emoji: { fontSize: 26 },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: theme.text },
  detail: { fontSize: 13, color: theme.textMuted, marginTop: 4, lineHeight: 18 },
  chevron: { fontSize: 24, color: theme.textFaint },
});
