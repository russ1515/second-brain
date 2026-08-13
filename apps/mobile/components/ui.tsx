import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import { theme } from '../lib/theme';

export function Card({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  busy,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={[
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        off && styles.buttonOff,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.accentText} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'ghost' && styles.buttonGhostText,
            variant === 'danger' && styles.buttonDangerText,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#38BDF8" />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
    </View>
  );
}

export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <Card>
      <Text style={styles.emptyTitle}>{title}</Text>
      {detail ? <Text style={styles.emptyDetail}>{detail}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.border,
  },
  buttonDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.danger,
  },
  buttonOff: { opacity: 0.5 },
  buttonText: { color: theme.accentText, fontSize: 16, fontWeight: '600' },
  buttonGhostText: { color: theme.textMuted },
  buttonDangerText: { color: theme.danger },
  error: {
    backgroundColor: theme.dangerBg,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: '#FECACA', fontSize: 14 },
  loading: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  loadingLabel: { color: theme.textMuted, fontSize: 14 },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: '600' },
  emptyDetail: { color: theme.textMuted, fontSize: 14, marginTop: 6, lineHeight: 20 },
});
