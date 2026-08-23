import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Profile photo (UI/UX Sprint 7).
 *
 * Wraps expo-image-picker for the camera / gallery flows with clean permission
 * handling and a square crop (`allowsEditing`, 1:1). The backend has no image
 * store yet, so the chosen photo URI is persisted LOCALLY (AsyncStorage) — the
 * seam to swap for a real upload later. Returns a typed result so the UI can
 * distinguish "cancelled" from "permission denied".
 */
const KEY = 'sb.avatarPhoto';

export type PickResult =
  | { ok: true; uri: string }
  | { ok: false; reason: 'cancelled' | 'denied' | 'error' };

async function ensurePermission(source: 'camera' | 'gallery'): Promise<boolean> {
  const res =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  return res.granted;
}

export async function pickPhoto(source: 'camera' | 'gallery'): Promise<PickResult> {
  try {
    if (!(await ensurePermission(source))) return { ok: false, reason: 'denied' };
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // instant square crop preview (task 1)
      aspect: [1, 1],
      quality: 0.7,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || result.assets.length === 0) return { ok: false, reason: 'cancelled' };
    return { ok: true, uri: result.assets[0].uri };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function loadAvatarPhoto(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export async function saveAvatarPhoto(uri: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, uri);
  } catch {
    /* best effort */
  }
}
export async function clearAvatarPhoto(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* best effort */
  }
}
