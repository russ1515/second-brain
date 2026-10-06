import { createElement, useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Collection, DocumentDetail } from '@second-brain/shared';
import { ApiError, api, apiUpload } from '../lib/client';
import { createClientRequestId } from '../lib/request-id';
import { appendPickedDocument, type PickedDocument } from '../lib/document-import';
import { useTokens } from '../lib/design/theme';
import { useI18n } from '../lib/i18n';
import { classifyQrPayload, type QrPayload } from '../lib/capture/qr-safety';
import { createObjectUrlLease } from '../lib/capture/object-url-lease';
import {
  defaultScanQuadrilateral,
  isValidScanQuadrilateral,
  type ScanQuadrilateral,
} from '../lib/capture/scan-geometry';
import type { CapturedImage } from '../lib/capture/types';
import { CameraCapture } from '../components/capture/camera-capture';
import { ScanCornerEditor } from '../components/capture/scan-corner-editor';
import { Alert, Button, Card } from '../components/ds/core';

const MAX_PAGES = 50;

interface ScanPage extends CapturedImage {
  /** Stable identity: async image transforms must not target a different page
   * after a reorder/removal. This value never leaves the client. */
  id: string;
  originalUri: string;
  originalWidth: number;
  originalHeight: number;
  rotation: 0 | 90 | 180 | 270;
  corners: ScanQuadrilateral;
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
  const [subject, setSubject] = useState('');
  const [language, setLanguage] = useState('');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [cameraOpen, setCameraOpen] = useState(mode === 'qr');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DocumentDetail | null>(null);
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [qrAttempt, setQrAttempt] = useState(0);
  const [failedScanDocumentId, setFailedScanDocumentId] = useState<string | null>(null);
  const [editingCorners, setEditingCorners] = useState(false);
  const [dragPageId, setDragPageId] = useState<string | null>(null);
  const uploadRequestId = useRef<string | null>(null);
  const objectUrls = useRef(createObjectUrlLease());
  const releaseObjectUrlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activePage = pages[selected] ?? null;
  const remaining = MAX_PAGES - pages.length;
  const canAdd = remaining > 0;

  const movePageTo = (pageId: string, destination: number) => {
    setPages((current) => {
      const source = current.findIndex((page) => page.id === pageId);
      if (source < 0 || source === destination) return current;
      const next = [...current];
      const [page] = next.splice(source, 1);
      next.splice(destination, 0, page);
      setSelected(destination);
      uploadRequestId.current = null;
      return next;
    });
  };

  useEffect(() => {
    objectUrls.current.replace(pages.flatMap((page) => [page.originalUri, page.uri]));
  }, [pages]);

  useEffect(() => {
    // React Strict Mode performs a development-only cleanup/setup cycle. Delay
    // route cleanup by one task so that setup can cancel it instead of revoking
    // a handed-off preview while the screen is still mounted.
    if (releaseObjectUrlsTimer.current) {
      clearTimeout(releaseObjectUrlsTimer.current);
      releaseObjectUrlsTimer.current = null;
    }
    return () => {
      releaseObjectUrlsTimer.current = setTimeout(() => {
        objectUrls.current.releaseAll();
        releaseObjectUrlsTimer.current = null;
      }, 0);
    };
  }, []);

  useEffect(() => {
    void api<Collection[]>('/library/collections')
      .then(setCollections)
      .catch(() => setCollections([]));
  }, []);

  const makePage = (image: CapturedImage): ScanPage => ({
    ...image,
    id: createClientRequestId('scan-page'),
    originalUri: image.uri,
    originalWidth: image.width,
    originalHeight: image.height,
    rotation: 0,
    corners: defaultScanQuadrilateral(),
  });

