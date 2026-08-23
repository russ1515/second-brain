import { useState, useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import type { DocumentDetail } from '@second-brain/shared';
import { apiUpload } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n } from '../lib/i18n';
import { Button, Card, ErrorBanner } from '../components/ui';

const MAX_PAGES = 8;

interface Page {
  uri: string;
  mimeType: string;
  name: string;
}

/**
 * Photograph or scan course material into the learner's memory.
 *
 * There is no OCR engine behind this: the vision-capable LLM transcribes the
 * pages, and the result goes through the same document pipeline as anything
 * typed — so a photographed page is searchable and can ground a lesson.
 */
export default function ScanScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DocumentDetail | null>(null);

  const add = (assets: ImagePicker.ImagePickerAsset[]) => {
    const next = assets.map((a) => ({
      uri: a.uri,
      mimeType: a.mimeType ?? 'image/jpeg',
      name: a.fileName ?? `page-${Date.now()}.jpg`,
    }));
    setPages((p) => [...p, ...next].slice(0, MAX_PAGES));
  };

  const shoot = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError(t('scan.cameraRefused'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) add(result.assets);
  };

  const pick = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PAGES,
      quality: 0.8,
    });
    if (!result.canceled) add(result.assets);
  };

  const upload = async () => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const page of pages) {
        // On web the picker gives a blob: URI; the API needs the actual bytes.
        const blob = await (await fetch(page.uri)).blob();
        form.append('images', blob, page.name);
      }
      if (title.trim()) form.append('title', title.trim());
      const doc = await apiUpload<DocumentDetail>('/documents/scan', form);
      setDone(doc);
      setPages([]);
      setTitle('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.ok}>
          <Text style={styles.okTitle}>{t('scan.filed')}</Text>
          <Text style={styles.okBody}>“{done.title}”</Text>
          <Text style={styles.okDetail}>
            {t('scan.filedDetail').replace('{n}', String(done.charCount))}
          </Text>
        </Card>
        <Text style={styles.preview} numberOfLines={12}>
          {done.content}
        </Text>
        <Button label={t('scan.scanAnother')} onPress={() => setDone(null)} />
        <Button variant="ghost" label={t('common.backToday')} onPress={() => router.replace('/')} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('scan.title')}</Text>
      <Text style={styles.help}>
        {t('scan.help').replace('{max}', String(MAX_PAGES))}
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label={t('scan.takePhoto')} onPress={shoot} disabled={busy} />
        </View>
        <View style={styles.flex}>
          <Button variant="ghost" label={t('scan.chooseImages')} onPress={pick} disabled={busy} />
        </View>
      </View>

      {pages.length > 0 ? (
        <>
          <Text style={styles.count}>
            {t('scan.pagesReady').replace('{n}', String(pages.length))}
          </Text>
          <View style={styles.thumbs}>
            {pages.map((p, i) => (
              <View key={i} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.thumb} />
                <Text
                  style={styles.remove}
                  onPress={() => setPages((all) => all.filter((_, n) => n !== i))}
                >
                  {t('scan.remove')}
                </Text>
              </View>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('scan.titlePlaceholder')}
            placeholderTextColor={c.textMuted}
            value={title}
            onChangeText={setTitle}
            testID="scan-title"
          />
          <Button label={t('scan.readPages')} onPress={upload} busy={busy} />
          {busy ? (
            <Text style={styles.help}>{t('scan.reading')}</Text>
          ) : null}
        </>
      ) : null}

      <Button variant="ghost" label={t('common.backToday')} onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 26, fontWeight: '700', color: c.textPrimary },
  help: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  count: { fontSize: 13, color: c.textMuted, marginTop: 6 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { alignItems: 'center', gap: 4 },
  thumb: {
    width: 92,
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
  },
  remove: { color: c.textMuted, fontSize: 12 },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: c.textPrimary,
  },
  ok: { backgroundColor: c.successSoft, borderColor: c.success },
  okTitle: { color: '#D1FAE5', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  okBody: { color: c.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 4 },
  okDetail: { color: '#CBD5E1', fontSize: 13, marginTop: 8, lineHeight: 19 },
  preview: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    backgroundColor: c.surface,
    borderRadius: 10,
    padding: 12,
  },
});
