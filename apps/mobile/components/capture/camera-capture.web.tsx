import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Alert, Button } from '../ds/core';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import type { CameraCaptureProps, CapturedImage } from '../../lib/capture/types';
import { releaseMediaStream } from '../../lib/capture/media-stream';

interface BrowserBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
}

type BrowserBarcodeDetectorConstructor = new (options: { formats: string[] }) => BrowserBarcodeDetector;

export function CameraCapture({ mode, onCapture, onQr, onCancel, onImport }: CameraCaptureProps) {
  const { t } = useI18n();
  const { colors: c, radius, spacing } = useTokens();
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const deviceIdRef = useRef<string | null>(null);
  const capturedRef = useRef<CapturedImage | null>(null);
  const handedOff = useRef(false);
  const starting = useRef(false);
  const resumeAfterVisibility = useRef(false);
  const removeTrackListeners = useRef<(() => void) | null>(null);
  const qrLatched = useRef(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CapturedImage | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrSupported, setQrSupported] = useState(true);

  const stop = useCallback((updateState = true) => {
    generation.current += 1;
    starting.current = false;
    removeTrackListeners.current?.();
    removeTrackListeners.current = null;
    const active = stream.current;
    releaseMediaStream(active, video.current);
    stream.current = null;
    if (!active && video.current) video.current.srcObject = null;
    if (updateState) setReady(false);
  }, []);

  const start = useCallback(async (requestedDeviceId?: string | null) => {
    stop();
    const attempt = generation.current;
    setBusy(true);
    setError(null);
    starting.current = true;
    qrLatched.current = false;
    let next: MediaStream | null = null;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      starting.current = false;
      setError(t('capture.error.secureContext'));
      setBusy(false);
      return;
    }
    try {
      const selected = requestedDeviceId ?? deviceIdRef.current;
      next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: selected
          ? { deviceId: { exact: selected } }
          : { facingMode: mode === 'avatar' ? 'user' : { ideal: 'environment' } },
      });
      if (attempt !== generation.current) {
        releaseMediaStream(next, video.current);
        return;
      }
      stream.current = next;
      const ended = () => {
        if (stream.current !== next) return;
        resumeAfterVisibility.current = false;
        stop();
        setBusy(false);
        setError(t('capture.error.unavailable'));
      };
      const tracks = next.getTracks();
      tracks.forEach((track) => track.addEventListener('ended', ended));
      removeTrackListeners.current = () => {
        tracks.forEach((track) => track.removeEventListener('ended', ended));
      };
      if (video.current) {
        video.current.srcObject = next;
        await video.current.play();
      }
      if (attempt !== generation.current) {
        releaseMediaStream(next, video.current);
        if (stream.current === next) stream.current = null;
        return;
      }
      const available = (await navigator.mediaDevices.enumerateDevices()).filter((item) => item.kind === 'videoinput');
      if (attempt !== generation.current) {
        releaseMediaStream(next, video.current);
        if (stream.current === next) stream.current = null;
        return;
      }
      setDevices(available);
      const activeId = next.getVideoTracks()[0]?.getSettings().deviceId ?? selected ?? null;
      deviceIdRef.current = activeId;
      setDeviceId(activeId);
      setReady(true);
    } catch (reason) {
      // `play()` and `enumerateDevices()` can reject after permission was
      // granted. Release that already-open stream before rendering the error.
      releaseMediaStream(next, video.current);
      if (stream.current === next) stream.current = null;
      if (attempt !== generation.current) return;
      setReady(false);
      const name = (reason as { name?: string }).name;
      setError(name === 'NotAllowedError'
        ? t('capture.error.denied')
        : name === 'NotFoundError'
          ? t('capture.error.unavailable')
          : t('capture.error.busy'));
    } finally {
      if (attempt === generation.current) {
        starting.current = false;
        setBusy(false);
      }
    }
  }, [mode, stop, t]);

  useEffect(() => {
    void start(null);
    const visibility = () => {
      if (document.hidden) {
        resumeAfterVisibility.current = Boolean(stream.current || starting.current) &&
          !capturedRef.current && !handedOff.current;
        stop();
        return;
      }
      if (
        resumeAfterVisibility.current &&
        !capturedRef.current &&
        !handedOff.current
      ) {
        resumeAfterVisibility.current = false;
        void start(deviceIdRef.current);
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      stop(false);
    };
    // This effect intentionally follows only the capture lifecycle/mode. Device
    // changes call start directly, avoiding a second getUserMedia request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => () => {
    const image = capturedRef.current;
    if (!handedOff.current && image?.uri.startsWith('blob:')) URL.revokeObjectURL(image.uri);
  }, []);

  useEffect(() => {
    if (mode !== 'qr' || !ready || !video.current) return;
    const Detector = (window as unknown as { BarcodeDetector?: BrowserBarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) {
      setQrSupported(false);
      return;
    }
    setQrSupported(true);
    const detector = new Detector({ formats: ['qr_code'] });
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const read = async () => {
      if (cancelled || qrLatched.current || !video.current) return;
      try {
        const result = await detector.detect(video.current);
        const value = result[0]?.rawValue;
        if (value) {
          qrLatched.current = true;
          resumeAfterVisibility.current = false;
          stop();
          onQr?.(value);
          return;
        }
      } catch {
        // A frame can be unreadable while the stream is starting; keep scanning.
      }
      timer = setTimeout(read, 350);
    };
    void read();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mode, onQr, ready, stop]);

  const capture = async () => {
    const source = video.current;
    if (!source || !source.videoWidth || !source.videoHeight) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      const avatarEdge = Math.min(source.videoWidth, source.videoHeight);
      canvas.width = mode === 'avatar' ? avatarEdge : source.videoWidth;
      canvas.height = mode === 'avatar' ? avatarEdge : source.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      const sx = mode === 'avatar' ? (source.videoWidth - avatarEdge) / 2 : 0;
      const sy = mode === 'avatar' ? (source.videoHeight - avatarEdge) / 2 : 0;
      context.drawImage(source, sx, sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('blob')), 'image/jpeg', 0.9));
      const name = `capture-${Date.now()}.jpg`;
      const file = new File([blob], name, { type: 'image/jpeg' });
      const image = {
        uri: URL.createObjectURL(file),
        name,
        mimeType: file.type,
        width: canvas.width,
        height: canvas.height,
        size: file.size,
        file,
      } satisfies CapturedImage;
      resumeAfterVisibility.current = false;
      stop();
      capturedRef.current = image;
      handedOff.current = false;
      setCaptured(image);
    } catch {
      setError(t('capture.error.capture'));
    } finally {
      setBusy(false);
    }
  };

  const retake = () => {
    if (captured?.uri.startsWith('blob:')) URL.revokeObjectURL(captured.uri);
    capturedRef.current = null;
    handedOff.current = false;
    setCaptured(null);
    resumeAfterVisibility.current = false;
    void start(deviceIdRef.current);
  };

  const cancel = () => {
    const image = capturedRef.current;
    if (image?.uri.startsWith('blob:')) URL.revokeObjectURL(image.uri);
    capturedRef.current = null;
    resumeAfterVisibility.current = false;
    stop();
    onCancel();
  };

  const confirm = () => {
    if (!captured) return;
    resumeAfterVisibility.current = false;
    handedOff.current = true;
    onCapture?.(captured);
  };

  const importFallback = () => {
    resumeAfterVisibility.current = false;
    handedOff.current = true;
    stop();
    onImport?.();
  };

  if (captured) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Image source={{ uri: captured.uri }} resizeMode="cover" style={{ width: '100%', aspectRatio: mode === 'avatar' ? 1 : 4 / 3, borderRadius: radius.md }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button variant="secondary" label={t('capture.retake')} onPress={retake} />
          <Button label={t('capture.confirm')} onPress={confirm} />
          <Button variant="ghost" label={t('learn5.cancel')} onPress={cancel} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {error ? <Alert tone="error" title={error} detail={t('capture.error.fallback')} /> : null}
      <View style={{ position: 'relative', overflow: 'hidden', borderRadius: radius.md, backgroundColor: '#000', aspectRatio: mode === 'avatar' ? 1 : 4 / 3 }}>
        {createElement('video', {
          ref: (element: HTMLVideoElement | null) => { video.current = element; },
          autoPlay: true,
          playsInline: true,
          muted: true,
          'aria-label': t('capture.preview'),
          style: { width: '100%', height: '100%', objectFit: 'cover' },
        })}
        {mode === 'document' || mode === 'qr' ? <View pointerEvents="none" style={{ position: 'absolute', inset: 24, borderWidth: 2, borderColor: '#FFFFFFCC', borderRadius: radius.sm }} /> : null}
      </View>
      {devices.length > 1 ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: c.textSecondary, fontWeight: '700' }}>{t('capture.cameraChoice')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {devices.map((item, index) => (
              <Pressable
                key={item.deviceId}
                accessibilityRole="button"
                accessibilityState={{ selected: deviceId === item.deviceId }}
                onPress={() => void start(item.deviceId)}
                style={{ borderWidth: 1, borderColor: deviceId === item.deviceId ? c.aiAccent : c.border, borderRadius: radius.sm, padding: spacing.sm }}
              >
                <Text style={{ color: c.textPrimary }}>{item.label || `${t('capture.camera')} ${index + 1}`}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {mode === 'qr' && !qrSupported ? <Alert tone="warning" title={t('qr.unsupported')} detail={t('qr.unsupportedDetail')} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {mode !== 'qr' ? <Button label={t('capture.take')} loading={busy} disabled={!ready} onPress={() => void capture()} /> : null}
        {onImport ? <Button variant="secondary" label={t('capture.importFallback')} onPress={importFallback} /> : null}
        <Button variant="ghost" label={t('learn5.cancel')} onPress={cancel} />
      </View>
      {busy ? <Text style={{ color: c.textMuted }}>{t('capture.permission.pending')}</Text> : null}
      {mode === 'qr' ? <Text style={{ color: c.textMuted }}>{t('qr.aim')}</Text> : null}
    </View>
  );
}
