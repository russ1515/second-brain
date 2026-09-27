import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Text, View } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
  type CameraType,
} from 'expo-camera';
import { Alert, Button } from '../ds/core';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import type { CameraCaptureProps, CapturedImage } from '../../lib/capture/types';

export function CameraCapture({ mode, onCapture, onQr, onCancel, onImport }: CameraCaptureProps) {
  const { t } = useI18n();
  const { colors: c, radius, spacing } = useTokens();
  const camera = useRef<CameraView>(null);
  const qrLatched = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>(mode === 'avatar' ? 'front' : 'back');
  const [captured, setCaptured] = useState<CapturedImage | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const isActive = state === 'active';
      setActive(isActive);
      if (!isActive) setReady(false);
    });
    return () => subscription.remove();
  }, []);

  const takePicture = async () => {
    if (!camera.current || !ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (!picture) throw new Error('capture-empty');
      setCaptured({
        uri: picture.uri,
        name: `capture-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        width: picture.width,
        height: picture.height,
        size: null,
      });
    } catch {
      setError(t('capture.error.capture'));
    } finally {
      setBusy(false);
    }
  };

  const barcode = ({ data }: BarcodeScanningResult) => {
    if (mode !== 'qr' || qrLatched.current || !data) return;
    qrLatched.current = true;
    setActive(false);
    onQr?.(data);
  };

  const askPermission = async () => {
    if (permissionBusy) return;
    setPermissionBusy(true);
    try {
      await requestPermission();
    } finally {
      setPermissionBusy(false);
    }
  };

  const retake = () => {
    setReady(false);
    setError(null);
    setCaptured(null);
  };

  const switchCamera = () => {
    setReady(false);
    setError(null);
    setFacing((value) => value === 'back' ? 'front' : 'back');
  };

  if (!permission) return <Text style={{ color: c.textMuted }}>{t('capture.permission.pending')}</Text>;
  if (!permission.granted) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Alert tone="warning" title={t('capture.permission.title')} detail={t('capture.permission.detail')} />
        {permission.canAskAgain ? <Button label={t('capture.permission.allow')} loading={permissionBusy} onPress={() => void askPermission()} /> : null}
        {permissionBusy ? <Text accessibilityLiveRegion="polite" style={{ color: c.textMuted }}>{t('capture.permission.pending')}</Text> : null}
        {onImport ? <Button variant="secondary" label={t('capture.importFallback')} onPress={onImport} /> : null}
        <Button variant="ghost" label={t('learn5.cancel')} onPress={onCancel} />
      </View>
    );
  }

  if (captured) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Image
          source={{ uri: captured.uri }}
          resizeMode="cover"
          style={{ width: '100%', aspectRatio: mode === 'avatar' ? 1 : 4 / 3, borderRadius: radius.md, backgroundColor: c.surfaceSunken }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button variant="secondary" label={t('capture.retake')} onPress={retake} />
          <Button label={t('capture.confirm')} onPress={() => onCapture?.(captured)} />
          <Button variant="ghost" label={t('learn5.cancel')} onPress={onCancel} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {error ? <Alert tone="error" title={error} detail={t('capture.error.fallback')} /> : null}
      {active ? (
        <View style={{ overflow: 'hidden', borderRadius: radius.md, backgroundColor: '#000', aspectRatio: mode === 'avatar' ? 1 : 4 / 3 }}>
          <CameraView
            ref={camera}
            style={{ flex: 1 }}
            facing={facing}
            onCameraReady={() => { setReady(true); setError(null); }}
            onMountError={() => { setReady(false); setError(t('capture.error.unavailable')); }}
            barcodeScannerSettings={mode === 'qr' ? { barcodeTypes: ['qr'] } : undefined}
            onBarcodeScanned={mode === 'qr' ? barcode : undefined}
          />
          {!ready && !error ? (
            <View
              accessibilityLiveRegion="polite"
              pointerEvents="none"
              style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000099', padding: spacing.md }}
            >
              <Text style={{ color: '#FFF', fontWeight: '700', textAlign: 'center' }}>{t('capture.permission.pending')}</Text>
            </View>
          ) : null}
          {mode === 'document' || mode === 'qr' ? (
            <View pointerEvents="none" style={{ position: 'absolute', inset: 24, borderWidth: 2, borderColor: '#FFFFFFCC', borderRadius: radius.sm }} />
          ) : null}
        </View>
      ) : <Alert tone="warning" title={t('capture.error.paused')} detail={t('capture.error.fallback')} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {mode !== 'qr' ? <Button label={t('capture.take')} loading={busy} disabled={!ready || !active} onPress={() => void takePicture()} /> : null}
        <Button variant="secondary" label={t('capture.switch')} onPress={switchCamera} />
        {onImport ? <Button variant="secondary" label={t('capture.importFallback')} onPress={onImport} /> : null}
        <Button variant="ghost" label={t('learn5.cancel')} onPress={onCancel} />
      </View>
      {mode === 'qr' ? <Text style={{ color: c.textMuted }}>{t('qr.aim')}</Text> : null}
    </View>
  );
}