  const addCaptured = (image: CapturedImage) => {
    setPages((current) => [...current, makePage(image)].slice(0, MAX_PAGES));
    setSelected(pages.length);
    setEditingCorners(true);
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
    if (next.length) setEditingCorners(true);
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

  const rotate = async (index: number) => {
    const page = pages[index];
    if (!page || busy) return;
    setBusy(true);
    setError(null);
    try {
      const rotation = ((page.rotation + 90) % 360) as ScanPage['rotation'];
      const actions: Action[] = [];
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
        corners: defaultScanQuadrilateral(),
      } : item));
      setEditingCorners(true);
      uploadRequestId.current = null;
    } catch {
      setError(t('scan.editError'));
    } finally {
      setBusy(false);
    }
  };

  const updateCorners = (pageId: string, corners: ScanQuadrilateral) => {
    setPages((current) => current.map((page) => page.id === pageId ? { ...page, corners } : page));
    uploadRequestId.current = null;
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
    setEditingCorners(true);
    uploadRequestId.current = null;
  };

  const remove = (index: number) => {
    if (busy) return;
    setPages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setSelected((current) => Math.max(0, Math.min(current, pages.length - 2)));
    setEditingCorners(true);
    uploadRequestId.current = null;
  };

  const upload = async () => {
    if (!pages.length) return;
    if (pages.some((page) => !isValidScanQuadrilateral(page.corners))) {
      setError(t('scan.editError'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const page of pages) {
        const resized = await manipulateAsync(
          page.uri,
          page.width > 2000 ? [{ resize: { width: 2000 } }] : [],
          { compress: 0.72, format: SaveFormat.JPEG },
        );
        await appendPickedDocument(form, 'images', {
          uri: resized.uri,
          name: page.name.replace(/\.[^.]+$/, '') + '.jpg',
          mimeType: 'image/jpeg',
          size: null,
        });
      }
      form.append('pageEdits', JSON.stringify(pages.map((page) => ({ corners: page.corners }))));
      form.append('contentType', pages.length > 1 ? 'NOTEBOOK' : 'SCAN');
      if (title.trim()) form.append('title', title.trim());
      if (subject.trim()) form.append('subject', subject.trim());
      if (language.trim()) form.append('language', language.trim());
      if (collectionId) form.append('collectionId', collectionId);
      const requestId = uploadRequestId.current ?? createClientRequestId('scan');
      uploadRequestId.current = requestId;
      const document = await apiUpload<DocumentDetail>('/documents/scan', form, { requestId });
      setDone(document);
      setPages([]);
      setFailedScanDocumentId(null);
    } catch (reason) {
      const payload = reason instanceof ApiError && reason.payload && typeof reason.payload === 'object'
        ? reason.payload as { code?: unknown; documentId?: unknown }
        : null;
      const code = payload?.code;
      if (code === 'SCAN_ATTEMPT_FAILED') {
        // The durable document owns the captured pages. Never create a fresh
        // scan implicitly: the explicit retry route rereads those exact bytes.
        if (typeof payload?.documentId === 'string' && payload.documentId) {
          setFailedScanDocumentId(payload.documentId);
          setError(t('document.pipeline.ocrFailed'));
        } else {
          setError(t('scan.uploadError'));
        }
      } else if (code === 'SCAN_IN_PROGRESS') {
        setError(t('scan.inProgress'));
      } else {
        setError(reason instanceof ApiError ? t('scan.uploadError') : (reason as Error).message || t('scan.uploadError'));
      }
    } finally {
      setBusy(false);
    }
  };

  const retrySavedScan = async () => {
    if (!failedScanDocumentId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const document = await api<DocumentDetail>(
        `/documents/${encodeURIComponent(failedScanDocumentId)}/retry-scan`,
        { method: 'POST' },
      );
      setDone(document);
      setPages([]);
      setFailedScanDocumentId(null);
    } catch (reason) {
      const payload = reason instanceof ApiError && reason.payload && typeof reason.payload === 'object'
        ? reason.payload as { code?: unknown; documentId?: unknown }
        : null;
      if (typeof payload?.documentId === 'string' && payload.documentId) {
        setFailedScanDocumentId(payload.documentId);
      }
      setError(payload?.code === 'SCAN_IN_PROGRESS'
        ? t('scan.inProgress')
        : t('document.pipeline.ocrFailed'));
    } finally {
      setBusy(false);
    }
  };

  const resetScan = () => {
    setDone(null);
    setPages([]);
    setSelected(0);
    setTitle('');
    setSubject('');
    setLanguage('');
    setCollectionId(null);
    setError(null);
    setFailedScanDocumentId(null);
    setEditingCorners(false);
    uploadRequestId.current = null;
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
        <Button variant="ghost" label={t('scan.scanAnother')} onPress={resetScan} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, maxWidth: 920, width: '100%', alignSelf: 'center' }}>
      <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('scan.title')}</Text>
      <Text style={[typography.body, { color: c.textSecondary }]}>{t('scan.help').replace('{max}', String(MAX_PAGES))}</Text>
      <Alert tone="info" title={t('scan.captureFirst')} detail={t('scan.captureFirstDetail')} />
      {error ? <Alert tone="error" title={error} detail={failedScanDocumentId ? t('document.pipeline.ocrRetryHelp') : t('scan.retryPreserved')} /> : null}
      {failedScanDocumentId ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button
            label={t('document.pipeline.retryOcr')}
            loading={busy}
            disabled={busy}
            onPress={() => void retrySavedScan()}
          />
          <Button variant="ghost" label={t('scan.scanAnother')} disabled={busy} onPress={resetScan} />
        </View>
      ) : null}
      {cameraOpen ? (
        <Card style={{ gap: spacing.sm }}>
          <CameraCapture mode="document" onCapture={addCaptured} onCancel={() => setCameraOpen(false)} onImport={() => { setCameraOpen(false); void pick(); }} />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button label={t('scan.takePhoto')} disabled={!canAdd || busy || Boolean(failedScanDocumentId)} onPress={() => setCameraOpen(true)} />
          <Button variant="secondary" label={t('scan.chooseImages')} disabled={!canAdd || busy || Boolean(failedScanDocumentId)} onPress={() => void pick()} />
        </View>
      )}
      {activePage ? (
        <Card style={{ gap: spacing.sm }}>
          <View style={{ position: 'relative', width: '100%', aspectRatio: 4 / 3, borderRadius: radius.sm, backgroundColor: c.surfaceSunken }}>
            <Image source={{ uri: activePage.uri }} resizeMode="contain" style={{ position: 'absolute', inset: 0, borderRadius: radius.sm }} />
            {editingCorners ? (
              <ScanCornerEditor
                corners={activePage.corners}
                imageWidth={activePage.width}
                imageHeight={activePage.height}
                color={c.aiAccent}
                label={t('scan.crop')}
                disabled={busy || Boolean(failedScanDocumentId)}
                onChange={(corners) => updateCorners(activePage.id, corners)}
              />
            ) : null}
          </View>
          <Text style={{ color: c.textSecondary }}>{t('scan.pagePosition').replace('{current}', String(selected + 1)).replace('{total}', String(pages.length))}</Text>
          {editingCorners ? <Text style={{ color: c.textMuted, fontSize: 12 }}>{t('scan.perspectiveLimit')}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <Button size="sm" variant="secondary" label={t('scan.moveBefore')} disabled={selected === 0 || busy || Boolean(failedScanDocumentId)} onPress={() => move(selected, -1)} />
            <Button size="sm" variant="secondary" label={t('scan.moveAfter')} disabled={selected === pages.length - 1 || busy || Boolean(failedScanDocumentId)} onPress={() => move(selected, 1)} />
            <Button size="sm" variant="secondary" label={t('scan.rotate')} loading={busy} disabled={Boolean(failedScanDocumentId)} onPress={() => void rotate(selected)} />
            <Button size="sm" variant={editingCorners ? 'primary' : 'secondary'} label={t('scan.crop')} disabled={busy || Boolean(failedScanDocumentId)} onPress={() => setEditingCorners((value) => !value)} />
            <Button size="sm" variant="ghost" label={t('scan.remove')} disabled={busy || Boolean(failedScanDocumentId)} onPress={() => remove(selected)} />
          </View>
        </Card>
      ) : null}
      {pages.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: c.textPrimary, fontWeight: '700' }}>{t('scan.pagesReady').replace('{n}', String(pages.length))}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {pages.map((page, index) => Platform.OS === 'web'
              ? createElement('button', {
                  key: page.id,
                  type: 'button',
                  draggable: !busy,
                  'aria-label': t('scan.pagePosition').replace('{current}', String(index + 1)).replace('{total}', String(pages.length)),
                  onClick: () => { setSelected(index); setEditingCorners(true); },
                  onDragStart: () => setDragPageId(page.id),
                  onDragOver: (event: { preventDefault: () => void }) => event.preventDefault(),
                  onDrop: (event: { preventDefault: () => void }) => {
                    event.preventDefault();
                    if (dragPageId) movePageTo(dragPageId, index);
                    setDragPageId(null);
                  },
                  onDragEnd: () => setDragPageId(null),
                  disabled: busy,
                  style: {
                    minWidth: 44,
                    minHeight: 40,
                    borderRadius: radius.sm,
                    border: `1px solid ${index === selected ? c.primary : c.border}`,
                    background: index === selected ? c.primary : c.surface,
                    color: index === selected ? c.onPrimary : c.textPrimary,
                    cursor: busy ? 'default' : 'grab',
                  },
                }, String(index + 1))
              : <Button key={page.id} size="sm" variant={index === selected ? 'primary' : 'secondary'} label={`${index + 1}`} disabled={busy} onPress={() => { setSelected(index); setEditingCorners(true); }} />)}
          </View>
          <TextInput
            value={title}
            editable={!busy && !failedScanDocumentId}
            onChangeText={(value) => { setTitle(value); uploadRequestId.current = null; }}
            placeholder={t('scan.titlePlaceholder')}
            placeholderTextColor={c.textMuted}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.sm, color: c.textPrimary, backgroundColor: c.surface }}
          />
          <TextInput
            value={subject}
            editable={!busy && !failedScanDocumentId}
            onChangeText={(value) => { setSubject(value); uploadRequestId.current = null; }}
            placeholder={t('lib.m.subject')}
            placeholderTextColor={c.textMuted}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.sm, color: c.textPrimary, backgroundColor: c.surface }}
          />
          <TextInput
            value={language}
            editable={!busy && !failedScanDocumentId}
            onChangeText={(value) => { setLanguage(value); uploadRequestId.current = null; }}
            placeholder={t('lib.m.language')}
            placeholderTextColor={c.textMuted}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.sm, color: c.textPrimary, backgroundColor: c.surface }}
          />
          {collections.length ? <View style={{ gap: spacing.xs }}>
            <Text style={{ color: c.textSecondary, fontWeight: '600' }}>{t('lib.m.collection')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Button label={t('library7.collection.none')} size="sm" variant={!collectionId ? 'primary' : 'ghost'} onPress={() => setCollectionId(null)} />
              {collections.map((collection) => <Button key={collection.id} label={collection.name} size="sm" variant={collectionId === collection.id ? 'primary' : 'ghost'} onPress={() => setCollectionId(collection.id)} />)}
            </View>
          </View> : null}
          {!failedScanDocumentId ? <Button testID="scan-submit" label={t('scan.readPages')} loading={busy} disabled={!pages.length || cameraOpen || busy} onPress={() => void upload()} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
