import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import type { DocumentDetail } from '@second-brain/shared';
import { apiUpload } from './client';

export interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
  file?: File;
}

/** One capture seam shared by Learn and Library. Images are sent through the
 * scan endpoint; supported document files use the ordinary upload endpoint. */
export async function pickDocuments(multiple = false): Promise<PickedDocument[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'text/plain', 'text/markdown', 'image/*'],
    copyToCacheDirectory: true,
    multiple,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType || 'application/octet-stream',
    size: asset.size ?? null,
    ...(asset.file ? { file: asset.file } : {}),
  }));
}

export async function appendPickedDocument(
  form: FormData,
  field: 'file' | 'images',
  document: PickedDocument,
): Promise<void> {
  if (Platform.OS === 'web' && document.file) {
    form.append(field, document.file, document.name);
    return;
  }
  if (Platform.OS === 'web') {
    const blob = await (await fetch(document.uri)).blob();
    form.append(field, blob, document.name);
    return;
  }
  form.append(field, {
    uri: document.uri,
    name: document.name,
    type: document.mimeType,
  } as unknown as Blob);
}

export function isImageDocument(document: PickedDocument): boolean {
  return document.mimeType.startsWith('image/');
}

export async function uploadPickedDocument(document: PickedDocument): Promise<DocumentDetail> {
  const image = isImageDocument(document);
  const form = new FormData();
  // The API's 100 MB / 50-page safety envelope intentionally caps each scan
  // page at 2 MB. Normalize only oversized or unknown-size picker photos here,
  // just as the dedicated Scan screen does, so a modern camera photo reaches
  // the shared ingestion path without weakening that server-side bound.
  const upload = image && (!document.size || document.size > 2 * 1024 * 1024)
    ? await manipulateAsync(
        document.uri,
        [{ resize: { width: 2000 } }],
        { compress: 0.72, format: SaveFormat.JPEG },
      ).then((result): PickedDocument => ({
        uri: result.uri,
        name: document.name.replace(/\.[^.]+$/, '') + '.jpg',
        mimeType: 'image/jpeg',
        size: null,
      }))
    : document;
  await appendPickedDocument(form, image ? 'images' : 'file', upload);
  if (image) form.append('contentType', 'PHOTO');
  return apiUpload<DocumentDetail>(image ? '/documents/scan' : '/documents/upload', form);
}
