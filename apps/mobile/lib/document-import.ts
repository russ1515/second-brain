import * as DocumentPicker from 'expo-document-picker';
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
  await appendPickedDocument(form, image ? 'images' : 'file', document);
  return apiUpload<DocumentDetail>(image ? '/documents/scan' : '/documents/upload', form);
}
