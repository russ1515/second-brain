import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { Platform, Share } from 'react-native';

export interface TutorReplyPdfResult {
  uri: string | null;
  bytes: number | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function paragraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/** Creates the file from the reply actually shown in the authenticated Tutor.
 * The PDF contains no session identifiers or hidden prompt metadata. */
export function tutorReplyHtml(title: string, content: string, locale: string): string {
  const direction = ['ar', 'he', 'fa', 'ur'].includes(locale.split('-')[0]?.toLowerCase() ?? '') ? 'rtl' : 'ltr';
  return `<!doctype html>
<html lang="${escapeHtml(locale)}" dir="${direction}"><head><meta charset="utf-8"/><style>
@page { size: A4; margin: 18mm; }
body { color:#17171f; font-family:Arial,"Noto Sans",sans-serif; font-size:11pt; line-height:1.55; }
h1 { font-size:22pt; margin:0 0 10mm; }
p { margin:0 0 5mm; white-space:normal; overflow-wrap:anywhere; }
</style></head><body><h1>${escapeHtml(title)}</h1>${paragraphs(content)}</body></html>`;
}

export async function saveTutorReplyAsPdf(
  title: string,
  content: string,
  locale: string,
): Promise<TutorReplyPdfResult> {
  const html = tutorReplyHtml(title, content, locale);
  if (Platform.OS === 'web') {
    // Expo delegates Web PDF saving to the browser's print/save dialog.
    await Print.printAsync({ html });
    return { uri: null, bytes: null };
  }

  const generated = await Print.printToFileAsync({ html });
  const destination = FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}second-brain-reply-${Date.now()}.pdf`
    : generated.uri;
  if (destination !== generated.uri) {
    await FileSystem.copyAsync({ from: generated.uri, to: destination });
  }
  const info = await FileSystem.getInfoAsync(destination, { size: true });
  if (!info.exists || info.isDirectory || info.size <= 0) {
    throw new Error('PDF_FILE_NOT_CREATED');
  }
  await Share.share({ title, url: destination, message: destination });
  return { uri: destination, bytes: info.size };
}
