import { useEffect, useRef, useState } from 'react';
import { Image, Linking, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { DocumentDetail } from '@second-brain/shared';
import { ApiError, apiUpload } from '../lib/client';
import { createClientRequestId } from '../lib/request-id';
import { appendPickedDocument, type PickedDocument } from '../lib/document-import';
import { useTokens } from '../lib/design/theme';
import { useI18n } from '../lib/i18n';
import { classifyQrPayload, type QrPayload } from '../lib/capture/qr-safety';
import type { CapturedImage } from '../lib/capture/types';
import { CameraCapture } from '../components/capture/camera-capture';
import { Alert, Button, Card } from '../components/ds/core';

const MAX_PAGES = 8;
const CROP_STEPS = [0, 0.04, 0.08, 0.12] as const;

interface ScanPage extends CapturedImage {
  /** Stable identity: async image transforms must not target a different page
   * after a reorder/removal. This value never leaves the client. */
  id: string;
  originalUri: string;
  originalWidth: number;
  originalHeight: number;
  rotation: 0 | 90 | 180 | 270;
  cropStep: number;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function ScanScreen() {
  const { colors: c, spacing, radius, typography } = useTokens();
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[]; source?: string | string[] }>();
  const mode = first(params.mode) === 'qr' ? 'qr' : 'document';
  const source = first(params.source);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [selected, setSelected] = useState(0);
  const [title, setTitle] = useState('');
  const [cameraOpen, setCameraOpen] = useState(mode === 'qr');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DocumentDetail | null>(null);
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [qrAttempt, setQrAttempt] = useState(0);
  const uploadRequestId = useRef<string | null>(null);

  const activePage = pages[selected] ?? null;
  const remaining = MAX_PAGES - pages.length;
  const canAdd = remaining > 0;

  const makePage = (image: CapturedImage): ScanPage => ({
    ...image,
    id: createClientRequestId('scan-page'),
    originalUri: image.uri,
    originalWidth: image.width,
    originalHeight: image.height,
    rotation: 0,
    cropStep: 0,
  });

  const addCaptured = (image: CapturedImage) => {
    setPages((current) => [...current, makePage(image)].slice(0, MAX_PAGES));
    setSelected(pages.length);
    setCameraOpen(false);
    uploadRequestId.current = null;
  };

  const addPicked = (assets: ImagePicker.ImagePickerAsset[]) => {
    const next = assets.slice(0, remaining).map((asset, index) => makePage({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? `page-${Date.now()}-${index + 1}.jpg`,
      size: asset.fileSize ?? null,
      width: asset.width,
      height: asset.height,
      ...(asset.file ? { file: asset.file } : {}),
    }));
    setPages((current) => [...current, ...next].slice(0, MAX_PAGES));
    if (next.length) setSelected(pages.length);
    uploadRequestId.current = null;
  };

  const pick = async () => {
    setError(null);
    if (!canAdd) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (!result.canceled) addPicked(result.assets);
    } catch {
      setError(t('scan.importError'));
    }
  };

  const transform = async (index: number, change: 'rotate' | 'crop') => {
    const page = pages[index];
    if (!page || busy) return;
    setBusy(true);
    setError(null);
    try {
      const rotation = change === 'rotate' ? ((page.rotation + 90) % 360) as ScanPage['rotation'] : page.rotation;
      const cropStep = change === 'crop' ? (page.cropStep + 1) % CROP_STEPS.length : page.cropStep;
      const inset = CROP_STEPS[cropStep];
      const actions: Action[] = [];
      if (inset > 0) {
        actions.push({ crop: {
          originX: Math.round(page.originalWidth * inset),
          originY: Math.round(page.originalHeight * inset),
          width: Math.max(1, Math.round(page.originalWidth * (1 - inset * 2))),
          height: Math.max(1, Math.round(page.originalHeight * (1 - inset * 2))),
        } });
      }
      if (rotation) actions.push({ rotate: rotation });
      const result = actions.length
        ? await manipulateAsync(page.originalUri, actions, { compress: 0.9, format: SaveFormat.JPEG })
        : { uri: page.originalUri, width: page.originalWidth, height: page.originalHeight };
      setPages((current) => current.map((item) => item.id === page.id ? {
        ...item,
        uri: result.uri,
        width: result.width,
        height: result.height,
        mimeType: 'image/jpeg',
        name: item.name.replace(/\.[^.]+$/, '.jpg'),
        file: undefined,
        rotation,
        cropStep,
      } : item));
      uploadRequestId.current = null;
    } catch {
      setError(t('scan.editError'));
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    if (busy) return;
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    setPages((current) => {
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    setSelected(target);
    uploadRequestId.current = null;
  };

  const remove = (index: number) => {
    if (busy) return;
    setPages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setSelected((current) => Math.max(0, Math.min(current, pages.length - 2)));
    uploadRequestId.current = null;
  };

  const upload = async () => {
    if (!pages.length) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const page of pages) await appendPickedDocument(form, 'images', page as PickedDocument);
      if (title.trim()) form.append('title', title.trim());
      const requestId = uploadRequestId.current ?? createClientRequestId('scan');
      uploadRequestId.current = requestId;
      const document = await apiUpload<DocumentDetail>('/documents/scan', form, { requestId });
      setDone(document);
    } catch (reason) {
      const code = reason instanceof ApiError && reason.payload && typeof reason.payload === 'object'
        ? (reason.payload as { code?: unknown }).code
        : null;
      if (code === 'SCAN_ATTEMPT_FAILED') {
        // The previous provider operation is terminal and must never be replayed
        // under the same ledger key. The next explicit click starts a new attempt.
        uploadRequestId.current = null;
        setError(t('scan.retryNewAttempt'));
      } else if (code === 'SCAN_IN_PROGRESS') {
        setError(t('scan.inProgress'));
      } else {
        setError(reason instanceof ApiError ? t('scan.uploadError') : (reason as Error).message || t('scan.uploadError'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleQr = (value: string) => {
    setError(null);
    setQr(classifyQrPayload(value));
    setCameraOpen(false);
  };

  const scanAgain = () => {
    setError(null);
    setQr(null);
    setQrAttempt((value) => value + 1);
    setCameraOpen(true);
  };

  const openQrDestination = async (url: string) => {
    setError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setError(t('qr.openError'));
    }
  };

  useEffect(() => {
    if (mode !== 'qr' || !cameraOpen || qr) return;
    const timer = setTimeout(() => {
      setCameraOpen(false);
      setError(t('qr.noneFound'));
    }, 30_000);
    return () => clearTimeout(timer);
  }, [cameraOpen, mode, qr, t]);

  if (mode === 'qr') {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('qr.title')}</Text>
        <Text style={[typography.body, { color: c.textSecondary }]}>{t('qr.detail')}</Text>
        {cameraOpen ? <CameraCapture key={qrAttempt} mode="qr" onQr={handleQr} onCancel={() => router.back()} /> : null}
        {error && !qr ? (
          <Card style={{ gap: spacing.sm }}>
            <Alert tone="warning" title={t('qr.noneFound')} detail={error} />
            <Button variant="secondary" label={t('qr.scanAgain')} onPress={scanAgain} />
            <Button variant="ghost" label={t('learn5.cancel')} onPress={() => router.back()} />
          </Card>
        ) : null}
        {qr?.kind === 'url' ? (
          <Card style={{ gap: spacing.sm }}>
            <Alert tone="info" title={t('qr.detected')} detail={t('qr.confirmDetail')} />
            <Text selectable style={{ color: c.textPrimary }}>{qr.url}</Text>
            {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
            <Button label={t('qr.open')} onPress={() => void openQrDestination(qr.url)} />
            <Button variant="secondary" label={t('qr.scanAgain')} onPress={scanAgain} />
            <Button variant="ghost" label={t('learn5.cancel')} onPress={() => router.back()} />
          </Card>
        ) : null}
        {qr?.kind === 'text' ? (
          <Card style={{ gap: spacing.sm }}>
            <Alert tone="info" title={t('qr.textDetected')} detail={t('qr.textInert')} />
            <Text selectable style={{ color: c.textPrimary }}>{qr.raw}</Text>
            <Button variant="secondary" label={t('qr.scanAgain')} onPress={scanAgain} />
            <Button variant="ghost" label={t('qr.done')} onPress={() => router.back()} />
          </Card>
        ) : null}
        {qr?.kind === 'blocked' ? (
          <Card style={{ gap: spacing.sm }}>
            <Alert tone="error" title={t('qr.blocked')} detail={t('qr.blockedDetail')} />
            <Text selectable numberOfLines={4} style={{ color: c.textMuted }}>{qr.raw}</Text>
            <Button variant="secondary" label={t('qr.scanAgain')} onPress={scanAgain} />
            <Button variant="ghost" label={t('qr.done')} onPress={() => router.back()} />
          </Card>
        ) : null}
      </ScrollView>
    );
  }

  if (done) {
    const awaitingAnalysis = done.status === 'pending' && done.charCount === 0;
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
        <Card style={{ gap: spacing.sm }}>
          <Text style={[typography.h2, { color: c.success }]}>
            {t(awaitingAnalysis ? 'scan.captured' : 'scan.filed')}
          </Text>
          <Text style={[typography.title, { color: c.textPrimary }]}>{done.title}</Text>
          <Text style={[typography.body, { color: c.textSecondary }]}>
            {awaitingAnalysis
              ? t('scan.capturedDetail')
              : t('scan.filedDetail').replace('{n}', String(done.charCount))}
          </Text>
        </Card>
        {done.content ? <Text style={{ color: c.textSecondary }} numberOfLines={12}>{done.content}</Text> : null}
        {source === 'learn' ? <Button label={t('scan.returnToLearn')} onPress={() => router.replace({ pathname: '/learn', params: { documentId: done.id } })} /> : null}
        <Button variant="secondary" label={t('scan.openDocument')} onPress={() => router.replace(`/library/${done.id}`)} />
        <Button variant="ghost" label={t('scan.scanAnother')} onPress={() => { setDone(null); setPages([]); setSelected(0); uploadRequestId.current = null; }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, maxWidth: 920, width: '100%', alignSelf: 'center' }}>
      <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('scan.title')}</Text>
      <Text style={[typography.body, { color: c.textSecondary }]}>{t('scan.help').replace('{max}', String(MAX_PAGES))}</Text>
      <Alert tone="info" title={t('scan.captureFirst')} detail={t('scan.captureFirstDetail')} />
      {error ? <Alert tone="error" title={error} detail={t('scan.retryPreserved')} /> : null}
      {cameraOpen ? (
        <Card style={{ gap: spacing.sm }}>
          <CameraCapture mode="document" onCapture={addCaptured} onCancel={() => setCameraOpen(false)} onImport={() => { setCameraOpen(false); void pick(); }} />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button label={t('scan.takePhoto')} disabled={!canAdd || busy} onPress={() => setCameraOpen(true)} />
          <Button variant="secondary" label={t('scan.chooseImages')} disabled={!canAdd || busy} onPress={() => void pick()} />
        </View>
      )}
      {activePage ? (
        <Card style={{ gap: spacing.sm }}>
          <Image source={{ uri: activePage.uri }} resizeMode="contain" style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.sm, backgroundColor: c.surfaceSunken }} />
          <Text style={{ color: c.textSecondary }}>{t('scan.pagePosition').replace('{current}', String(selected + 1)).replace('{total}', String(pages.length))}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <Button size="sm" variant="secondary" label={t('scan.moveBefore')} disabled={selected === 0 || busy} onPress={() => move(selected, -1)} />
            <Button size="sm" variant="secondary" label={t('scan.moveAfter')} disabled={selected === pages.length - 1 || busy} onPress={() => move(selected, 1)} />
            <Button size="sm" variant="secondary" label={t('scan.rotate')} loading={busy} onPress={() => void transform(selected, 'rotate')} />
            <Button size="sm" variant="secondary" label={t('scan.crop')} loading={busy} onPress={() => void transform(selected, 'crop')} />
            <Button size="sm" variant="ghost" label={t('scan.remove')} disabled={busy} onPress={() => remove(selected)} />
          </View>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>{t('scan.perspectiveLimit')}</Text>
        </Card>
      ) : null}
      {pages.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: c.textPrimary, fontWeight: '700' }}>{t('scan.pagesReady').replace('{n}', String(pages.length))}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {pages.map((page, index) => <Button key={page.id} size="sm" variant={index === selected ? 'primary' : 'secondary'} label={`${index + 1}`} disabled={busy} onPress={() => setSelected(index)} />)}
          </View>
          <TextInput
            value={title}
            editable={!busy}
            onChangeText={(value) => { setTitle(value); uploadRequestId.current = null; }}
            placeholder={t('scan.titlePlaceholder')}
            placeholderTextColor={c.textMuted}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.sm, color: c.textPrimary, backgroundColor: c.surface }}
          />
          <Button label={t('scan.readPages')} loading={busy} disabled={!pages.length || cameraOpen || busy} onPress={() => void upload()} />
        </View>
      ) : null}
    </ScrollView>
  );
}
