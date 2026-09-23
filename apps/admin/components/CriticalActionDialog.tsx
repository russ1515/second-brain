import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

export type CriticalActionDialogCopy = {
  description: string;
  reason: string;
  reasonPlaceholder: string;
  confirmation: string;
  confirmationPlaceholder: string;
  cancel: string;
  confirm: string;
};

const defaultCopy: CriticalActionDialogCopy = {
  description: 'A reason and a recent MFA step-up are required. This action is audited.',
  reason: 'Reason',
  reasonPlaceholder: 'Reason',
  confirmation: 'Type CONFIRM',
  confirmationPlaceholder: 'Type CONFIRM',
  cancel: 'Cancel',
  confirm: 'Confirm',
};

/** A single explicit confirmation surface for sensitive admin mutations.
 * It deliberately owns the reason state so callers cannot accidentally submit
 * an empty audit reason. Extra structured inputs remain visible in the same
 * dialog and are validated by the authoritative API. */
export function CriticalActionDialog({
  visible, title, production, onCancel, onConfirm, copy = defaultCopy, children, busy = false, error,
}: {
  visible: boolean;
  title: string;
  production: boolean;
  onCancel(): void;
  onConfirm(reason: string): void;
  copy?: CriticalActionDialogCopy;
  children?: ReactNode;
  busy?: boolean;
  error?: string | null;
}) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  useEffect(() => { if (visible) { setReason(''); setConfirmation(''); } }, [visible]);
  const ready = !busy && reason.trim().length >= 5 && (!production || confirmation === 'CONFIRM');
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 12, padding: 24, gap: 14 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>{title}</Text>
        <Text>{copy.description}</Text>
        {children}
        <TextInput accessibilityLabel={copy.reason} value={reason} onChangeText={setReason} placeholder={copy.reasonPlaceholder} multiline style={{ borderWidth: 1, borderColor: '#cbd5e1', padding: 12, borderRadius: 8 }} />
        {production && <TextInput accessibilityLabel={copy.confirmation} value={confirmation} onChangeText={setConfirmation} placeholder={copy.confirmationPlaceholder} style={{ borderWidth: 1, borderColor: '#ef4444', padding: 12, borderRadius: 8 }} />}
        {error && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{error}</Text>}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}><Pressable accessibilityRole="button" disabled={busy} onPress={onCancel}><Text>{copy.cancel}</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={() => onConfirm(reason)}>{busy ? <ActivityIndicator color="#b91c1c" /> : <Text style={{ color: ready ? '#b91c1c' : '#94a3b8', fontWeight: '700' }}>{copy.confirm}</Text>}</Pressable></View>
      </View>
    </View>
  </Modal>;
}
