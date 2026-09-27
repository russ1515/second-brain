import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, apiBinary, apiUpload } from '../client';
import { appendPickedDocument } from '../document-import';
import type { CapturedImage } from '../capture/types';

export type PickResult =
  | { ok: true; image: CapturedImage }
  | { ok: false; reason: 'cancelled' | 'denied' | 'error' };

export interface SavedAvatarPhoto {
  /** Confirmed server bytes when read-back succeeds, otherwise the local
   * normalized preview for the upload that the server already accepted. */
  uri: string;
  readback: 'confirmed' | 'unconfirmed';
}

const listeners = new Map<string, Set<(uri: string | null) => void>>();

export function subscribeAvatarPhoto(
  userId: string,
  listener: (uri: string | null) => void,
): () => void {
  const ownerListeners = listeners.get(userId) ?? new Set();
  ownerListeners.add(listener);
  listeners.set(userId, ownerListeners);
  return () => {
    ownerListeners.delete(listener);
    if (ownerListeners.size === 0) listeners.delete(userId);
  };
}

function publish(userId: string, uri: string | null): void {
  listeners.get(userId)?.forEach((listener) => listener(uri));
}

async function ensurePermission(source: 'camera' | 'gallery'): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const result = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  return result.granted;
}

/** Gallery fallback. Live camera capture uses the shared CameraCapture layer so
 * desktop can choose a webcam and every platform has retake/confirm/cancel. */
export async function pickPhoto(source: 'camera' | 'gallery'): Promise<PickResult> {
  try {
    if (!(await ensurePermission(source))) return { ok: false, reason: 'denied' };
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return { ok: false, reason: 'cancelled' };
    const asset = result.assets[0];
    return {
      ok: true,
      image: {
        uri: asset.uri,
        name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        width: asset.width,
        height: asset.height,
        size: asset.fileSize ?? null,
        ...(asset.file ? { file: asset.file } : {}),
      },
    };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function loadAvatarPhoto(): Promise<string | null> {
  const response = await apiBinary('/profile/avatar');
  if (!response) return null;
  return `data:${response.contentType};base64,${arrayBufferToBase64(response.data)}`;
}

export async function saveAvatarPhoto(userId: string, image: CapturedImage): Promise<SavedAvatarPhoto> {
  const form = new FormData();
  await appendPickedDocument(form, 'file', image);
  // Nothing is published until the authenticated PUT itself succeeds. A
  // rejected upload therefore leaves both the current UI and other surfaces
  // on the previous avatar.
  await apiUpload('/profile/avatar', form, { method: 'PUT' });
  try {
    const stored = await loadAvatarPhoto();
    if (stored) {
      publish(userId, stored);
      return { uri: stored, readback: 'confirmed' };
    }
  } catch {
    // The mutation has already succeeded. A transient read-back failure must
    // not be reported as a failed upload or as preservation of the old photo.
  }

  // Keep all surfaces coherent with the successful mutation using the local
  // normalized preview. The backend still serves binary media; no Base64 is
  // added to an API payload.
  publish(userId, image.uri);
  return { uri: image.uri, readback: 'unconfirmed' };
}

export async function clearAvatarPhoto(userId: string): Promise<void> {
  await api('/profile/avatar', { method: 'DELETE' });
  publish(userId, null);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
