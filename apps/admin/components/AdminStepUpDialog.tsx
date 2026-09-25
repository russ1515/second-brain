import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

export type AdminStepUpDialogLabels = {
  title: string;
  hint: string;
  code: string;
  cancel: string;
  confirm: string;
};

/** Explicit MFA recovery surface for a server-rejected, audited Admin action. */
export function AdminStepUpDialog({
  visible, code, error, busy, labels, onChange, onCancel, onConfirm,
}: {
  visible: boolean;
  code: string;
  error: string | null;
  busy: boolean;
  labels: AdminStepUpDialogLabels;
  onChange(value: string): void;
  onCancel(): void;
  onConfirm(): void;
}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0008' }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 440, padding: 22, borderRadius: 12, gap: 12, backgroundColor: '#fff' }}>
        <Text accessibilityRole="header" style={{ color: '#0f172a', fontSize: 20, fontWeight: '800' }}>{labels.title}</Text>
        <Text style={{ color: '#334155' }}>{labels.hint}</Text>
        <TextInput accessibilityLabel={labels.code} value={code} onChangeText={onChange} keyboardType="number-pad" maxLength={6} placeholder="000000" style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, padding: 10 }} />
        {error && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{error}</Text>}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 11 }}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel}><Text>{labels.cancel}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || code.length !== 6 }} disabled={busy || code.length !== 6} onPress={onConfirm} style={{ opacity: busy || code.length !== 6 ? .5 : 1, backgroundColor: '#2563eb', borderRadius: 7, paddingHorizontal: 11, paddingVertical: 9 }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{labels.confirm}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
