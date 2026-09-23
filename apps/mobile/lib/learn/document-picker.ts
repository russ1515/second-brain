import type { LearnDraftAttachment } from './composer-draft';
import {
  appendPickedDocument,
  isImageDocument as isPickedImage,
  pickDocuments,
  type PickedDocument,
} from '../document-import';

export interface PickedLearnDocument extends LearnDraftAttachment {
  file?: File;
}

export async function pickLearnDocument(): Promise<PickedLearnDocument | null> {
  return (await pickDocuments(false))[0] ?? null;
}

export async function appendLearnDocument(form: FormData, field: 'file' | 'images', document: PickedLearnDocument): Promise<void> {
  return appendPickedDocument(form, field, document as PickedDocument);
}

export function isImageDocument(document: LearnDraftAttachment): boolean {
  return isPickedImage(document as PickedDocument);
}
